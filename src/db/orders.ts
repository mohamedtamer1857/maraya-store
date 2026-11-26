import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { orderItems, orders, users } from './schema.ts';

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
  try {
    return await db.transaction(async (tx) => {
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
          totalAmount: input.totalAmount,
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

  const allItems = await db.select().from(orderItems);
  const itemsByOrderId = new Map<number, Array<typeof orderItems.$inferSelect>>();
  for (const item of allItems) {
    const bucket = itemsByOrderId.get(item.orderId) ?? [];
    bucket.push(item);
    itemsByOrderId.set(item.orderId, bucket);
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
  }));
}

export async function updateOrderStatusByRef(
  orderRef: string,
  nextStatus: OrderStatusValue
) {
  const [updated] = await db
    .update(orders)
    .set({ status: nextStatus })
    .where(eq(orders.orderRef, orderRef))
    .returning();

  return updated ?? null;
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
