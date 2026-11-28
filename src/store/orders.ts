import { getStoreSnapshot, withStoreMutation } from './jsonStore.ts';
import { parseSizeStock, sumSizeStock } from './products.ts';
import { verifyOrderAccessToken } from '../lib/staffAuth.ts';
import type { StoredOrder } from '../data/initialStoreData.ts';

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export interface CreateOrderInput {
  orderRef: string;
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

export async function createOrderRecord(input: CreateOrderInput): Promise<StoredOrder> {
  return withStoreMutation((store) => {
    let computedSubtotal = 0;
    let matchedCatalogItems = 0;

    const stagedUpdates = new Map<
      string,
      { index: number; sizeStock: Record<string, number>; priceEgp: number; isActive: boolean }
    >();

    for (const item of input.items) {
      let state = stagedUpdates.get(item.sku);
      if (!state) {
        const idx = store.products.findIndex((p) => p.sku === item.sku);
        if (idx !== -1) {
          const catalogItem = store.products[idx];
          const sizes =
            catalogItem.sizes.length > 0 ? catalogItem.sizes : ['S', 'M', 'L', 'XL'];
          const sizeStock = parseSizeStock(
            sizes,
            catalogItem.sizeStock,
            catalogItem.stockQty ?? 15
          );
          state = {
            index: idx,
            priceEgp: catalogItem.priceEgp,
            isActive: catalogItem.isActive !== false,
            sizeStock,
          };
          stagedUpdates.set(item.sku, state);
        }
      }

      if (state) {
        matchedCatalogItems += 1;
        const availableForSize = state.sizeStock[item.size] ?? 0;
        if (!state.isActive || availableForSize < item.quantity) {
          throw new InsufficientStockError(
            `Insufficient stock for ${item.title} (${item.size}) — available: ${Math.max(0, availableForSize)}.`
          );
        }
        state.sizeStock[item.size] = availableForSize - item.quantity;
        computedSubtotal += state.priceEgp * item.quantity;
      }
    }

    for (const state of stagedUpdates.values()) {
      const target = store.products[state.index];
      target.sizeStock = state.sizeStock;
      target.stockQty = sumSizeStock(state.sizeStock);
    }

    const authoritativeTotal =
      matchedCatalogItems === input.items.length && computedSubtotal > 0
        ? computedSubtotal + (computedSubtotal >= 15000 ? 0 : 150)
        : input.totalAmount;

    const orderId = store.nextOrderSeq++;
    const createdOrder: StoredOrder = {
      id: orderId,
      orderRef: input.orderRef,
      fullName: input.fullName,
      phone: input.phone,
      address: input.address,
      notes: input.notes,
      paymentMethod: input.paymentMethod,
      currency: input.currency,
      totalAmount: authoritativeTotal,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      items: input.items.map((item) => ({
        id: store.nextOrderItemSeq++,
        orderId,
        sku: item.sku,
        title: item.title,
        size: item.size,
        quantity: item.quantity,
      })),
      staffNotesList: [],
    };

    store.orders.unshift(createdOrder);
    return createdOrder;
  });
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D+/g, '').slice(-9);
}

export async function getOrdersForCustomerLookup(input: {
  tokens?: string[];
  lookup?: { orderRef: string; phone: string } | null;
}) {
  const store = getStoreSnapshot();
  const allowedRefs = new Set<string>();

  if (Array.isArray(input.tokens)) {
    for (const token of input.tokens.slice(0, 30)) {
      if (typeof token !== 'string') continue;
      const verified = verifyOrderAccessToken(token.trim());
      if (verified?.orderRef) {
        allowedRefs.add(verified.orderRef);
      }
    }
  }

  if (input.lookup?.orderRef && input.lookup?.phone) {
    const cleanRef = input.lookup.orderRef.trim().toUpperCase();
    const cleanPhone = normalizePhoneDigits(input.lookup.phone);
    if (cleanRef && cleanPhone.length >= 6) {
      const matched = store.orders.find(
        (o) =>
          o.orderRef.toUpperCase() === cleanRef &&
          normalizePhoneDigits(o.phone) === cleanPhone
      );
      if (matched) {
        allowedRefs.add(matched.orderRef);
      }
    }
  }

  if (allowedRefs.size === 0) return [];

  return store.orders
    .filter((o) => allowedRefs.has(o.orderRef))
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((o) => ({
      id: o.id,
      orderRef: o.orderRef,
      fullName: o.fullName,
      phone: o.phone,
      address: o.address,
      notes: o.notes,
      paymentMethod: o.paymentMethod,
      currency: o.currency,
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
      items: o.items,
    }));
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
  const store = getStoreSnapshot();
  return store.orders
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((o) => ({
      ...o,
      staffNotesList: (o.staffNotesList ?? [])
        .slice()
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    }));
}

export async function addOrderStaffNote(input: {
  orderRef: string;
  staffUsername: string;
  staffName: string | null;
  note: string;
}) {
  return withStoreMutation((store) => {
    const order = store.orders.find((o) => o.orderRef === input.orderRef);
    if (!order) return null;

    const created = {
      id: store.nextNoteSeq++,
      orderId: order.id,
      staffUsername: input.staffUsername,
      staffName: input.staffName,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    order.staffNotesList.unshift(created);
    return created;
  });
}

export async function deleteOrderStaffNote(input: {
  orderRef: string;
  noteId: number;
}) {
  return withStoreMutation((store) => {
    const order = store.orders.find((o) => o.orderRef === input.orderRef);
    if (!order) return false;

    const idx = order.staffNotesList.findIndex((n) => n.id === input.noteId);
    if (idx === -1) return false;
    order.staffNotesList.splice(idx, 1);
    return true;
  });
}

export async function updateOrderStatusByRef(
  orderRef: string,
  nextStatus: OrderStatusValue
) {
  return withStoreMutation((store) => {
    const existing = store.orders.find((o) => o.orderRef === orderRef);
    if (!existing) return null;

    const wasCancelled = existing.status === 'cancelled';
    const willCancel = nextStatus === 'cancelled';

    if (wasCancelled !== willCancel) {
      for (const item of existing.items) {
        const catalogItem = store.products.find((p) => p.sku === item.sku);
        if (!catalogItem) continue;

        const sizes =
          catalogItem.sizes.length > 0 ? catalogItem.sizes : ['S', 'M', 'L', 'XL'];
        const sizeStock = parseSizeStock(
          sizes,
          catalogItem.sizeStock,
          catalogItem.stockQty ?? 15
        );
        const currentQty = sizeStock[item.size] ?? 0;
        sizeStock[item.size] = willCancel
          ? currentQty + item.quantity
          : Math.max(0, currentQty - item.quantity);

        catalogItem.sizeStock = sizeStock;
        catalogItem.stockQty = sumSizeStock(sizeStock);
      }
    }

    existing.status = nextStatus;
    return { ...existing };
  });
}

export async function getSalesSummaryForStaff() {
  const store = getStoreSnapshot();

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

  for (const order of store.orders) {
    const st = order.status.trim().toLowerCase();
    if (st === 'cancelled') {
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

    if (st === 'delivered') {
      deliveredOrders += 1;
      deliveredSalesEgp += amt;
    } else if (st === 'shipped') {
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
