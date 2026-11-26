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
