import { asc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { productsCatalog } from './schema.ts';
import { PRODUCTS as DEFAULT_PRODUCTS } from '../data/products.ts';
import { categorySlugExists, ensureCategoriesSeeded, listPublicCategories } from './categories.ts';
import type { Product } from '../types.ts';

export function isValidProductCategory(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim().toLowerCase();
  return trimmed !== 'all' && /^[a-z0-9][a-z0-9_-]{1,39}$/.test(trimmed);
}

export function isValidImageUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed.length <= 2_500_000;
  }
  if (trimmed.length > 1000) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseSizes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const cleaned = parsed
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 12));
      if (cleaned.length > 0) return Array.from(new Set(cleaned));
    }
  } catch {
    // Fallback to default sizes
  }
  return ['S', 'M', 'L', 'XL'];
}

export function distributeStockAcrossSizes(sizes: string[], totalStock: number): Record<string, number> {
  const safeSizes = sizes.length > 0 ? sizes : ['M'];
  const total = Math.max(0, Math.min(100_000, Math.round(totalStock)));
  const base = Math.floor(total / safeSizes.length);
  const rem = total % safeSizes.length;
  const map: Record<string, number> = {};
  safeSizes.forEach((sz, idx) => {
    map[sz] = base + (idx < rem ? 1 : 0);
  });
  return map;
}

export function parseSizeStock(
  sizes: string[],
  rawSizeStockJson: string | null | undefined,
  fallbackTotalStock: number
): Record<string, number> {
  const safeSizes = sizes.length > 0 ? sizes : ['M'];
  if (rawSizeStockJson && rawSizeStockJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawSizeStockJson) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        const map: Record<string, number> = {};
        for (const sz of safeSizes) {
          const val = Number(record[sz]);
          map[sz] = Number.isFinite(val) && val >= 0 ? Math.min(100_000, Math.round(val)) : 0;
        }
        return map;
      }
    } catch {
      // Fallback to distributed total stock
    }
  }
  return distributeStockAcrossSizes(safeSizes, fallbackTotalStock);
}

export function sumSizeStock(sizeStock: Record<string, number>): number {
  return Object.values(sizeStock).reduce((sum, n) => sum + Math.max(0, Math.round(n)), 0);
}

export function sanitizeSizeStockMap(
  sizes: string[],
  rawMap: unknown
): Record<string, number> | null {
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return null;
  const input = rawMap as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const sz of sizes) {
    const rawVal = input[sz];
    if (rawVal === undefined) {
      result[sz] = 0;
      continue;
    }
    const num = Number(rawVal);
    if (!Number.isFinite(num) || num < 0 || num > 100_000) {
      throw new Error(`Stock for size ${sz} must be between 0 and 100,000.`);
    }
    result[sz] = Math.round(num);
  }
  return result;
}

function rowToProduct(row: typeof productsCatalog.$inferSelect): Product {
  const category = isValidProductCategory(row.category)
    ? row.category.trim().toLowerCase()
    : 'outerwear';
  const sizes = parseSizes(row.sizesJson);
  const sizeStock = parseSizeStock(sizes, row.sizeStockJson, row.stockQty);
  const totalStock = sumSizeStock(sizeStock);

  const product: Product = {
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
      en: row.titleEn,
    },
    subtitle: {
      ar: row.subtitleAr,
      en: row.subtitleEn,
    },
    color: {
      ar: row.colorAr,
      en: row.colorEn,
      hex: row.colorHex,
    },
    fabric: {
      ar: row.fabricAr,
      en: row.fabricEn,
    },
    description: {
      ar: row.descriptionAr,
      en: row.descriptionEn,
    },
  };

  if (row.tagAr || row.tagEn) {
    product.tag = {
      ar: row.tagAr || row.tagEn || '',
      en: row.tagEn || row.tagAr || '',
    };
  }

  return product;
}

export async function ensureCatalogSeeded(): Promise<void> {
  const existing = await db
    .select({ id: productsCatalog.id })
    .from(productsCatalog)
    .limit(1);

  if (existing.length > 0) return;

  await db
    .insert(productsCatalog)
    .values(
      DEFAULT_PRODUCTS.map((p, idx) => {
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
          sortOrder: idx,
        };
      })
    )
    .onConflictDoNothing();
}

