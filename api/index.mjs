// Pre-bundled Vercel Serverless API handler (generated from src/vercelHandler.ts)
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/apiApp.ts
import path2 from "node:path";
import fs2 from "node:fs";
import crypto from "node:crypto";
import express from "express";

// src/lib/firebase-admin.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PUBLIC_FALLBACK_PROJECT_ID = "studious-abstraction-w2ts5";
function resolveProjectId() {
  const envProjectId = (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "").trim();
  if (envProjectId && envProjectId !== "remixed-project-id") {
    return envProjectId;
  }
  const candidatePaths = [
    path.resolve(process.cwd(), "firebase-applet-config.json"),
    path.resolve(__dirname, "../../firebase-applet-config.json"),
    path.resolve(__dirname, "../firebase-applet-config.json")
  ];
  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.projectId && parsed.projectId !== "remixed-project-id") {
          return parsed.projectId;
        }
      }
    } catch {
    }
  }
  return PUBLIC_FALLBACK_PROJECT_ID;
}
function getOrInitAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  const projectId = resolveProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    return initializeApp({
      projectId,
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }
  return initializeApp({
    projectId
  });
}
function getAdminAuth() {
  return getAuth(getOrInitAdminApp());
}

// src/middleware/auth.ts
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing token" });
    return;
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
var optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    req.user = decodedToken;
  } catch {
  }
  next();
};

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  orderItems: () => orderItems,
  orderItemsRelations: () => orderItemsRelations,
  orderStaffNotes: () => orderStaffNotes,
  orderStaffNotesRelations: () => orderStaffNotesRelations,
  orders: () => orders,
  ordersRelations: () => ordersRelations,
  productCategories: () => productCategories,
  productsCatalog: () => productsCatalog,
  staffMembers: () => staffMembers,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderRef: text("order_ref").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  notes: text("notes").default("").notNull(),
  paymentMethod: text("payment_method").notNull(),
  currency: text("currency").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: text("status").default("confirmed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  sku: text("sku").notNull(),
  title: text("title").notNull(),
  size: text("size").notNull(),
  quantity: integer("quantity").notNull()
});
var orderStaffNotes = pgTable("order_staff_notes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  staffEmail: text("staff_email").notNull(),
  staffName: text("staff_name"),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var staffMembers = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: text("role").default("operations").notNull(),
  canViewOrders: integer("can_view_orders").default(1).notNull(),
  canUpdateOrderStatus: integer("can_update_order_status").default(0).notNull(),
  canViewSales: integer("can_view_sales").default(0).notNull(),
  canManageStaff: integer("can_manage_staff").default(0).notNull(),
  canManageProducts: integer("can_manage_products").default(0).notNull(),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var productsCatalog = pgTable("products_catalog", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
  sku: text("sku").notNull().unique(),
  category: text("category").notNull(),
  image: text("image").notNull(),
  priceEgp: integer("price_egp").notNull(),
  stockQty: integer("stock_qty").default(15).notNull(),
  sizesJson: text("sizes_json").notNull(),
  sizeStockJson: text("size_stock_json"),
  tagAr: text("tag_ar"),
  tagEn: text("tag_en"),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  subtitleAr: text("subtitle_ar").notNull(),
  subtitleEn: text("subtitle_en").notNull(),
  colorAr: text("color_ar").notNull(),
  colorEn: text("color_en").notNull(),
  colorHex: text("color_hex").notNull(),
  fabricAr: text("fabric_ar").notNull(),
  fabricEn: text("fabric_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  isActive: integer("is_active").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  isActive: integer("is_active").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var usersRelations = relations(users, ({ many }) => ({
  orders: many(orders)
}));
var ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id]
  }),
  items: many(orderItems),
  staffNotes: many(orderStaffNotes)
}));
var orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  })
}));
var orderStaffNotesRelations = relations(orderStaffNotes, ({ one }) => ({
  order: one(orders, {
    fields: [orderStaffNotes.orderId],
    references: [orders.id]
  })
}));

