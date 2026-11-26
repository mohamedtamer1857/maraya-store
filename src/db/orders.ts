import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { orderItems, orders, orderStaffNotes, productsCatalog, users } from './schema.ts';
import { ensureCatalogSeeded, parseSizeStock, sumSizeStock } from './products.ts';

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export interface CreateOrderInput {
  orderRef: string;
  userId?: number | null;
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: 'cod' | 'card';
  currency: 'EGP' | 'USD';
  totalAmount: number;
  items: Array<{
    sku: string;
    title: string;
    size: string;
    quantity: number;
  }>;
}

export async function createOrderRecord(input: CreateOrderInput) {
  await ensureCatalogSeeded();

  try {
    return await db.transaction(async (tx) => {
      let computedSubtotal = 0;
      let matchedCatalogItems = 0;

      const skuStates = new Map<
        string,
        {
          id: number;
          priceEgp: number;
          isActive: number;
          sizeStock: Record<string, number>;
        }
      >();

      for (const item of input.items) {
        let state = skuStates.get(item.sku);
        if (!state) {
          const [catalogItem] = await tx
            .select()
            .from(productsCatalog)
            .where(eq(productsCatalog.sku, item.sku))
            .for('update')
            .limit(1);

          if (catalogItem) {
            let sizes: string[] = [];
            try {
              const parsed = JSON.parse(catalogItem.sizesJson) as unknown;
              if (Array.isArray(parsed)) {
                sizes = parsed.filter((s): s is string => typeof s === 'string');
              }
            } catch {
              sizes = ['S', 'M', 'L', 'XL'];
            }
            const sizeStock = parseSizeStock(
              sizes,
              catalogItem.sizeStockJson,
              catalogItem.stockQty
            );
            state = {
              id: catalogItem.id,
              priceEgp: catalogItem.priceEgp,
              isActive: catalogItem.isActive,
              sizeStock,
            };
            skuStates.set(item.sku, state);
          }
        }

        if (state) {
          matchedCatalogItems += 1;
          const availableForSize = state.sizeStock[item.size] ?? 0;
          if (state.isActive !== 1 || availableForSize < item.quantity) {
            throw new InsufficientStockError(
              `Insufficient stock for ${item.title} (${item.size}) — available: ${Math.max(0, availableForSize)}.`
            );
          }

          state.sizeStock[item.size] = availableForSize - item.quantity;
          computedSubtotal += state.priceEgp * item.quantity;
        }
      }

      for (const state of skuStates.values()) {
        await tx
          .update(productsCatalog)
          .set({
            sizeStockJson: JSON.stringify(state.sizeStock),
            stockQty: sumSizeStock(state.sizeStock),
            updatedAt: new Date(),
          })
          .where(eq(productsCatalog.id, state.id));
      }

      const authoritativeTotal =
        matchedCatalogItems === input.items.length && computedSubtotal > 0
          ? computedSubtotal + (computedSubtotal >= 15000 ? 0 : 150)
          : input.totalAmount;

      const [insertedOrder] = await tx
        .insert(orders)
        .values({
          orderRef: input.orderRef,
          userId: input.userId ?? null,
          fullName: input.fullName,
          phone: input.phone,
          address: input.address,
          notes: input.notes,
          paymentMethod: input.paymentMethod,
          currency: input.currency,
          totalAmount: authoritativeTotal,
          status: 'confirmed',
        })
        .returning();

      if (input.items.length > 0) {
        await tx.insert(orderItems).values(
          input.items.map((item) => ({
            orderId: insertedOrder.id,
            sku: item.sku,
            title: item.title,
            size: item.size,
            quantity: item.quantity,
          }))
        );
      }

      return insertedOrder;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      throw error;
    }
    console.error('Database order creation failed:', error);
    throw new Error('Unable to save your order right now. Please try again.', {
      cause: error,
    });
  }
}

export async function getOrdersForUid(uid: string) {
  try {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    const user = userRows[0];
    if (!user) return [];

    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt));

    const results = [];
    for (const order of userOrders) {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      results.push({
        id: order.id,
        orderRef: order.orderRef,
        fullName: order.fullName,
        phone: order.phone,
        address: order.address,
        notes: order.notes,
        paymentMethod: order.paymentMethod,
        currency: order.currency,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
        items,
      });
    }
    return results;
  } catch (error) {
    console.error('Database order fetch failed:', error);
    throw new Error('Unable to load order history. Please try again later.', {
      cause: error,
    });
  }
}