export async function listPublicProducts(): Promise<Product[]> {
  await ensureCatalogSeeded();
  const [rows, publicCats] = await Promise.all([
    db
      .select()
      .from(productsCatalog)
      .where(eq(productsCatalog.isActive, 1))
      .orderBy(asc(productsCatalog.sortOrder), asc(productsCatalog.id)),
    listPublicCategories(),
  ]);

  const activeCategorySlugs = new Set(publicCats.map((c) => c.slug));
  return rows
    .filter((r) => activeCategorySlugs.size === 0 || activeCategorySlugs.has(r.category))
    .map(rowToProduct);
}

export async function listAllProductsForStaff(): Promise<Product[]> {
  await ensureCatalogSeeded();
  await ensureCategoriesSeeded();
  const rows = await db
    .select()
    .from(productsCatalog)
    .orderBy(asc(productsCatalog.sortOrder), asc(productsCatalog.id));

  return rows.map(rowToProduct);
}

export interface UpdateProductInput {
  titleAr?: string;
  titleEn?: string;
  subtitleAr?: string;
  subtitleEn?: string;
  priceEgp?: number;
  stockQty?: number;
  sizeStock?: Record<string, number>;
  image?: string;
  category?: string;
  sizes?: string[];
  tagAr?: string | null;
  tagEn?: string | null;
  descriptionAr?: string;
  descriptionEn?: string;
  isActive?: boolean;
}