// src/db/index.ts
function getConnectionString() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : void 0;
}
function isDatabaseConfigured() {
  if (getConnectionString()) return true;
  return Boolean(process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME);
}
function shouldUseSslForUrl(connectionString) {
  const lower = connectionString.toLowerCase();
  if (lower.includes("sslmode=disable")) return false;
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  return true;
}
var createPool = () => {
  if (!global._postgresPool) {
    if (!isDatabaseConfigured()) {
      throw new Error(
        "Database connection is not configured on the server. Set DATABASE_URL (or SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME) in Environment Variables."
      );
    }
    const connectionString = getConnectionString();
    const maxClients = process.env.VERCEL ? 5 : 10;
    if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        ssl: shouldUseSslForUrl(connectionString) ? { rejectUnauthorized: false } : void 0,
        max: maxClients,
        idleTimeoutMillis: 1e4,
        connectionTimeoutMillis: 15e3
      });
    } else if (process.env.SQL_HOST) {
      const host = process.env.SQL_HOST;
      const isUnixSocket = host.startsWith("/");
      const useSsl = !isUnixSocket && process.env.SQL_SSL === "true";
      global._postgresPool = new Pool({
        host,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : void 0,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl: useSsl ? { rejectUnauthorized: false } : void 0,
        max: maxClients,
        idleTimeoutMillis: 1e4,
        connectionTimeoutMillis: 15e3
      });
    } else {
      throw new Error(
        "Database connection is not configured on the server. Set DATABASE_URL in Environment Variables."
      );
    }
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var _drizzleDb;
function getDb() {
  if (!_drizzleDb) {
    _drizzleDb = drizzle(createPool(), { schema: schema_exports });
  }
  return _drizzleDb;
}
var db = new Proxy({}, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  }
});
async function ensureDatabaseSchema() {
  if (!isDatabaseConfigured()) {
    throw new Error(
      "Database connection is not configured on the server. Set DATABASE_URL (or SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME) in Vercel Environment Variables."
    );
  }
  if (!global._marayaSchemaReadyPromise) {
    global._marayaSchemaReadyPromise = (async () => {
      const pool = createPool();
      const checkRes = await pool.query(`
        SELECT
          to_regclass('public.staff_members') AS staff_tbl,
          to_regclass('public.products_catalog') AS prod_tbl,
          to_regclass('public.product_categories') AS cat_tbl,
          to_regclass('public.orders') AS orders_tbl
      `);
      const existing = checkRes.rows[0];
      if (existing?.staff_tbl && existing?.prod_tbl && existing?.cat_tbl && existing?.orders_tbl) {
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
      global._marayaSchemaReadyPromise = void 0;
      throw err;
    });
  }
  return global._marayaSchemaReadyPromise;
}

// src/db/users.ts
async function getOrCreateUser(uid, email, displayName) {
  try {
    const result = await db.insert(users).values({
      uid,
      email,
      displayName: displayName ?? null
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
        displayName: displayName ?? null
      }
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Database user upsert failed:", error);
    throw new Error("Unable to sync user account. Please try again later.", {
      cause: error
    });
  }
}

// src/db/orders.ts
import { and, desc, eq as eq3 } from "drizzle-orm";

// src/db/products.ts
import { asc as asc2, eq as eq2 } from "drizzle-orm";

// src/data/products.ts
var PRODUCTS = [
  {
    id: "obsidian-wool-trench",
    sku: "MRY-014",
    category: "outerwear",
    image: "/src/assets/images/prod_only_trench_1795658686842.jpg",
    priceEgp: 18500,
    sizes: ["XS", "S", "M", "L", "XL"],
    tag: {
      ar: "\u0625\u0635\u062F\u0627\u0631 \u0645\u062D\u062F\u0648\u062F",
      en: "Limited Run"
    },
    title: {
      ar: "\u0628\u0627\u0644\u0637\u0648 \u062A\u0631\u064A\u0646\u0634 \u0635\u0648\u0641 \u0623\u0648\u0628\u0633\u064A\u062F\u064A\u0627\u0646",
      en: "Obsidian Wool Trench Coat"
    },
    subtitle: {
      ar: "\u0635\u0648\u0641 \u0645\u064A\u0631\u064A\u0646\u0648 \u0645\u0632\u062F\u0648\u062C \u0627\u0644\u0648\u062C\u0647",
      en: "Double-faced Merino Wool"
    },
    color: {
      ar: "\u0641\u062D\u0645\u064A \u063A\u0627\u0645\u0642",
      en: "Charcoal Obsidian",
      hex: "#222429"
    },
    fabric: {
      ar: "90% \u0635\u0648\u0641 \u0645\u064A\u0631\u064A\u0646\u0648 \u0628\u0643\u0631 \xB7 10% \u0643\u0634\u0645\u064A\u0631 \xB7 \u0628\u0637\u0627\u0646\u0629 \u062D\u0631\u064A\u0631 \u0643\u0648\u0628\u0631\u0648",
      en: "90% Virgin Merino Wool \xB7 10% Cashmere \xB7 Cupro Silk Lining"
    },
    description: {
      ar: "\u0628\u0627\u0644\u0637\u0648 \u0637\u0648\u064A\u0644 \u0628\u0642\u064E\u0635\u0651\u0629 \u0645\u0633\u062A\u0642\u064A\u0645\u0629 \u0648\u062D\u0632\u0627\u0645 \u0648\u0633\u0637 \u0645\u062A\u0646\u0627\u0633\u0642\u060C \u0645\u062A\u0635\u0645\u0645 \u0639\u0634\u0627\u0646 \u064A\u062F\u064A\u0643 \u062A\u0648\u0627\u0632\u0646 \u0645\u062B\u0627\u0644\u064A \u0628\u064A\u0646 \u0627\u0644\u062F\u0641\u0627 \u0648\u0627\u0644\u0634\u0643\u0644 \u0627\u0644\u0627\u0646\u0633\u064A\u0627\u0628\u064A \u0643\u0644 \u064A\u0648\u0645.",
      en: "Architectural longline trench tailored with a clean shoulder line and matching waist belt for structured everyday drape."
    }
  },
  {
    id: "savile-cobalt-blazer",
    sku: "MRY-022",
    category: "tailoring",
    image: "/src/assets/images/prod_only_blazer_1795658687589.jpg",
    priceEgp: 16500,
    sizes: ["XS", "S", "M", "L", "XL"],
    tag: {
      ar: "\u0627\u0644\u0623\u0643\u062B\u0631 \u0637\u0644\u0628\u0627\u064B",
      en: "Signature Piece"
    },
    title: {
      ar: "\u0628\u0644\u064A\u0632\u0631 \u0643\u0648\u0628\u0627\u0644\u062A \u0645\u0632\u062F\u0648\u062C \u0627\u0644\u0623\u0632\u0631\u0627\u0631",
      en: "Savile Cobalt Double-Breasted Blazer"
    },
    subtitle: {
      ar: "\u062A\u0641\u0635\u064A\u0644 \u0645\u062A\u0645\u0627\u0633\u0643 \u0645\u0646 \u0627\u0644\u0635\u0648\u0641 \u0627\u0644\u0628\u0627\u0631\u062F",
      en: "Structured Cool-Wool Tailoring"
    },
    color: {
      ar: "\u0623\u0632\u0631\u0642 \u0643\u0648\u0628\u0627\u0644\u062A",
      en: "Savile Cobalt",
      hex: "#1E3A8A"
    },
    fabric: {
      ar: "100% \u0635\u0648\u0641 \u0625\u064A\u0637\u0627\u0644\u064A \u0645\u0646\u0633\u0648\u062C \xB7 \u0623\u0632\u0631\u0627\u0631 \u0645\u0639\u062F\u0646\u064A\u0629 \u0645\u0637\u0641\u064A\u0629",
      en: "100% Italian Worsted Wool \xB7 Brushed Brass Hardware"
    },
    description: {
      ar: "\u0628\u0644\u064A\u0632\u0631 \u0628\u062F\u0631\u062C\u0629 \u0627\u0644\u0643\u0648\u0628\u0627\u0644\u062A \u0627\u0644\u0639\u0645\u064A\u0642\u0629 \u0645\u0639 \u0623\u0643\u062A\u0627\u0641 \u0645\u0638\u0628\u0648\u0637\u0629 \u0648\u0632\u0631\u0627\u064A\u0631 \u0645\u0632\u062F\u0648\u062C\u0629 \u062A\u062F\u064A \u062D\u0636\u0648\u0631 \u0634\u064A\u0643 \u0641\u064A \u0627\u0644\u062E\u0631\u0648\u062C\u0627\u062A \u0627\u0644\u0645\u0633\u0627\u0626\u064A\u0629 \u0623\u0648 \u0627\u0644\u0634\u063A\u0644.",
      en: "Deep cobalt tailored blazer with sculpted lapels and matte brass double-breasted closure for sharp evening and studio styling."
    }
  },
  {
    id: "pearl-silk-poplin-shirt",
    sku: "MRY-031",
    category: "shirts",
    image: "/src/assets/images/prod_only_silk_shirt_1795658687955.jpg",
    priceEgp: 8900,
    sizes: ["XS", "S", "M", "L"],
    title: {
      ar: "\u0642\u0645\u064A\u0635 \u062D\u0631\u064A\u0631 \u0644\u0624\u0644\u0624\u064A \u0645\u0646\u0633\u062F\u0644",
      en: "Pearl Ivory Silk Poplin Shirt"
    },
    subtitle: {
      ar: "\u062D\u0631\u064A\u0631 \u0627\u0644\u062A\u0648\u062A \u0627\u0644\u0637\u0628\u064A\u0639\u064A \u0627\u0644\u0645\u063A\u0633\u0648\u0644",
      en: "Sandwashed Mulberry Silk"
    },
    color: {
      ar: "\u0639\u0627\u062C\u064A \u0644\u0624\u0644\u0624\u064A",
      en: "Pearl Ivory",
      hex: "#EDEAE2"
    },
    fabric: {
      ar: "100% \u062D\u0631\u064A\u0631 \u062A\u0648\u062A \u0637\u0628\u064A\u0639\u064A 22 \u0645\u0648\u0645 \xB7 \u0623\u0632\u0631\u0627\u0631 \u0635\u062F\u0641",
      en: "100% 22-Momme Mulberry Silk \xB7 Mother-of-Pearl Buttons"
    },
    description: {
      ar: "\u0642\u0645\u064A\u0635 \u0628\u0645\u0644\u0645\u0633 \u062D\u0631\u064A\u0631\u064A \u0646\u0627\u0639\u0645 \u0648\u064A\u0627\u0642\u0629 \u0645\u0638\u0628\u0648\u0637\u0629 \u0628\u062A\u0646\u0633\u062F\u0644 \u0628\u0634\u064A\u0627\u0643\u0629\u060C \u0639\u0645\u0644\u064A \u0648\u0645\u0646\u0627\u0633\u0628 \u0645\u0646 \u0627\u0644\u0635\u0628\u062D \u0644\u0628\u0644\u064A\u0644.",
      en: "Fluid sandwashed mulberry silk shirt with crisp collar architecture and hidden placket, effortless from morning to dusk."
    }
  },
  {
    id: "forest-suede-overshirt",
    sku: "MRY-045",
    category: "outerwear",
    image: "/src/assets/images/prod_only_overshirt_1795658687798.jpg",
    priceEgp: 19800,
    sizes: ["S", "M", "L", "XL"],
    tag: {
      ar: "\u0648\u0635\u0644 \u062D\u062F\u064A\u062B\u0627\u064B",
      en: "New Arrival"
    },
    title: {
      ar: "\u062C\u0627\u0643\u064A\u062A \u0634\u0627\u0645\u0648\u0627\u0647 \u0632\u064A\u062A\u0648\u0646\u064A \u063A\u0627\u0645\u0642",
      en: "Forest Olive Suede Overshirt"
    },
    subtitle: {
      ar: "\u062C\u0644\u062F \u0634\u0627\u0645\u0648\u0627\u0647 \u0625\u064A\u0637\u0627\u0644\u064A \u0646\u0627\u0639\u0645",
      en: "Supple Italian Calf Suede"
    },
    color: {
      ar: "\u0632\u064A\u062A\u0648\u0646\u064A \u063A\u0627\u0645\u0642",
      en: "Forest Olive",
      hex: "#364133"
    },
    fabric: {
      ar: "100% \u062C\u0644\u062F \u0634\u0627\u0645\u0648\u0627\u0647 \u0637\u0628\u064A\u0639\u064A \xB7 \u0623\u0632\u0631\u0627\u0631 \u0642\u0631\u0646\u064A\u0629 \u0645\u0635\u0642\u0648\u0644\u0629",
      en: "100% Full-Grain Calf Suede \xB7 Horn Buttons"
    },
    description: {
      ar: "\u062C\u0627\u0643\u064A\u062A \u0639\u0645\u0644\u064A \u0628\u0642\u064E\u0635\u0651\u0629 \u0642\u0645\u064A\u0635 \u0639\u0635\u0631\u064A\u0629 \u0648\u062C\u064A\u0648\u0628 \u0635\u062F\u0631 \u0645\u062A\u0646\u0627\u0638\u0631\u0629\u060C \u0645\u0635\u0646\u0648\u0639 \u0645\u0646 \u0627\u0644\u0634\u0627\u0645\u0648\u0627\u0647 \u0627\u0644\u0641\u0627\u062E\u0631 \u0628\u0645\u0644\u0645\u0633 \u0646\u0627\u0639\u0645 \u0648\u0645\u0631\u0646.",
      en: "Modern utility overshirt crafted from velvety Italian calf suede with dual chest flap pockets and tonal stitching."
    }
  },
  {
    id: "oxblood-merino-knit",
    sku: "MRY-058",
    category: "knitwear",
    image: "/src/assets/images/prod_only_burgundy_knit_1795658687857.jpg",
    priceEgp: 9500,
    sizes: ["XS", "S", "M", "L", "XL"],
    title: {
      ar: "\u0628\u0644\u0648\u0641\u0631 \u0645\u064A\u0631\u064A\u0646\u0648 \u0639\u0646\u0627\u0628\u064A \u0645\u0636\u0644\u0639",
      en: "Oxblood Ribbed Merino Sweater"
    },
    subtitle: {
      ar: "\u062A\u0631\u064A\u0643\u0648 \u062B\u0642\u064A\u0644 \u0628\u064A\u0627\u0642\u0629 \u0639\u0627\u0644\u064A\u0629",
      en: "Heavyweight Mock-Neck Knit"
    },
    color: {
      ar: "\u0639\u0646\u0627\u0628\u064A \u063A\u0627\u0645\u0642",
      en: "Oxblood Burgundy",
      hex: "#4A1D24"
    },
    fabric: {
      ar: "100% \u0635\u0648\u0641 \u0645\u064A\u0631\u064A\u0646\u0648 \u0646\u0627\u0639\u0645 \u062C\u062F\u0627\u064B (7 \u063A\u0631\u0632)",
      en: "100% Extra-Fine Merino Wool (7-Gauge)"
    },
    description: {
      ar: "\u0628\u0644\u0648\u0641\u0631 \u062F\u0627\u0641\u064A \u0628\u062D\u064A\u0627\u0643\u0629 \u0645\u0636\u0644\u0639\u0629 \u0648\u0623\u0643\u062A\u0627\u0641 \u0645\u0631\u064A\u062D\u0629\u060C \u0628\u064A\u062C\u0645\u0639 \u0628\u064A\u0646 \u0627\u0644\u0631\u0627\u062D\u0629 \u0627\u0644\u0639\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u0634\u0643\u0644 \u0627\u0644\u0645\u0638\u0628\u0648\u0637 \u0648\u0627\u0644\u0623\u0646\u064A\u0642.",
      en: "Sculpted horizontal-rib knit sweater with drop shoulders and a clean mock-neck collar in rich oxblood."
    }
  },
  {
    id: "desert-taupe-kaftan-coat",
    sku: "MRY-063",
    category: "tailoring",
    image: "/src/assets/images/prod_only_taupe_coat_1795658688943.jpg",
    priceEgp: 21e3,
    sizes: ["XS", "S", "M", "L"],
    tag: {
      ar: "\u062D\u0635\u0631\u064A \u0644\u0644\u062F\u0627\u0631",
      en: "Atelier Exclusive"
    },
    title: {
      ar: "\u0628\u0627\u0644\u0637\u0648 \u0642\u0641\u0637\u0627\u0646 \u0631\u0645\u0644\u064A \u0628\u062D\u0632\u0627\u0645 \u0645\u0639\u0645\u0627\u0631\u064A",
      en: "Desert Taupe Belted Coat"
    },
    subtitle: {
      ar: "\u0645\u0632\u064A\u062C \u0627\u0644\u0643\u062A\u0627\u0646 \u0648\u0627\u0644\u0635\u0648\u0641 \u0627\u0644\u062E\u0641\u064A\u0641",
      en: "Linen-Wool Architectural Coat"
    },
    color: {
      ar: "\u0631\u0645\u0644\u064A \u062F\u0627\u0641\u064A",
      en: "Desert Taupe",
      hex: "#A89683"
    },
    fabric: {
      ar: "55% \u0643\u062A\u0627\u0646 \u0628\u0644\u062C\u064A\u0643\u064A \xB7 45% \u0635\u0648\u0641 \u0628\u0643\u0631 \u062E\u0641\u064A\u0641",
      en: "55% Belgian Linen \xB7 45% Lightweight Virgin Wool"
    },
    description: {
      ar: "\u062A\u0635\u0645\u064A\u0645 \u0637\u0648\u064A\u0644 \u0628\u064A\u062C\u0645\u0639 \u0628\u064A\u0646 \u0627\u0644\u0634\u064A\u0627\u0643\u0629 \u0627\u0644\u0643\u0644\u0627\u0633\u064A\u0643\u064A\u0629 \u0648\u062F\u0642\u0629 \u0627\u0644\u062A\u0641\u0635\u064A\u0644 \u0627\u0644\u0639\u0635\u0631\u064A \u0645\u0639 \u064A\u0627\u0642\u0629 \u0639\u0627\u0644\u064A\u0629 \u0648\u062D\u0632\u0627\u0645 \u0645\u062A\u063A\u0637\u064A \u0628\u0646\u0641\u0633 \u0627\u0644\u0642\u0645\u0627\u0634.",
      en: "Architectural long coat blending timeless drape with sharp tailoring, stand collar, and self-covered belt."
    }
  }
];

// src/db/categories.ts
import { asc, eq } from "drizzle-orm";
var DEFAULT_CATEGORIES = [
  { slug: "outerwear", nameAr: "\u0628\u0627\u0644\u0637\u0648\u0647\u0627\u062A \u0648\u062C\u0648\u0627\u0643\u062A", nameEn: "Outerwear", sortOrder: 0 },
  { slug: "tailoring", nameAr: "\u0628\u0644\u064A\u0632\u0631\u0627\u062A \u0648\u062A\u0641\u0635\u064A\u0644", nameEn: "Tailoring", sortOrder: 1 },
  { slug: "knitwear", nameAr: "\u062A\u0631\u064A\u0643\u0648 \u0648\u0628\u0644\u0648\u0641\u0631\u0627\u062A", nameEn: "Knitwear", sortOrder: 2 },
  { slug: "shirts", nameAr: "\u0642\u0645\u0635\u0627\u0646", nameEn: "Shirts", sortOrder: 3 }
];
function rowToCategory(row) {
  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    isActive: row.isActive === 1,
    sortOrder: row.sortOrder
  };
}
function normalizeCategorySlug(raw) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
async function ensureCategoriesSeeded() {
  const existing = await db.select({ id: productCategories.id }).from(productCategories).limit(1);
  if (existing.length > 0) return;
  await db.insert(productCategories).values(
    DEFAULT_CATEGORIES.map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      isActive: 1,
      sortOrder: c.sortOrder
    }))
  ).onConflictDoNothing();
}
async function listPublicCategories() {
  await ensureCategoriesSeeded();
  const rows = await db.select().from(productCategories).where(eq(productCategories.isActive, 1)).orderBy(asc(productCategories.sortOrder), asc(productCategories.id));
  return rows.map(rowToCategory);
}
async function listAllCategoriesForStaff() {
  await ensureCategoriesSeeded();
  const rows = await db.select().from(productCategories).orderBy(asc(productCategories.sortOrder), asc(productCategories.id));
  return rows.map(rowToCategory);
}
async function categorySlugExists(slug) {
  await ensureCategoriesSeeded();
  const rows = await db.select({ id: productCategories.id }).from(productCategories).where(eq(productCategories.slug, slug)).limit(1);
  return rows.length > 0;
}
async function createCategoryForStaff(input) {
  await ensureCategoriesSeeded();
  const nameAr = input.nameAr.trim().slice(0, 80);
  const nameEn = input.nameEn.trim().slice(0, 80);
  if (!nameAr || !nameEn) {
    throw new Error("Category Arabic and English names are required.");
  }
  let slug = normalizeCategorySlug(input.slug?.trim() ? input.slug : nameEn);
  if (!slug || slug === "all") {
    slug = `cat-${Math.floor(1e3 + Math.random() * 9e3)}`;
  }
  const existing = await db.select({ id: productCategories.id }).from(productCategories).where(eq(productCategories.slug, slug)).limit(1);
  if (existing.length > 0) {
    if (input.slug?.trim()) {
      throw new Error("A category with this code already exists.");
    }
    slug = `${slug.slice(0, 34)}-${Math.floor(100 + Math.random() * 900)}`;
  }
  const allRows = await db.select({ id: productCategories.id }).from(productCategories);
  const [created] = await db.insert(productCategories).values({
    slug,
    nameAr,
    nameEn,
    isActive: 1,
    sortOrder: allRows.length
  }).returning();
  return rowToCategory(created);
}
async function updateCategoryBySlugForStaff(slug, patch) {
  await ensureCategoriesSeeded();
  const existingRows = await db.select().from(productCategories).where(eq(productCategories.slug, slug)).limit(1);
  const existing = existingRows[0];
  if (!existing) return null;
  const nextNameAr = patch.nameAr !== void 0 ? patch.nameAr.trim().slice(0, 80) : existing.nameAr;
  const nextNameEn = patch.nameEn !== void 0 ? patch.nameEn.trim().slice(0, 80) : existing.nameEn;
  if (!nextNameAr || !nextNameEn) {
    throw new Error("Category Arabic and English names are required.");
  }
  const [updated] = await db.update(productCategories).set({
    nameAr: nextNameAr,
    nameEn: nextNameEn,
    isActive: typeof patch.isActive === "boolean" ? patch.isActive ? 1 : 0 : existing.isActive
  }).where(eq(productCategories.id, existing.id)).returning();
  return rowToCategory(updated);
}
async function deleteCategoryBySlugForStaff(slug) {
  await ensureCategoriesSeeded();
  const existingRows = await db.select().from(productCategories).where(eq(productCategories.slug, slug)).limit(1);
  const existing = existingRows[0];
  if (!existing) return false;
  const assigned = await db.select({ id: productsCatalog.id }).from(productsCatalog).where(eq(productsCatalog.category, slug)).limit(1);
  if (assigned.length > 0) {
    throw new Error(
      "Cannot delete a category that still has products assigned. Reassign its products first or hide it from the storefront."
    );
  }
  await db.delete(productCategories).where(eq(productCategories.id, existing.id));
  return true;
}