export const ALLOWED_ORDER_STATUSES = [
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type OrderStatusValue = (typeof ALLOWED_ORDER_STATUSES)[number];

export function isValidOrderStatus(value: unknown): value is OrderStatusValue {
  return (
    typeof value === 'string' &&
    (ALLOWED_ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export async function getAllOrdersForStaff() {
  const allOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt));

  const [allItems, allStaffNotes] = await Promise.all([
    db.select().from(orderItems),
    db.select().from(orderStaffNotes).orderBy(desc(orderStaffNotes.createdAt)),
  ]);

  const itemsByOrderId = new Map<number, Array<typeof orderItems.$inferSelect>>();
  for (const item of allItems) {
    const bucket = itemsByOrderId.get(item.orderId) ?? [];
    bucket.push(item);
    itemsByOrderId.set(item.orderId, bucket);
  }

  const notesByOrderId = new Map<number, Array<typeof orderStaffNotes.$inferSelect>>();
  for (const noteRow of allStaffNotes) {
    const bucket = notesByOrderId.get(noteRow.orderId) ?? [];
    bucket.push(noteRow);
    notesByOrderId.set(noteRow.orderId, bucket);
  }

  return allOrders.map((order) => ({
    id: order.id,
    orderRef: order.orderRef,
    fullName: order.fullName,
    phone: order.phone,
    address: order.address,
    notes: order.notes,
    paymentMethod: order.paymentMethod,
    currency: order.currency,
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt,
    items: itemsByOrderId.get(order.id) ?? [],
    staffNotesList: notesByOrderId.get(order.id) ?? [],
  }));
}

export async function addOrderStaffNote(input: {
  orderRef: string;
  staffEmail: string;
  staffName: string | null;
  note: string;
}) {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderRef, input.orderRef))
    .limit(1);

  if (!order) return null;

  const [inserted] = await db
    .insert(orderStaffNotes)
    .values({
      orderId: order.id,
      staffEmail: input.staffEmail,
      staffName: input.staffName,
      note: input.note,
    })
    .returning();

  return inserted ?? null;
}

export async function deleteOrderStaffNote(input: {
  orderRef: string;
  noteId: number;
}) {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderRef, input.orderRef))
    .limit(1);

  if (!order) return false;

  const deleted = await db
    .delete(orderStaffNotes)
    .where(
      and(
        eq(orderStaffNotes.id, input.noteId),
        eq(orderStaffNotes.orderId, order.id)
      )
    )
    .returning({ id: orderStaffNotes.id });

  return deleted.length > 0;
}

export async function updateOrderStatusByRef(
  orderRef: string,
  nextStatus: OrderStatusValue
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(orders)
      .where(eq(orders.orderRef, orderRef))
      .limit(1);

    if (!existing) return null;

    const wasCancelled = existing.status === 'cancelled';
    const willCancel = nextStatus === 'cancelled';

    if (wasCancelled !== willCancel) {
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, existing.id));

      for (const item of items) {
        const [catalogItem] = await tx
          .select()
          .from(productsCatalog)
          .where(eq(productsCatalog.sku, item.sku))
          .for('update')
          .limit(1);

        if (!catalogItem) continue;

        let sizes: string[] = [];
        try {
          const parsed = JSON.parse(catalogItem.sizesJson) as unknown;
          if (Array.isArray(parsed)) {
            sizes = parsed.filter((s): s is string => typeof s === 'string');
          }
        } catch {
          sizes = ['S', 'M', 'L', 'XL'];
        }
        const sizeStock = parseSizeStock(
          sizes,
          catalogItem.sizeStockJson,
          catalogItem.stockQty
        );
        const currentQty = sizeStock[item.size] ?? 0;

        if (willCancel) {
          sizeStock[item.size] = currentQty + item.quantity;
        } else {
          sizeStock[item.size] = Math.max(0, currentQty - item.quantity);
        }

        await tx
          .update(productsCatalog)
          .set({
            sizeStockJson: JSON.stringify(sizeStock),
            stockQty: sumSizeStock(sizeStock),
            updatedAt: new Date(),
          })
          .where(eq(productsCatalog.id, catalogItem.id));
      }
    }

    const [updated] = await tx
      .update(orders)
      .set({ status: nextStatus })
      .where(eq(orders.id, existing.id))
      .returning();

    return updated ?? null;
  });
}

export async function getSalesSummaryForStaff() {
  const allOrders = await db.select().from(orders);

  let totalSalesEgp = 0;
  let deliveredSalesEgp = 0;
  let activeSalesEgp = 0;
  let codSalesEgp = 0;
  let cardSalesEgp = 0;
  let activeOrders = 0;
  let shippedOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  let nonCancelledOrders = 0;

  for (const order of allOrders) {
    const st = order.status.trim().toLowerCase();
    if (st === 'cancelled' || st === 'canceled') {
      cancelledOrders += 1;
      continue;
    }

    nonCancelledOrders += 1;
    const amt = order.currency === 'EGP' ? order.totalAmount : 0;
    totalSalesEgp += amt;

    if (order.paymentMethod === 'card') {
      cardSalesEgp += amt;
    } else {
      codSalesEgp += amt;
    }

    if (st === 'delivered' || st === 'completed') {
      deliveredOrders += 1;
      deliveredSalesEgp += amt;
    } else if (st === 'shipped' || st === 'in_transit' || st === 'out_for_delivery') {
      shippedOrders += 1;
      activeOrders += 1;
      activeSalesEgp += amt;
    } else {
      activeOrders += 1;
      activeSalesEgp += amt;
    }
  }

  return {
    totalSalesEgp,
    deliveredSalesEgp,
    activeSalesEgp,
    codSalesEgp,
    cardSalesEgp,
    totalOrders: nonCancelledOrders,
    activeOrders,
    shippedOrders,
    deliveredOrders,
    cancelledOrders,
    averageOrderValueEgp:
      nonCancelledOrders > 0 ? Math.round(totalSalesEgp / nonCancelledOrders) : 0,
  };
}
