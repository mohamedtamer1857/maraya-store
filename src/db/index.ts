import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _marayaSchemaReadyPromise: Promise<void> | undefined;
}

function getConnectionString(): string | undefined {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    '';
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isDatabaseConfigured(): boolean {
  if (getConnectionString()) return true;
  return Boolean(process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME);
}

function shouldUseSslForUrl(connectionString: string): boolean {
  const lower = connectionString.toLowerCase();
  if (lower.includes('sslmode=disable')) return false;
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false;
  return true;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = getConnectionString();
    const maxClients = process.env.VERCEL ? 5 : 10;

    if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        ssl: shouldUseSslForUrl(connectionString)
          ? { rejectUnauthorized: false }
          : undefined,
        max: maxClients,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 15000,
      });
    } else if (process.env.SQL_HOST) {
      const host = process.env.SQL_HOST;
      const isUnixSocket = host.startsWith('/');
      const useSsl = !isUnixSocket && process.env.SQL_SSL === 'true';
      global._postgresPool = new Pool({
        host,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        max: maxClients,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host: '127.0.0.1',
        max: 1,
        connectionTimeoutMillis: 2000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });

export async function ensureDatabaseSchema(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error(
      'Database connection is not configured on the server. Set DATABASE_URL (or SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME) in Vercel Environment Variables.'
    );
  }

  if (!global._marayaSchemaReadyPromise) {
    global._marayaSchemaReadyPromise = (async () => {
      const checkRes = await pool.query<{
        staff_tbl: string | null;
        prod_tbl: string | null;
        cat_tbl: string | null;
        orders_tbl: string | null;
      }>(`
        SELECT
          to_regclass('public.staff_members') AS staff_tbl,
          to_regclass('public.products_catalog') AS prod_tbl,
          to_regclass('public.product_categories') AS cat_tbl,
          to_regclass('public.orders') AS orders_tbl
      `);
      const existing = checkRes.rows[0];
      if (
        existing?.staff_tbl &&
        existing?.prod_tbl &&
        existing?.cat_tbl &&
        existing?.orders_tbl
      ) {
        return;
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          uid TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          display_name TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          order_ref TEXT NOT NULL UNIQUE,
          user_id INTEGER REFERENCES users(id),
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          address TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          payment_method TEXT NOT NULL,
          currency TEXT NOT NULL,
          total_amount INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'confirmed',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          sku TEXT NOT NULL,
          title TEXT NOT NULL,
          size TEXT NOT NULL,
          quantity INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS order_staff_notes (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          staff_email TEXT NOT NULL,
          staff_name TEXT,
          note TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS staff_members (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT,
          role TEXT NOT NULL DEFAULT 'operations',
          can_view_orders INTEGER NOT NULL DEFAULT 1,
          can_update_order_status INTEGER NOT NULL DEFAULT 0,
          can_view_sales INTEGER NOT NULL DEFAULT 0,
          can_manage_staff INTEGER NOT NULL DEFAULT 0,
          can_manage_products INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS products_catalog (
          id SERIAL PRIMARY KEY,
          product_id TEXT NOT NULL UNIQUE,
          sku TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL,
          image TEXT NOT NULL,
          price_egp INTEGER NOT NULL,
          stock_qty INTEGER NOT NULL DEFAULT 15,
          sizes_json TEXT NOT NULL,
          size_stock_json TEXT,
          tag_ar TEXT,
          tag_en TEXT,
          title_ar TEXT NOT NULL,
          title_en TEXT NOT NULL,
          subtitle_ar TEXT NOT NULL,
          subtitle_en TEXT NOT NULL,
          color_ar TEXT NOT NULL,
          color_en TEXT NOT NULL,
          color_hex TEXT NOT NULL,
          fabric_ar TEXT NOT NULL,
          fabric_en TEXT NOT NULL,
          description_ar TEXT NOT NULL,
          description_en TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        ALTER TABLE products_catalog ADD COLUMN IF NOT EXISTS size_stock_json TEXT;

        CREATE TABLE IF NOT EXISTS product_categories (
          id SERIAL PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
    })().catch((err) => {
      global._marayaSchemaReadyPromise = undefined;
      throw err;
    });
  }

  return global._marayaSchemaReadyPromise;
}