// src/db/products.ts
function isValidProductCategory(raw) {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim().toLowerCase();
  return trimmed !== "all" && /^[a-z0-9][a-z0-9_-]{1,39}$/.test(trimmed);
}
function isValidImageUrl(raw) {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed.length <= 25e5;
  }
  if (trimmed.length > 1e3) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
function parseSizes(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter((s) => typeof s === "string" && s.trim().length > 0).map((s) => s.trim().slice(0, 12));
      if (cleaned.length > 0) return Array.from(new Set(cleaned));
    }
  } catch {
  }
  return ["S", "M", "L", "XL"];
}
function distributeStockAcrossSizes(sizes, totalStock) {
  const safeSizes = sizes.length > 0 ? sizes : ["M"];
  const total = Math.max(0, Math.min(1e5, Math.round(totalStock)));
  const base = Math.floor(total / safeSizes.length);
  const rem = total % safeSizes.length;
  const map = {};
  safeSizes.forEach((sz, idx) => {
    map[sz] = base + (idx < rem ? 1 : 0);
  });
  return map;
}
function parseSizeStock(sizes, rawSizeStockJson, fallbackTotalStock) {
  const safeSizes = sizes.length > 0 ? sizes : ["M"];
  if (rawSizeStockJson && rawSizeStockJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawSizeStockJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const record = parsed;
        const map = {};
        for (const sz of safeSizes) {
          const val = Number(record[sz]);
          map[sz] = Number.isFinite(val) && val >= 0 ? Math.min(1e5, Math.round(val)) : 0;
        }
        return map;
      }
    } catch {
    }
  }
  return distributeStockAcrossSizes(safeSizes, fallbackTotalStock);
}
function sumSizeStock(sizeStock) {
  return Object.values(sizeStock).reduce((sum, n) => sum + Math.max(0, Math.round(n)), 0);
}
function sanitizeSizeStockMap(sizes, rawMap) {
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) return null;
  const input = rawMap;
  const result = {};
  for (const sz of sizes) {
    const rawVal = input[sz];
    if (rawVal === void 0) {
      result[sz] = 0;
      continue;
    }
    const num = Number(rawVal);
    if (!Number.isFinite(num) || num < 0 || num > 1e5) {
      throw new Error(`Stock for size ${sz} must be between 0 and 100,000.`);
    }
    result[sz] = Math.round(num);
  }
  return result;
}
function rowToProduct(row) {
  const category = isValidProductCategory(row.category) ? row.category.trim().toLowerCase() : "outerwear";
  const sizes = parseSizes(row.sizesJson);
  const sizeStock = parseSizeStock(sizes, row.sizeStockJson, row.stockQty);
  const totalStock = sumSizeStock(sizeStock);
  const product = {
    id: row.productId,
    sku: row.sku,
    category,
    image: row.image,
    priceEgp: row.priceEgp,
    stockQty: totalStock,
    sizeStock,
    isActive: row.isActive === 1,
    sizes,
    title: {
      ar: row.titleAr,
      en: row.titleEn
    },
    subtitle: {
      ar: row.subtitleAr,
      en: row.subtitleEn
    },
    color: {
      ar: row.colorAr,
      en: row.colorEn,
      hex: row.colorHex
    },
    fabric: {
      ar: row.fabricAr,
      en: row.fabricEn
    },
    description: {
      ar: row.descriptionAr,
      en: row.descriptionEn
    }
  };
  if (row.tagAr || row.tagEn) {
    product.tag = {
      ar: row.tagAr || row.tagEn || "",
      en: row.tagEn || row.tagAr || ""
    };
  }
  return product;
}
async function ensureCatalogSeeded() {
  const existing = await db.select({ id: productsCatalog.id }).from(productsCatalog).limit(1);
  if (existing.length > 0) return;
  await db.insert(productsCatalog).values(
    PRODUCTS.map((p, idx) => {
      const sizeStock = distributeStockAcrossSizes(p.sizes, 15);
      return {
        productId: p.id,
        sku: p.sku,
        category: p.category,
        image: p.image,
        priceEgp: p.priceEgp,
        stockQty: sumSizeStock(sizeStock),
        sizesJson: JSON.stringify(p.sizes),
        sizeStockJson: JSON.stringify(sizeStock),
        tagAr: p.tag?.ar ?? null,
        tagEn: p.tag?.en ?? null,
        titleAr: p.title.ar,
        titleEn: p.title.en,
        subtitleAr: p.subtitle.ar,
        subtitleEn: p.subtitle.en,
        colorAr: p.color.ar,
        colorEn: p.color.en,
        colorHex: p.color.hex,
        fabricAr: p.fabric.ar,
        fabricEn: p.fabric.en,
        descriptionAr: p.description.ar,
        descriptionEn: p.description.en,
        isActive: 1,
        sortOrder: idx
      };
    })
  ).onConflictDoNothing();
}
async function listPublicProducts() {
  await ensureCatalogSeeded();
  const [rows, publicCats] = await Promise.all([
    db.select().from(productsCatalog).where(eq2(productsCatalog.isActive, 1)).orderBy(asc2(productsCatalog.sortOrder), asc2(productsCatalog.id)),
    listPublicCategories()
  ]);
  const activeCategorySlugs = new Set(publicCats.map((c) => c.slug));
  return rows.filter((r) => activeCategorySlugs.size === 0 || activeCategorySlugs.has(r.category)).map(rowToProduct);
}
async function listAllProductsForStaff() {
  await ensureCatalogSeeded();
  await ensureCategoriesSeeded();
  const rows = await db.select().from(productsCatalog).orderBy(asc2(productsCatalog.sortOrder), asc2(productsCatalog.id));
  return rows.map(rowToProduct);
}
async function updateProductByIdForStaff(productId, patch) {
  await ensureCatalogSeeded();
  const existingRows = await db.select().from(productsCatalog).where(eq2(productsCatalog.productId, productId)).limit(1);
  const existing = existingRows[0];
  if (!existing) return null;
  if (patch.image !== void 0 && !isValidImageUrl(patch.image)) {
    throw new Error("Invalid image URL or path.");
  }
  const nextPrice = patch.priceEgp !== void 0 ? Math.round(patch.priceEgp) : existing.priceEgp;
  if (!Number.isFinite(nextPrice) || nextPrice < 0 || nextPrice > 5e6) {
    throw new Error("Price must be between 0 and 5,000,000 EGP.");
  }
  const currentSizes = parseSizes(existing.sizesJson);
  const currentSizeStock = parseSizeStock(currentSizes, existing.sizeStockJson, existing.stockQty);
  const cleanedPatchSizes = patch.sizes && patch.sizes.length > 0 ? Array.from(
    new Set(
      patch.sizes.map((s) => s.trim().slice(0, 12)).filter(Boolean)
    )
  ).slice(0, 10) : null;
  const nextSizes = cleanedPatchSizes && cleanedPatchSizes.length > 0 ? cleanedPatchSizes : currentSizes;
  let nextSizeStock;
  if (patch.sizeStock !== void 0) {
    const sanitized = sanitizeSizeStockMap(nextSizes, patch.sizeStock);
    if (!sanitized) {
      throw new Error("Invalid per-size stock map.");
    }
    nextSizeStock = sanitized;
  } else if (patch.stockQty !== void 0) {
    const requestedTotal = Math.round(patch.stockQty);
    if (!Number.isFinite(requestedTotal) || requestedTotal < 0 || requestedTotal > 1e5) {
      throw new Error("Stock quantity must be between 0 and 100,000.");
    }
    nextSizeStock = distributeStockAcrossSizes(nextSizes, requestedTotal);
  } else if (cleanedPatchSizes) {
    nextSizeStock = {};
    for (const sz of nextSizes) {
      nextSizeStock[sz] = currentSizeStock[sz] ?? 0;
    }
  } else {
    nextSizeStock = currentSizeStock;
  }
  const nextStock = sumSizeStock(nextSizeStock);
  const nextTitleAr = patch.titleAr !== void 0 ? patch.titleAr.trim() : existing.titleAr;
  const nextTitleEn = patch.titleEn !== void 0 ? patch.titleEn.trim() : existing.titleEn;
  if (!nextTitleAr || !nextTitleEn) {
    throw new Error("Arabic and English display titles are required.");
  }
  let nextCategory = existing.category;
  if (patch.category !== void 0) {
    if (!isValidProductCategory(patch.category)) {
      throw new Error("Invalid category.");
    }
    const candidateCat = patch.category.trim().toLowerCase();
    if (!await categorySlugExists(candidateCat)) {
      throw new Error("Selected category does not exist.");
    }
    nextCategory = candidateCat;
  }
  const [updated] = await db.update(productsCatalog).set({
    titleAr: nextTitleAr.slice(0, 140),
    titleEn: nextTitleEn.slice(0, 140),
    subtitleAr: patch.subtitleAr !== void 0 ? patch.subtitleAr.trim().slice(0, 180) || existing.subtitleAr : existing.subtitleAr,
    subtitleEn: patch.subtitleEn !== void 0 ? patch.subtitleEn.trim().slice(0, 180) || existing.subtitleEn : existing.subtitleEn,
    priceEgp: nextPrice,
    stockQty: nextStock,
    image: patch.image !== void 0 ? patch.image.trim() : existing.image,
    category: nextCategory,
    sizesJson: JSON.stringify(nextSizes),
    sizeStockJson: JSON.stringify(nextSizeStock),
    tagAr: patch.tagAr !== void 0 ? patch.tagAr?.trim().slice(0, 40) || null : existing.tagAr,
    tagEn: patch.tagEn !== void 0 ? patch.tagEn?.trim().slice(0, 40) || null : existing.tagEn,
    descriptionAr: patch.descriptionAr !== void 0 ? patch.descriptionAr.trim().slice(0, 800) || existing.descriptionAr : existing.descriptionAr,
    descriptionEn: patch.descriptionEn !== void 0 ? patch.descriptionEn.trim().slice(0, 800) || existing.descriptionEn : existing.descriptionEn,
    isActive: typeof patch.isActive === "boolean" ? patch.isActive ? 1 : 0 : existing.isActive,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(productsCatalog.id, existing.id)).returning();
  return rowToProduct(updated);
}
async function createProductForStaff(input) {
  await ensureCatalogSeeded();
  await ensureCategoriesSeeded();
  const cleanSku = input.sku.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  if (!cleanSku) {
    throw new Error("Valid SKU is required (e.g. MRY-090).");
  }
  const normalizedCategory = isValidProductCategory(input.category) ? input.category.trim().toLowerCase() : "outerwear";
  if (!await categorySlugExists(normalizedCategory)) {
    throw new Error("Selected category does not exist.");
  }
  if (!isValidImageUrl(input.image)) {
    throw new Error("Valid product image URL or uploaded image path is required.");
  }
  const titleAr = input.titleAr.trim().slice(0, 140);
  const titleEn = input.titleEn.trim().slice(0, 140);
  if (!titleAr || !titleEn) {
    throw new Error("Arabic and English product names are required.");
  }
  const priceEgp = Math.round(input.priceEgp);
  if (!Number.isFinite(priceEgp) || priceEgp < 0 || priceEgp > 5e6) {
    throw new Error("Invalid price.");
  }
  const cleanSizes = input.sizes.length > 0 ? Array.from(new Set(input.sizes.map((s) => s.trim().slice(0, 12)).filter(Boolean))).slice(0, 10) : ["S", "M", "L", "XL"];
  let sizeStock;
  if (input.sizeStock) {
    const sanitized = sanitizeSizeStockMap(cleanSizes, input.sizeStock);
    if (!sanitized) {
      throw new Error("Invalid per-size stock.");
    }
    sizeStock = sanitized;
  } else {
    const fallbackTotal = Math.round(input.stockQty ?? 16);
    if (!Number.isFinite(fallbackTotal) || fallbackTotal < 0 || fallbackTotal > 1e5) {
      throw new Error("Invalid stock quantity.");
    }
    sizeStock = distributeStockAcrossSizes(cleanSizes, fallbackTotal);
  }
  const stockQty = sumSizeStock(sizeStock);
  const slugBase = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  const productId = `${slugBase || "piece"}-${Math.floor(100 + Math.random() * 900)}`;
  const existingCountRows = await db.select({ id: productsCatalog.id }).from(productsCatalog);
  const [created] = await db.insert(productsCatalog).values({
    productId,
    sku: cleanSku,
    category: normalizedCategory,
    image: input.image.trim(),
    priceEgp,
    stockQty,
    sizesJson: JSON.stringify(cleanSizes),
    sizeStockJson: JSON.stringify(sizeStock),
    tagAr: input.tagAr?.trim().slice(0, 40) || null,
    tagEn: input.tagEn?.trim().slice(0, 40) || null,
    titleAr,
    titleEn,
    subtitleAr: input.subtitleAr.trim().slice(0, 180) || titleAr,
    subtitleEn: input.subtitleEn.trim().slice(0, 180) || titleEn,
    colorAr: input.colorAr?.trim().slice(0, 60) || "\u0623\u0633\u0648\u062F \u0643\u0644\u0627\u0633\u064A\u0643\u064A",
    colorEn: input.colorEn?.trim().slice(0, 60) || "Classic Obsidian",
    colorHex: /^#[0-9A-Fa-f]{6}$/.test(input.colorHex || "") ? input.colorHex : "#181B20",
    fabricAr: input.fabricAr?.trim().slice(0, 180) || "\u062E\u0627\u0645\u0629 \u0637\u0628\u064A\u0639\u064A\u0629 \u0641\u0627\u062E\u0631\u0629 \u0645\u0646 \u062F\u0627\u0631 \u0645\u064E\u0631\u0627\u064A\u0627",
    fabricEn: input.fabricEn?.trim().slice(0, 180) || "MARAYA Signature Natural Textile",
    descriptionAr: input.descriptionAr?.trim().slice(0, 800) || titleAr,
    descriptionEn: input.descriptionEn?.trim().slice(0, 800) || titleEn,
    isActive: 1,
    sortOrder: existingCountRows.length
  }).returning();
  return rowToProduct(created);
}

// src/db/orders.ts
var InsufficientStockError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "InsufficientStockError";
  }
};
async function createOrderRecord(input) {
  await ensureCatalogSeeded();
  try {
    return await db.transaction(async (tx) => {
      let computedSubtotal = 0;
      let matchedCatalogItems = 0;
      const skuStates = /* @__PURE__ */ new Map();
      for (const item of input.items) {
        let state = skuStates.get(item.sku);
        if (!state) {
          const [catalogItem] = await tx.select().from(productsCatalog).where(eq3(productsCatalog.sku, item.sku)).for("update").limit(1);
          if (catalogItem) {
            let sizes = [];
            try {
              const parsed = JSON.parse(catalogItem.sizesJson);
              if (Array.isArray(parsed)) {
                sizes = parsed.filter((s) => typeof s === "string");
              }
            } catch {
              sizes = ["S", "M", "L", "XL"];
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
              sizeStock
            };
            skuStates.set(item.sku, state);
          }
        }
        if (state) {
          matchedCatalogItems += 1;
          const availableForSize = state.sizeStock[item.size] ?? 0;
          if (state.isActive !== 1 || availableForSize < item.quantity) {
            throw new InsufficientStockError(
              `Insufficient stock for ${item.title} (${item.size}) \u2014 available: ${Math.max(0, availableForSize)}.`
            );
          }
          state.sizeStock[item.size] = availableForSize - item.quantity;
          computedSubtotal += state.priceEgp * item.quantity;
        }
      }
      for (const state of skuStates.values()) {
        await tx.update(productsCatalog).set({
          sizeStockJson: JSON.stringify(state.sizeStock),
          stockQty: sumSizeStock(state.sizeStock),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(productsCatalog.id, state.id));
      }
      const authoritativeTotal = matchedCatalogItems === input.items.length && computedSubtotal > 0 ? computedSubtotal + (computedSubtotal >= 15e3 ? 0 : 150) : input.totalAmount;
      const [insertedOrder] = await tx.insert(orders).values({
        orderRef: input.orderRef,
        userId: input.userId ?? null,
        fullName: input.fullName,
        phone: input.phone,
        address: input.address,
        notes: input.notes,
        paymentMethod: input.paymentMethod,
        currency: input.currency,
        totalAmount: authoritativeTotal,
        status: "confirmed"
      }).returning();
      if (input.items.length > 0) {
        await tx.insert(orderItems).values(
          input.items.map((item) => ({
            orderId: insertedOrder.id,
            sku: item.sku,
            title: item.title,
            size: item.size,
            quantity: item.quantity
          }))
        );
      }
      return insertedOrder;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      throw error;
    }
    console.error("Database order creation failed:", error);
    throw new Error("Unable to save your order right now. Please try again.", {
      cause: error
    });
  }
}
async function getOrdersForUid(uid) {
  try {
    const userRows = await db.select().from(users).where(eq3(users.uid, uid)).limit(1);
    const user = userRows[0];
    if (!user) return [];
    const userOrders = await db.select().from(orders).where(eq3(orders.userId, user.id)).orderBy(desc(orders.createdAt));
    const results = [];
    for (const order of userOrders) {
      const items = await db.select().from(orderItems).where(eq3(orderItems.orderId, order.id));
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
        items
      });
    }
    return results;
  } catch (error) {
    console.error("Database order fetch failed:", error);
    throw new Error("Unable to load order history. Please try again later.", {
      cause: error
    });
  }
}
var ALLOWED_ORDER_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled"
];
function isValidOrderStatus(value) {
  return typeof value === "string" && ALLOWED_ORDER_STATUSES.includes(value);
}
async function getAllOrdersForStaff() {
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const [allItems, allStaffNotes] = await Promise.all([
    db.select().from(orderItems),
    db.select().from(orderStaffNotes).orderBy(desc(orderStaffNotes.createdAt))
  ]);
  const itemsByOrderId = /* @__PURE__ */ new Map();
  for (const item of allItems) {
    const bucket = itemsByOrderId.get(item.orderId) ?? [];
    bucket.push(item);
    itemsByOrderId.set(item.orderId, bucket);
  }
  const notesByOrderId = /* @__PURE__ */ new Map();
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
    staffNotesList: notesByOrderId.get(order.id) ?? []
  }));
}
async function addOrderStaffNote(input) {
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq3(orders.orderRef, input.orderRef)).limit(1);
  if (!order) return null;
  const [inserted] = await db.insert(orderStaffNotes).values({
    orderId: order.id,
    staffEmail: input.staffEmail,
    staffName: input.staffName,
    note: input.note
  }).returning();
  return inserted ?? null;
}
async function deleteOrderStaffNote(input) {
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq3(orders.orderRef, input.orderRef)).limit(1);
  if (!order) return false;
  const deleted = await db.delete(orderStaffNotes).where(
    and(
      eq3(orderStaffNotes.id, input.noteId),
      eq3(orderStaffNotes.orderId, order.id)
    )
  ).returning({ id: orderStaffNotes.id });
  return deleted.length > 0;
}
async function updateOrderStatusByRef(orderRef, nextStatus) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq3(orders.orderRef, orderRef)).limit(1);
    if (!existing) return null;
    const wasCancelled = existing.status === "cancelled";
    const willCancel = nextStatus === "cancelled";
    if (wasCancelled !== willCancel) {
      const items = await tx.select().from(orderItems).where(eq3(orderItems.orderId, existing.id));
      for (const item of items) {
        const [catalogItem] = await tx.select().from(productsCatalog).where(eq3(productsCatalog.sku, item.sku)).for("update").limit(1);
        if (!catalogItem) continue;
        let sizes = [];
        try {
          const parsed = JSON.parse(catalogItem.sizesJson);
          if (Array.isArray(parsed)) {
            sizes = parsed.filter((s) => typeof s === "string");
          }
        } catch {
          sizes = ["S", "M", "L", "XL"];
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
        await tx.update(productsCatalog).set({
          sizeStockJson: JSON.stringify(sizeStock),
          stockQty: sumSizeStock(sizeStock),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(productsCatalog.id, catalogItem.id));
      }
    }
    const [updated] = await tx.update(orders).set({ status: nextStatus }).where(eq3(orders.id, existing.id)).returning();
    return updated ?? null;
  });
}
async function getSalesSummaryForStaff() {
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
    if (st === "cancelled" || st === "canceled") {
      cancelledOrders += 1;
      continue;
    }
    nonCancelledOrders += 1;
    const amt = order.currency === "EGP" ? order.totalAmount : 0;
    totalSalesEgp += amt;
    if (order.paymentMethod === "card") {
      cardSalesEgp += amt;
    } else {
      codSalesEgp += amt;
    }
    if (st === "delivered" || st === "completed") {
      deliveredOrders += 1;
      deliveredSalesEgp += amt;
    } else if (st === "shipped" || st === "in_transit" || st === "out_for_delivery") {
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
    averageOrderValueEgp: nonCancelledOrders > 0 ? Math.round(totalSalesEgp / nonCancelledOrders) : 0
  };
}