export async function updateProductByIdForStaff(
  productId: string,
  patch: UpdateProductInput
): Promise<Product | null> {
  await ensureCatalogSeeded();
  const existingRows = await db
    .select()
    .from(productsCatalog)
    .where(eq(productsCatalog.productId, productId))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) return null;

  if (patch.image !== undefined && !isValidImageUrl(patch.image)) {
    throw new Error('Invalid image URL or path.');
  }

  const nextPrice =
    patch.priceEgp !== undefined ? Math.round(patch.priceEgp) : existing.priceEgp;
  if (!Number.isFinite(nextPrice) || nextPrice < 0 || nextPrice > 5_000_000) {
    throw new Error('Price must be between 0 and 5,000,000 EGP.');
  }

  const currentSizes = parseSizes(existing.sizesJson);
  const currentSizeStock = parseSizeStock(currentSizes, existing.sizeStockJson, existing.stockQty);

  const cleanedPatchSizes =
    patch.sizes && patch.sizes.length > 0
      ? Array.from(
          new Set(
            patch.sizes
              .map((s) => s.trim().slice(0, 12))
              .filter(Boolean)
          )
        ).slice(0, 10)
      : null;

  const nextSizes = cleanedPatchSizes && cleanedPatchSizes.length > 0 ? cleanedPatchSizes : currentSizes;

  let nextSizeStock: Record<string, number>;
  if (patch.sizeStock !== undefined) {
    const sanitized = sanitizeSizeStockMap(nextSizes, patch.sizeStock);
    if (!sanitized) {
      throw new Error('Invalid per-size stock map.');
    }
    nextSizeStock = sanitized;
  } else if (patch.stockQty !== undefined) {
    const requestedTotal = Math.round(patch.stockQty);
    if (!Number.isFinite(requestedTotal) || requestedTotal < 0 || requestedTotal > 100_000) {
      throw new Error('Stock quantity must be between 0 and 100,000.');
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

  const nextTitleAr =
    patch.titleAr !== undefined ? patch.titleAr.trim() : existing.titleAr;
  const nextTitleEn =
    patch.titleEn !== undefined ? patch.titleEn.trim() : existing.titleEn;
  if (!nextTitleAr || !nextTitleEn) {
    throw new Error('Arabic and English display titles are required.');
  }

  let nextCategory = existing.category;
  if (patch.category !== undefined) {
    if (!isValidProductCategory(patch.category)) {
      throw new Error('Invalid category.');
    }
    const candidateCat = patch.category.trim().toLowerCase();
    if (!(await categorySlugExists(candidateCat))) {
      throw new Error('Selected category does not exist.');
    }
    nextCategory = candidateCat;
  }

  const [updated] = await db
    .update(productsCatalog)
    .set({
      titleAr: nextTitleAr.slice(0, 140),
      titleEn: nextTitleEn.slice(0, 140),
      subtitleAr:
        patch.subtitleAr !== undefined
          ? patch.subtitleAr.trim().slice(0, 180) || existing.subtitleAr
          : existing.subtitleAr,
      subtitleEn:
        patch.subtitleEn !== undefined
          ? patch.subtitleEn.trim().slice(0, 180) || existing.subtitleEn
          : existing.subtitleEn,
      priceEgp: nextPrice,
      stockQty: nextStock,
      image: patch.image !== undefined ? patch.image.trim() : existing.image,
      category: nextCategory,
      sizesJson: JSON.stringify(nextSizes),
      sizeStockJson: JSON.stringify(nextSizeStock),
      tagAr:
        patch.tagAr !== undefined
          ? patch.tagAr?.trim().slice(0, 40) || null
          : existing.tagAr,
      tagEn:
        patch.tagEn !== undefined
          ? patch.tagEn?.trim().slice(0, 40) || null
          : existing.tagEn,
      descriptionAr:
        patch.descriptionAr !== undefined
          ? patch.descriptionAr.trim().slice(0, 800) || existing.descriptionAr
          : existing.descriptionAr,
      descriptionEn:
        patch.descriptionEn !== undefined
          ? patch.descriptionEn.trim().slice(0, 800) || existing.descriptionEn
          : existing.descriptionEn,
      isActive:
        typeof patch.isActive === 'boolean'
          ? patch.isActive
            ? 1
            : 0
          : existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(productsCatalog.id, existing.id))
    .returning();

  return rowToProduct(updated);
}

export interface CreateProductInput {
  sku: string;
  category: string;
  image: string;
  priceEgp: number;
  stockQty?: number;
  sizeStock?: Record<string, number>;
  sizes: string[];
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  colorAr?: string;
  colorEn?: string;
  colorHex?: string;
  fabricAr?: string;
  fabricEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  tagAr?: string | null;
  tagEn?: string | null;
}

export async function createProductForStaff(input: CreateProductInput): Promise<Product> {
  await ensureCatalogSeeded();
  await ensureCategoriesSeeded();
  const cleanSku = input.sku.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
  if (!cleanSku) {
    throw new Error('Valid SKU is required (e.g. MRY-090).');
  }
  const normalizedCategory = isValidProductCategory(input.category)
    ? input.category.trim().toLowerCase()
    : 'outerwear';
  if (!(await categorySlugExists(normalizedCategory))) {
    throw new Error('Selected category does not exist.');
  }
  if (!isValidImageUrl(input.image)) {
    throw new Error('Valid product image URL or uploaded image path is required.');
  }
  const titleAr = input.titleAr.trim().slice(0, 140);
  const titleEn = input.titleEn.trim().slice(0, 140);
  if (!titleAr || !titleEn) {
    throw new Error('Arabic and English product names are required.');
  }
  const priceEgp = Math.round(input.priceEgp);
  if (!Number.isFinite(priceEgp) || priceEgp < 0 || priceEgp > 5_000_000) {
    throw new Error('Invalid price.');
  }

  const cleanSizes =
    input.sizes.length > 0
      ? Array.from(new Set(input.sizes.map((s) => s.trim().slice(0, 12)).filter(Boolean))).slice(0, 10)
      : ['S', 'M', 'L', 'XL'];

  let sizeStock: Record<string, number>;
  if (input.sizeStock) {
    const sanitized = sanitizeSizeStockMap(cleanSizes, input.sizeStock);
    if (!sanitized) {
      throw new Error('Invalid per-size stock.');
    }
    sizeStock = sanitized;
  } else {
    const fallbackTotal = Math.round(input.stockQty ?? 16);
    if (!Number.isFinite(fallbackTotal) || fallbackTotal < 0 || fallbackTotal > 100_000) {
      throw new Error('Invalid stock quantity.');
    }
    sizeStock = distributeStockAcrossSizes(cleanSizes, fallbackTotal);
  }
  const stockQty = sumSizeStock(sizeStock);

  const slugBase = titleEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const productId = `${slugBase || 'piece'}-${Math.floor(100 + Math.random() * 900)}`;

  const existingCountRows = await db.select({ id: productsCatalog.id }).from(productsCatalog);

  const [created] = await db
    .insert(productsCatalog)
    .values({
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
      colorAr: input.colorAr?.trim().slice(0, 60) || 'أسود كلاسيكي',
      colorEn: input.colorEn?.trim().slice(0, 60) || 'Classic Obsidian',
      colorHex: /^#[0-9A-Fa-f]{6}$/.test(input.colorHex || '') ? input.colorHex! : '#181B20',
      fabricAr: input.fabricAr?.trim().slice(0, 180) || 'خامة طبيعية فاخرة من دار مَرايا',
      fabricEn: input.fabricEn?.trim().slice(0, 180) || 'MARAYA Signature Natural Textile',
      descriptionAr: input.descriptionAr?.trim().slice(0, 800) || titleAr,
      descriptionEn: input.descriptionEn?.trim().slice(0, 800) || titleEn,
      isActive: 1,
      sortOrder: existingCountRows.length,
    })
    .returning();

  return rowToProduct(created);
}
