import { getStoreSnapshot, withStoreMutation } from './jsonStore.ts';
import { categorySlugExists, listPublicCategories } from './categories.ts';
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

export function distributeStockAcrossSizes(
  sizes: string[],
  totalStock: number
): Record<string, number> {
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
  rawSizeStock: Record<string, number> | undefined,
  fallbackTotalStock: number
): Record<string, number> {
  const safeSizes = sizes.length > 0 ? sizes : ['M'];
  if (rawSizeStock && typeof rawSizeStock === 'object') {
    const map: Record<string, number> = {};
    for (const sz of safeSizes) {
      const val = Number(rawSizeStock[sz]);
      map[sz] = Number.isFinite(val) && val >= 0 ? Math.min(100_000, Math.round(val)) : 0;
    }
    return map;
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

function normalizeProduct(p: Product): Product {
  const sizes = p.sizes.length > 0 ? p.sizes : ['S', 'M', 'L', 'XL'];
  const sizeStock = parseSizeStock(sizes, p.sizeStock, p.stockQty ?? 15);
  return {
    ...p,
    sizes,
    sizeStock,
    stockQty: sumSizeStock(sizeStock),
    isActive: p.isActive !== false,
  };
}

export async function listPublicProducts(): Promise<Product[]> {
  const store = getStoreSnapshot();
  const publicCats = await listPublicCategories();
  const activeCategorySlugs = new Set(publicCats.map((c) => c.slug));

  return store.products
    .filter(
      (p) =>
        p.isActive !== false &&
        (activeCategorySlugs.size === 0 || activeCategorySlugs.has(p.category))
    )
    .map(normalizeProduct);
}

export async function listAllProductsForStaff(): Promise<Product[]> {
  const store = getStoreSnapshot();
  return store.products.map(normalizeProduct);
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
  if (patch.image !== undefined && !isValidImageUrl(patch.image)) {
    throw new Error('Invalid image URL or path.');
  }

  let nextCategoryValidated: string | undefined;
  if (patch.category !== undefined) {
    if (!isValidProductCategory(patch.category)) {
      throw new Error('Invalid category.');
    }
    const candidateCat = patch.category.trim().toLowerCase();
    if (!(await categorySlugExists(candidateCat))) {
      throw new Error('Selected category does not exist.');
    }
    nextCategoryValidated = candidateCat;
  }

  return withStoreMutation((store) => {
    const existing = store.products.find((p) => p.id === productId);
    if (!existing) return null;

    const nextPrice =
      patch.priceEgp !== undefined ? Math.round(patch.priceEgp) : existing.priceEgp;
    if (!Number.isFinite(nextPrice) || nextPrice < 0 || nextPrice > 5_000_000) {
      throw new Error('Price must be between 0 and 5,000,000 EGP.');
    }

    const currentSizes = existing.sizes.length > 0 ? existing.sizes : ['S', 'M', 'L', 'XL'];
    const currentSizeStock = parseSizeStock(
      currentSizes,
      existing.sizeStock,
      existing.stockQty ?? 15
    );

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

    const nextSizes =
      cleanedPatchSizes && cleanedPatchSizes.length > 0 ? cleanedPatchSizes : currentSizes;

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

    const nextTitleAr =
      patch.titleAr !== undefined ? patch.titleAr.trim() : existing.title.ar;
    const nextTitleEn =
      patch.titleEn !== undefined ? patch.titleEn.trim() : existing.title.en;
    if (!nextTitleAr || !nextTitleEn) {
      throw new Error('Arabic and English display titles are required.');
    }

    existing.title = {
      ar: nextTitleAr.slice(0, 140),
      en: nextTitleEn.slice(0, 140),
    };
    existing.subtitle = {
      ar:
        patch.subtitleAr !== undefined
          ? patch.subtitleAr.trim().slice(0, 180) || existing.subtitle.ar
          : existing.subtitle.ar,
      en:
        patch.subtitleEn !== undefined
          ? patch.subtitleEn.trim().slice(0, 180) || existing.subtitle.en
          : existing.subtitle.en,
    };
    existing.priceEgp = nextPrice;
    existing.sizes = nextSizes;
    existing.sizeStock = nextSizeStock;
    existing.stockQty = sumSizeStock(nextSizeStock);
    if (patch.image !== undefined) existing.image = patch.image.trim();
    if (nextCategoryValidated) existing.category = nextCategoryValidated;

    if (patch.tagAr !== undefined || patch.tagEn !== undefined) {
      const tAr =
        patch.tagAr !== undefined
          ? patch.tagAr?.trim().slice(0, 40) || ''
          : existing.tag?.ar || '';
      const tEn =
        patch.tagEn !== undefined
          ? patch.tagEn?.trim().slice(0, 40) || ''
          : existing.tag?.en || '';
      if (tAr || tEn) {
        existing.tag = { ar: tAr || tEn, en: tEn || tAr };
      } else {
        delete existing.tag;
      }
    }

    existing.description = {
      ar:
        patch.descriptionAr !== undefined
          ? patch.descriptionAr.trim().slice(0, 800) || existing.description.ar
          : existing.description.ar,
      en:
        patch.descriptionEn !== undefined
          ? patch.descriptionEn.trim().slice(0, 800) || existing.description.en
          : existing.description.en,
    };

    if (typeof patch.isActive === 'boolean') {
      existing.isActive = patch.isActive;
    }

    return normalizeProduct(existing);
  });
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
  const cleanSku = input.sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
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
      ? Array.from(
          new Set(input.sizes.map((s) => s.trim().slice(0, 12)).filter(Boolean))
        ).slice(0, 10)
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

  return withStoreMutation((store) => {
    if (store.products.some((p) => p.sku === cleanSku)) {
      throw new Error(`SKU "${cleanSku}" already exists.`);
    }

    const created: Product = {
      id: productId,
      sku: cleanSku,
      category: normalizedCategory,
      image: input.image.trim(),
      priceEgp,
      stockQty,
      sizeStock,
      isActive: true,
      sizes: cleanSizes,
      ...(input.tagAr || input.tagEn
        ? {
            tag: {
              ar: input.tagAr?.trim().slice(0, 40) || input.tagEn?.trim().slice(0, 40) || '',
              en: input.tagEn?.trim().slice(0, 40) || input.tagAr?.trim().slice(0, 40) || '',
            },
          }
        : {}),
      title: { ar: titleAr, en: titleEn },
      subtitle: {
        ar: input.subtitleAr.trim().slice(0, 180) || titleAr,
        en: input.subtitleEn.trim().slice(0, 180) || titleEn,
      },
      color: {
        ar: input.colorAr?.trim().slice(0, 60) || 'أسود كلاسيكي',
        en: input.colorEn?.trim().slice(0, 60) || 'Classic Obsidian',
        hex: /^#[0-9A-Fa-f]{6}$/.test(input.colorHex || '') ? input.colorHex! : '#181B20',
      },
      fabric: {
        ar: input.fabricAr?.trim().slice(0, 180) || 'خامة طبيعية فاخرة من دار مَرايا',
        en: input.fabricEn?.trim().slice(0, 180) || 'MARAYA Signature Natural Textile',
      },
      description: {
        ar: input.descriptionAr?.trim().slice(0, 800) || titleAr,
        en: input.descriptionEn?.trim().slice(0, 800) || titleEn,
      },
    };

    store.nextProductSeq++;
    store.products.push(created);
    return normalizeProduct(created);
  });
}