// src/db/staff.ts
import { asc as asc3, eq as eq4 } from "drizzle-orm";
var BOOTSTRAP_ADMIN_EMAIL = (process.env.STAFF_ADMIN_EMAIL || "tameermohamed17@gmail.com").trim().toLowerCase();
function normalizeRole(raw) {
  if (raw === "admin" || raw === "manager" || raw === "operations" || raw === "viewer") {
    return raw;
  }
  return "operations";
}
function toDto(row) {
  const normalizedEmail = row.email.trim().toLowerCase();
  return {
    id: row.id,
    email: normalizedEmail,
    displayName: row.displayName,
    role: normalizeRole(row.role),
    canViewOrders: row.canViewOrders === 1,
    canUpdateOrderStatus: row.canUpdateOrderStatus === 1,
    canViewSales: row.canViewSales === 1,
    canManageStaff: row.canManageStaff === 1,
    canManageProducts: row.canManageProducts === 1,
    isActive: row.isActive === 1,
    isBootstrapAdmin: normalizedEmail === BOOTSTRAP_ADMIN_EMAIL,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
async function ensureBootstrapAdmin(displayName) {
  const existing = await db.select().from(staffMembers).where(eq4(staffMembers.email, BOOTSTRAP_ADMIN_EMAIL)).limit(1);
  if (existing[0]) {
    if (existing[0].role !== "admin" || existing[0].canViewOrders !== 1 || existing[0].canUpdateOrderStatus !== 1 || existing[0].canViewSales !== 1 || existing[0].canManageStaff !== 1 || existing[0].canManageProducts !== 1 || existing[0].isActive !== 1) {
      const [updated] = await db.update(staffMembers).set({
        role: "admin",
        displayName: displayName ?? existing[0].displayName,
        canViewOrders: 1,
        canUpdateOrderStatus: 1,
        canViewSales: 1,
        canManageStaff: 1,
        canManageProducts: 1,
        isActive: 1,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(staffMembers.id, existing[0].id)).returning();
      return toDto(updated);
    }
    if (displayName && !existing[0].displayName) {
      const [updated] = await db.update(staffMembers).set({ displayName, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(staffMembers.id, existing[0].id)).returning();
      return toDto(updated);
    }
    return toDto(existing[0]);
  }
  const [created] = await db.insert(staffMembers).values({
    email: BOOTSTRAP_ADMIN_EMAIL,
    displayName: displayName ?? "MARAYA Admin",
    role: "admin",
    canViewOrders: 1,
    canUpdateOrderStatus: 1,
    canViewSales: 1,
    canManageStaff: 1,
    canManageProducts: 1,
    isActive: 1
  }).onConflictDoUpdate({
    target: staffMembers.email,
    set: {
      role: "admin",
      canViewOrders: 1,
      canUpdateOrderStatus: 1,
      canViewSales: 1,
      canManageStaff: 1,
      canManageProducts: 1,
      isActive: 1,
      updatedAt: /* @__PURE__ */ new Date()
    }
  }).returning();
  return toDto(created);
}
function isTransientDbError(err) {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String(err.code || "") : "";
  const msg = err instanceof Error ? err.message : String(err);
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOENT" || code === "ETIMEDOUT" || code === "57P01" || msg.includes("Connection terminated") || msg.includes("connect ECONNREFUSED") || msg.includes("timeout exceeded");
}
async function withDbRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1 && isTransientDbError(err)) {
        await new Promise((r) => setTimeout(r, 350 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
async function getStaffMemberByEmail(rawEmail, displayName) {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;
  return withDbRetry(async () => {
    if (email === BOOTSTRAP_ADMIN_EMAIL) {
      return ensureBootstrapAdmin(displayName);
    }
    const rows = await db.select().from(staffMembers).where(eq4(staffMembers.email, email)).limit(1);
    if (!rows[0]) return null;
    if (displayName && rows[0].displayName !== displayName) {
      const [updated] = await db.update(staffMembers).set({ displayName, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(staffMembers.id, rows[0].id)).returning();
      return toDto(updated);
    }
    return toDto(rows[0]);
  });
}
async function listStaffMembers() {
  await ensureBootstrapAdmin();
  const rows = await db.select().from(staffMembers).orderBy(asc3(staffMembers.id));
  return rows.map(toDto);
}
async function upsertStaffMember(input) {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Valid Google email is required.");
  }
  if (email === BOOTSTRAP_ADMIN_EMAIL) {
    return ensureBootstrapAdmin(input.displayName);
  }
  const [saved] = await db.insert(staffMembers).values({
    email,
    displayName: input.displayName?.trim() || null,
    role: normalizeRole(input.role),
    canViewOrders: input.canViewOrders ? 1 : 0,
    canUpdateOrderStatus: input.canUpdateOrderStatus ? 1 : 0,
    canViewSales: input.canViewSales ? 1 : 0,
    canManageStaff: input.canManageStaff ? 1 : 0,
    canManageProducts: input.canManageProducts ? 1 : 0,
    isActive: input.isActive ? 1 : 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).onConflictDoUpdate({
    target: staffMembers.email,
    set: {
      displayName: input.displayName?.trim() || null,
      role: normalizeRole(input.role),
      canViewOrders: input.canViewOrders ? 1 : 0,
      canUpdateOrderStatus: input.canUpdateOrderStatus ? 1 : 0,
      canViewSales: input.canViewSales ? 1 : 0,
      canManageStaff: input.canManageStaff ? 1 : 0,
      canManageProducts: input.canManageProducts ? 1 : 0,
      isActive: input.isActive ? 1 : 0,
      updatedAt: /* @__PURE__ */ new Date()
    }
  }).returning();
  return toDto(saved);
}
async function updateStaffMemberById(id, patch) {
  const rows = await db.select().from(staffMembers).where(eq4(staffMembers.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) return null;
  if (existing.email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
    return ensureBootstrapAdmin(patch.displayName ?? existing.displayName);
  }
  const nextCanManageStaff = typeof patch.canManageStaff === "boolean" ? patch.canManageStaff : existing.canManageStaff === 1;
  const nextIsActive = typeof patch.isActive === "boolean" ? patch.isActive : existing.isActive === 1;
  if (!nextCanManageStaff || !nextIsActive) {
    const all = await listStaffMembers();
    const otherActiveAdmins = all.filter(
      (m) => m.id !== id && m.isActive && m.canManageStaff
    );
    if (otherActiveAdmins.length === 0) {
      throw new Error("Cannot disable the last active administrator.");
    }
  }
  const [updated] = await db.update(staffMembers).set({
    displayName: patch.displayName !== void 0 ? patch.displayName?.trim() || null : existing.displayName,
    role: patch.role !== void 0 ? normalizeRole(patch.role) : existing.role,
    canViewOrders: typeof patch.canViewOrders === "boolean" ? patch.canViewOrders ? 1 : 0 : existing.canViewOrders,
    canUpdateOrderStatus: typeof patch.canUpdateOrderStatus === "boolean" ? patch.canUpdateOrderStatus ? 1 : 0 : existing.canUpdateOrderStatus,
    canViewSales: typeof patch.canViewSales === "boolean" ? patch.canViewSales ? 1 : 0 : existing.canViewSales,
    canManageStaff: nextCanManageStaff ? 1 : 0,
    canManageProducts: typeof patch.canManageProducts === "boolean" ? patch.canManageProducts ? 1 : 0 : existing.canManageProducts,
    isActive: nextIsActive ? 1 : 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq4(staffMembers.id, id)).returning();
  return toDto(updated);
}
async function deleteStaffMemberById(id, actorEmail) {
  const rows = await db.select().from(staffMembers).where(eq4(staffMembers.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) return false;
  const targetEmail = existing.email.trim().toLowerCase();
  if (targetEmail === BOOTSTRAP_ADMIN_EMAIL) {
    throw new Error("Primary administrator cannot be removed.");
  }
  if (targetEmail === actorEmail.trim().toLowerCase()) {
    throw new Error("You cannot remove your own active staff account.");
  }
  await db.delete(staffMembers).where(eq4(staffMembers.id, id));
  return true;
}

// src/apiApp.ts
var PRODUCT_UPLOADS_DIR = path2.resolve(process.cwd(), "public", "uploads", "products");
function parseSizeStockPayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const result = {};
  for (const [k, v] of Object.entries(raw)) {
    const cleanKey = k.trim().slice(0, 12);
    const num = Number(v);
    if (cleanKey && Number.isFinite(num)) {
      result[cleanKey] = Math.max(0, Math.round(num));
    }
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
async function resolveVerifiedStaff(req, res, requiredPermission) {
  const email = typeof req.user?.email === "string" ? req.user.email.trim().toLowerCase() : "";
  const emailVerified = req.user?.email_verified === true;
  if (!email || !emailVerified) {
    res.status(403).json({ error: "Verified Google account email is required for staff access." });
    return null;
  }
  const displayName = typeof req.user?.name === "string" ? req.user.name : null;
  const staff = await getStaffMemberByEmail(email, displayName);
  if (!staff || !staff.isActive) {
    res.status(403).json({
      error: "Access denied: Your Google account does not have active staff permissions."
    });
    return null;
  }
  if (requiredPermission && !staff[requiredPermission]) {
    res.status(403).json({
      error: `Access denied: Missing required permission (${requiredPermission}).`
    });
    return null;
  }
  return staff;
}
function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/maps/key", (_req, res) => {
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
    res.json({ apiKey });
  });
  app.get("/api/maps/reverse-geocode", async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const lang = req.query.lang === "en" ? "en" : "ar";
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: "Invalid coordinates." });
      return;
    }
    const inEgypt = lat >= 21.99 && lat <= 31.92 && lng >= 24.7 && lng <= 36.9;
    const coordsLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const fallbackAddress = lang === "ar" ? `\u0645\u0648\u0642\u0639\u064A \u0627\u0644\u062D\u0627\u0644\u064A (${coordsLabel})` : `Current GPS Location (${coordsLabel})`;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
    if (!apiKey) {
      res.json({
        address: fallbackAddress,
        lat,
        lng,
        inEgypt,
        coordinatesOnly: true
      });
      return;
    }
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${lat},${lng}`);
      url.searchParams.set("language", lang);
      url.searchParams.set("region", "eg");
      url.searchParams.set("key", apiKey);
      const geoRes = await fetch(url.toString());
      if (geoRes.status === 429) {
        res.status(429).json({
          error: "RESOURCE_EXHAUSTED",
          quotaExceeded: true,
          address: fallbackAddress,
          lat,
          lng,
          inEgypt,
          coordinatesOnly: true
        });
        return;
      }
      const data = await geoRes.json();
      if (data.status === "OVER_QUERY_LIMIT") {
        res.status(429).json({
          error: "OVER_QUERY_LIMIT",
          quotaExceeded: true,
          address: fallbackAddress,
          lat,
          lng,
          inEgypt,
          coordinatesOnly: true
        });
        return;
      }
      const formatted = data.results?.[0]?.formatted_address?.trim();
      if (data.status === "OK" && formatted) {
        res.json({
          address: formatted,
          lat,
          lng,
          inEgypt,
          coordinatesOnly: false
        });
        return;
      }
      res.json({
        address: fallbackAddress,
        lat,
        lng,
        inEgypt,
        coordinatesOnly: true
      });
    } catch {
      res.json({
        address: fallbackAddress,
        lat,
        lng,
        inEgypt,
        coordinatesOnly: true
      });
    }
  });
  app.get("/api/products", async (_req, res) => {
    try {
      await ensureDatabaseSchema();
      const [products, categories] = await Promise.all([
        listPublicProducts(),
        listPublicCategories()
      ]);
      res.json({ products, categories });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load catalog.";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/me/sync", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const dbUser = await getOrCreateUser(
        uid,
        req.user?.email ?? `${uid}@maraya.local`,
        typeof req.user?.name === "string" ? req.user.name : null
      );
      res.json({ user: dbUser });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync user.";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      await getOrCreateUser(
        uid,
        req.user?.email ?? `${uid}@maraya.local`,
        typeof req.user?.name === "string" ? req.user.name : null
      );
      const list = await getOrdersForUid(uid);
      res.json({ orders: list });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to fetch orders.";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/orders", optionalAuth, async (req, res) => {
    const body = req.body;
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const paymentMethod = body.paymentMethod === "card" ? "card" : "cod";
    const currency = body.currency === "USD" ? "USD" : "EGP";
    const totalAmount = typeof body.totalAmount === "number" && Number.isFinite(body.totalAmount) ? Math.max(0, Math.round(body.totalAmount)) : 0;
    if (!fullName || !phone || !address || !Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "Missing required order fields." });
      return;
    }
    const parsedItems = body.items.map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item;
      const sku = typeof obj.sku === "string" ? obj.sku.trim() : "";
      const title = typeof obj.title === "string" ? obj.title.trim() : "";
      const size = typeof obj.size === "string" ? obj.size.trim() : "";
      const quantity = typeof obj.quantity === "number" && obj.quantity > 0 ? Math.round(obj.quantity) : 0;
      if (!sku || !title || !size || quantity <= 0) return null;
      return { sku, title, size, quantity };
    }).filter((x) => x !== null);
    if (parsedItems.length === 0) {
      res.status(400).json({ error: "Invalid order items." });
      return;
    }
    const orderRef = `MRY-${Math.floor(1e3 + Math.random() * 9e3)}`;
    try {
      await ensureDatabaseSchema();
      let userId = null;
      if (req.user?.uid) {
        const dbUser = await getOrCreateUser(
          req.user.uid,
          req.user.email ?? `${req.user.uid}@maraya.local`,
          typeof req.user.name === "string" ? req.user.name : null
        );
        userId = dbUser?.id ?? null;
      }
      const createdOrder = await createOrderRecord({
        orderRef,
        userId,
        fullName,
        phone,
        address,
        notes,
        paymentMethod,
        currency,
        totalAmount,
        items: parsedItems
      });
      res.status(201).json({
        orderRef,
        fullName,
        phone,
        address,
        notes,
        totalAmount: createdOrder.totalAmount
      });
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        res.status(409).json({ error: error.message });
        return;
      }
      console.error("Order persistence failed:", error);
      const message = error instanceof Error ? error.message : "Unable to save order right now.";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/staff/me", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const email = typeof req.user?.email === "string" ? req.user.email.trim().toLowerCase() : "";
      const emailVerified = req.user?.email_verified === true;
      if (!email || !emailVerified) {
        res.json({ isStaff: false, staff: null, email: email || null, emailVerified });
        return;
      }
      const displayName = typeof req.user?.name === "string" ? req.user.name : null;
      const staff = await getStaffMemberByEmail(email, displayName);
      if (!staff || !staff.isActive) {
        res.json({ isStaff: false, staff: null, email, emailVerified });
        return;
      }
      res.json({ isStaff: true, staff, email, emailVerified });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify staff profile.";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/staff/orders", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canViewOrders");
      if (!staff) return;
      const ordersList = await getAllOrdersForStaff();
      res.json({ orders: ordersList });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load staff orders.";
      res.status(500).json({ error: message });
    }
  });
  app.patch(
    "/api/staff/orders/:orderRef/status",
    requireAuth,
    async (req, res) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, "canUpdateOrderStatus");
        if (!staff) return;
        const orderRef = typeof req.params.orderRef === "string" ? req.params.orderRef.trim() : "";
        if (!orderRef || orderRef.length > 40) {
          res.status(400).json({ error: "Invalid order reference." });
          return;
        }
        const body = req.body;
        if (!isValidOrderStatus(body.status)) {
          res.status(400).json({ error: "Invalid order status value." });
          return;
        }
        const updated = await updateOrderStatusByRef(orderRef, body.status);
        if (!updated) {
          res.status(404).json({ error: "Order not found." });
          return;
        }
        res.json({ order: updated });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update order status.";
        res.status(500).json({ error: message });
      }
    }
  );
  app.post(
    "/api/staff/orders/:orderRef/notes",
    requireAuth,
    async (req, res) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, "canUpdateOrderStatus");
        if (!staff) return;
        const orderRef = typeof req.params.orderRef === "string" ? req.params.orderRef.trim() : "";
        if (!orderRef || orderRef.length > 40) {
          res.status(400).json({ error: "Invalid order reference." });
          return;
        }
        const body = req.body;
        const note = typeof body.note === "string" ? body.note.trim() : "";
        if (!note || note.length > 1e3) {
          res.status(400).json({ error: "Please provide a valid note (1-1000 characters)." });
          return;
        }
        const created = await addOrderStaffNote({
          orderRef,
          staffEmail: staff.email,
          staffName: staff.displayName || (typeof req.user?.name === "string" ? req.user.name : null),
          note
        });
        if (!created) {
          res.status(404).json({ error: "Order not found." });
          return;
        }
        res.status(201).json({ note: created });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save staff note.";
        res.status(500).json({ error: message });
      }
    }
  );
  app.delete(
    "/api/staff/orders/:orderRef/notes/:noteId",
    requireAuth,
    async (req, res) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, "canUpdateOrderStatus");
        if (!staff) return;
        const orderRef = typeof req.params.orderRef === "string" ? req.params.orderRef.trim() : "";
        const noteId = Number(req.params.noteId);
        if (!orderRef || orderRef.length > 40 || !Number.isInteger(noteId) || noteId <= 0) {
          res.status(400).json({ error: "Invalid note parameters." });
          return;
        }
        const deleted = await deleteOrderStaffNote({ orderRef, noteId });
        if (!deleted) {
          res.status(404).json({ error: "Staff note not found." });
          return;
        }
        res.json({ deleted: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to delete staff note.";
        res.status(500).json({ error: message });
      }
    }
  );
  app.get("/api/staff/sales", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canViewSales");
      if (!staff) return;
      const summary = await getSalesSummaryForStaff();
      res.json({ summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to compute sales summary.";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/staff/members", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canManageStaff");
      if (!staff) return;
      const members = await listStaffMembers();
      res.json({ members });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load staff members.";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/staff/members", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canManageStaff");
      if (!staff) return;
      const body = req.body;
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
        res.status(400).json({ error: "Please provide a valid Google email address." });
        return;
      }
      const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : null;
      const created = await upsertStaffMember({
        email,
        displayName,
        role: normalizeRole(body.role),
        canViewOrders: body.canViewOrders !== false,
        canUpdateOrderStatus: body.canUpdateOrderStatus === true,
        canViewSales: body.canViewSales === true,
        canManageStaff: body.canManageStaff === true,
        canManageProducts: body.canManageProducts === true,
        isActive: body.isActive !== false
      });
      res.status(201).json({ member: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save staff member.";
      res.status(400).json({ error: message });
    }
  });
  app.patch("/api/staff/members/:id", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canManageStaff");
      if (!staff) return;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Invalid staff member ID." });
        return;
      }
      const body = req.body;
      const updated = await updateStaffMemberById(id, {
        displayName: typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : void 0,
        role: body.role !== void 0 ? normalizeRole(body.role) : void 0,
        canViewOrders: typeof body.canViewOrders === "boolean" ? body.canViewOrders : void 0,
        canUpdateOrderStatus: typeof body.canUpdateOrderStatus === "boolean" ? body.canUpdateOrderStatus : void 0,
        canViewSales: typeof body.canViewSales === "boolean" ? body.canViewSales : void 0,
        canManageStaff: typeof body.canManageStaff === "boolean" ? body.canManageStaff : void 0,
        canManageProducts: typeof body.canManageProducts === "boolean" ? body.canManageProducts : void 0,
        isActive: typeof body.isActive === "boolean" ? body.isActive : void 0
      });
      if (!updated) {
        res.status(404).json({ error: "Staff member not found." });
        return;
      }
      res.json({ member: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update staff permissions.";
      res.status(400).json({ error: message });
    }
  });
  app.delete("/api/staff/members/:id", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canManageStaff");
      if (!staff) return;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Invalid staff member ID." });
        return;
      }
      const deleted = await deleteStaffMemberById(id, staff.email);
      if (!deleted) {
        res.status(404).json({ error: "Staff member not found." });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete staff member.";
      res.status(400).json({ error: message });
    }
  });
  app.get("/api/staff/products", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canManageProducts");
      if (!staff) return;
      const [products, categories] = await Promise.all([
        listAllProductsForStaff(),
        listAllCategoriesForStaff()
      ]);
      res.json({ products, categories });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load products catalog.";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/staff/categories", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canManageProducts");
      if (!staff) return;
      const categories = await listAllCategoriesForStaff();
      res.json({ categories });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load categories.";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/staff/categories", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canManageProducts");
      if (!staff) return;
      const body = req.body;
      const created = await createCategoryForStaff({
        nameAr: typeof body.nameAr === "string" ? body.nameAr : "",
        nameEn: typeof body.nameEn === "string" ? body.nameEn : "",
        slug: typeof body.slug === "string" ? body.slug : void 0
      });
      res.status(201).json({ category: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create category.";
      res.status(400).json({ error: message });
    }
  });
  app.patch(
    "/api/staff/categories/:slug",
    requireAuth,
    async (req, res) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, "canManageProducts");
        if (!staff) return;
        const slug = normalizeCategorySlug(
          typeof req.params.slug === "string" ? req.params.slug : ""
        );
        if (!slug) {
          res.status(400).json({ error: "Invalid category slug." });
          return;
        }
        const body = req.body;
        const updated = await updateCategoryBySlugForStaff(slug, {
          nameAr: typeof body.nameAr === "string" ? body.nameAr : void 0,
          nameEn: typeof body.nameEn === "string" ? body.nameEn : void 0,
          isActive: typeof body.isActive === "boolean" ? body.isActive : void 0
        });
        if (!updated) {
          res.status(404).json({ error: "Category not found." });
          return;
        }
        res.json({ category: updated });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update category.";
        res.status(400).json({ error: message });
      }
    }
  );
  app.delete(
    "/api/staff/categories/:slug",
    requireAuth,
    async (req, res) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, "canManageProducts");
        if (!staff) return;
        const slug = normalizeCategorySlug(
          typeof req.params.slug === "string" ? req.params.slug : ""
        );
        if (!slug) {
          res.status(400).json({ error: "Invalid category slug." });
          return;
        }
        const deleted = await deleteCategoryBySlugForStaff(slug);
        if (!deleted) {
          res.status(404).json({ error: "Category not found." });
          return;
        }
        res.json({ deleted: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to delete category.";
        res.status(400).json({ error: message });
      }
    }
  );
  app.post(
    "/api/staff/products/upload-image",
    requireAuth,
    async (req, res) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, "canManageProducts");
        if (!staff) return;
        const body = req.body;
        const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
        const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
          res.status(400).json({ error: "Only JPEG, PNG, and WebP images are supported." });
          return;
        }
        const buffer = Buffer.from(match[2], "base64");
        if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
          res.status(400).json({ error: "Image file must be under 5 MB." });
          return;
        }
        const isJpeg = buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
        const isPng = buffer.length >= 4 && buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71;
        const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
        let ext = null;
        if (isJpeg) ext = "jpg";
        else if (isPng) ext = "png";
        else if (isWebp) ext = "webp";
        if (!ext) {
          res.status(400).json({ error: "Invalid image binary signature." });
          return;
        }
        if (process.env.VERCEL) {
          if (dataUrl.length > 25e5) {
            res.status(400).json({
              error: "On serverless hosting, uploaded images must be under 1.8 MB or linked by HTTPS URL."
            });
            return;
          }
          res.status(201).json({ imageUrl: dataUrl });
          return;
        }
        try {
          fs2.mkdirSync(PRODUCT_UPLOADS_DIR, { recursive: true });
          const filename = `prod-${crypto.randomUUID()}.${ext}`;
          const targetPath = path2.resolve(PRODUCT_UPLOADS_DIR, filename);
          if (!targetPath.startsWith(PRODUCT_UPLOADS_DIR + path2.sep)) {
            res.status(400).json({ error: "Invalid target file path." });
            return;
          }
          fs2.writeFileSync(targetPath, buffer);
          res.status(201).json({ imageUrl: `/uploads/products/${filename}` });
        } catch (fsErr) {
          const fsCode = fsErr && typeof fsErr === "object" && "code" in fsErr ? String(fsErr.code || "") : "";
          if ((fsCode === "EROFS" || fsCode === "EACCES") && dataUrl.length <= 25e5) {
            res.status(201).json({ imageUrl: dataUrl });
            return;
          }
          throw fsErr;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to upload product image.";
        res.status(500).json({ error: message });
      }
    }
  );
  app.post("/api/staff/products", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, "canManageProducts");
      if (!staff) return;
      const body = req.body;
      const sizes = Array.isArray(body.sizes) ? body.sizes.filter((s) => typeof s === "string" && s.trim().length > 0) : ["S", "M", "L", "XL"];
      const created = await createProductForStaff({
        sku: typeof body.sku === "string" ? body.sku : "",
        category: isValidProductCategory(body.category) ? body.category : "outerwear",
        image: typeof body.image === "string" ? body.image : "",
        priceEgp: typeof body.priceEgp === "number" ? body.priceEgp : Number(body.priceEgp),
        stockQty: body.stockQty !== void 0 && Number.isFinite(Number(body.stockQty)) ? Number(body.stockQty) : void 0,
        sizeStock: parseSizeStockPayload(body.sizeStock),
        sizes,
        titleAr: typeof body.titleAr === "string" ? body.titleAr : "",
        titleEn: typeof body.titleEn === "string" ? body.titleEn : "",
        subtitleAr: typeof body.subtitleAr === "string" ? body.subtitleAr : "",
        subtitleEn: typeof body.subtitleEn === "string" ? body.subtitleEn : "",
        descriptionAr: typeof body.descriptionAr === "string" ? body.descriptionAr : void 0,
        descriptionEn: typeof body.descriptionEn === "string" ? body.descriptionEn : void 0,
        tagAr: typeof body.tagAr === "string" ? body.tagAr : null,
        tagEn: typeof body.tagEn === "string" ? body.tagEn : null
      });
      res.status(201).json({ product: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create product.";
      res.status(400).json({ error: message });
    }
  });
  app.patch(
    "/api/staff/products/:productId",
    requireAuth,
    async (req, res) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, "canManageProducts");
        if (!staff) return;
        const productId = typeof req.params.productId === "string" ? req.params.productId.trim() : "";
        if (!productId || productId.length > 80) {
          res.status(400).json({ error: "Invalid product ID." });
          return;
        }
        const body = req.body;
        const updated = await updateProductByIdForStaff(productId, {
          titleAr: typeof body.titleAr === "string" ? body.titleAr : void 0,
          titleEn: typeof body.titleEn === "string" ? body.titleEn : void 0,
          subtitleAr: typeof body.subtitleAr === "string" ? body.subtitleAr : void 0,
          subtitleEn: typeof body.subtitleEn === "string" ? body.subtitleEn : void 0,
          priceEgp: body.priceEgp !== void 0 && Number.isFinite(Number(body.priceEgp)) ? Number(body.priceEgp) : void 0,
          stockQty: body.stockQty !== void 0 && Number.isFinite(Number(body.stockQty)) ? Number(body.stockQty) : void 0,
          sizeStock: parseSizeStockPayload(body.sizeStock),
          image: typeof body.image === "string" ? body.image : void 0,
          category: isValidProductCategory(body.category) ? body.category : void 0,
          sizes: Array.isArray(body.sizes) ? body.sizes.filter((s) => typeof s === "string") : void 0,
          tagAr: body.tagAr !== void 0 ? typeof body.tagAr === "string" ? body.tagAr : null : void 0,
          tagEn: body.tagEn !== void 0 ? typeof body.tagEn === "string" ? body.tagEn : null : void 0,
          descriptionAr: typeof body.descriptionAr === "string" ? body.descriptionAr : void 0,
          descriptionEn: typeof body.descriptionEn === "string" ? body.descriptionEn : void 0,
          isActive: typeof body.isActive === "boolean" ? body.isActive : void 0
        });
        if (!updated) {
          res.status(404).json({ error: "Product not found." });
          return;
        }
        res.json({ product: updated });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update product.";
        res.status(400).json({ error: message });
      }
    }
  );
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });
  app.use("/api", (err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    res.status(500).json({ error: message });
  });
  return app;
}

// src/vercelHandler.ts
var cachedApp = null;
function getApiApp() {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}
function normalizeVercelApiUrl(req) {
  const rawUrl = req.url || "/api";
  try {
    const parsed = new URL(rawUrl, "http://localhost");
    const rewrittenPath = parsed.searchParams.get("__maraya_path");
    if (rewrittenPath !== null) {
      parsed.searchParams.delete("__maraya_path");
      const cleaned = rewrittenPath.replace(/^\/+/, "");
      const nextPathname = cleaned ? `/api/${cleaned}` : "/api";
      const nextSearch = parsed.searchParams.toString();
      req.url = nextSearch ? `${nextPathname}?${nextSearch}` : nextPathname;
      return;
    }
    if (parsed.pathname === "/api/index") {
      const nextSearch = parsed.searchParams.toString();
      req.url = nextSearch ? `/api?${nextSearch}` : "/api";
    }
  } catch {
  }
}
function sendJsonError(res, statusCode, message) {
  if (res.headersSent || res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: message }));
}
function handler(req, res) {
  try {
    normalizeVercelApiUrl(req);
    const app = getApiApp();
    return app(req, res, (err) => {
      const message = err instanceof Error ? err.message : "Unexpected API routing error.";
      console.error("Unhandled Express pipeline error:", err);
      sendJsonError(res, 500, message);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Serverless API handler failed to initialize.";
    console.error("Vercel API handler error:", err);
    sendJsonError(res, 500, message);
  }
}
export {
  handler as default
};
