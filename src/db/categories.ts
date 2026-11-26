import { asc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { productCategories, productsCatalog } from './schema.ts';
import type { StoreCategory } from '../types.ts';

const DEFAULT_CATEGORIES: Array<{
  slug: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
}> = [
  { slug: 'outerwear', nameAr: 'بالطوهات وجواكت', nameEn: 'Outerwear', sortOrder: 0 },
  { slug: 'tailoring', nameAr: 'بليزرات وتفصيل', nameEn: 'Tailoring', sortOrder: 1 },
  { slug: 'knitwear', nameAr: 'تريكو وبلوفرات', nameEn: 'Knitwear', sortOrder: 2 },
  { slug: 'shirts', nameAr: 'قمصان', nameEn: 'Shirts', sortOrder: 3 },
];

function rowToCategory(row: typeof productCategories.$inferSelect): StoreCategory {
  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    isActive: row.isActive === 1,
    sortOrder: row.sortOrder,
  };
}

export function normalizeCategorySlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function ensureCategoriesSeeded(): Promise<void> {
  const existing = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .limit(1);

  if (existing.length > 0) return;

  await db
    .insert(productCategories)
    .values(
      DEFAULT_CATEGORIES.map((c) => ({
        slug: c.slug,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        isActive: 1,
        sortOrder: c.sortOrder,
      }))
    )
    .onConflictDoNothing();
}

export async function listPublicCategories(): Promise<StoreCategory[]> {
  await ensureCategoriesSeeded();
  const rows = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.isActive, 1))
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.id));

  return rows.map(rowToCategory);
}

export async function listAllCategoriesForStaff(): Promise<StoreCategory[]> {
  await ensureCategoriesSeeded();
  const rows = await db
    .select()
    .from(productCategories)
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.id));

  return rows.map(rowToCategory);
}

export async function categorySlugExists(slug: string): Promise<boolean> {
  await ensureCategoriesSeeded();
  const rows = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.slug, slug))
    .limit(1);
  return rows.length > 0;
}

export async function createCategoryForStaff(input: {
  nameAr: string;
  nameEn: string;
  slug?: string;
}): Promise<StoreCategory> {
  await ensureCategoriesSeeded();

  const nameAr = input.nameAr.trim().slice(0, 80);
  const nameEn = input.nameEn.trim().slice(0, 80);
  if (!nameAr || !nameEn) {
    throw new Error('Category Arabic and English names are required.');
  }

  let slug = normalizeCategorySlug(input.slug?.trim() ? input.slug : nameEn);
  if (!slug || slug === 'all') {
    slug = `cat-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const existing = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    if (input.slug?.trim()) {
      throw new Error('A category with this code already exists.');
    }
    slug = `${slug.slice(0, 34)}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const allRows = await db.select({ id: productCategories.id }).from(productCategories);

  const [created] = await db
    .insert(productCategories)
    .values({
      slug,
      nameAr,
      nameEn,
      isActive: 1,
      sortOrder: allRows.length,
    })
    .returning();

  return rowToCategory(created);
}

export async function updateCategoryBySlugForStaff(
  slug: string,
  patch: { nameAr?: string; nameEn?: string; isActive?: boolean }
): Promise<StoreCategory | null> {
  await ensureCategoriesSeeded();
  const existingRows = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.slug, slug))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) return null;

  const nextNameAr = patch.nameAr !== undefined ? patch.nameAr.trim().slice(0, 80) : existing.nameAr;
  const nextNameEn = patch.nameEn !== undefined ? patch.nameEn.trim().slice(0, 80) : existing.nameEn;
  if (!nextNameAr || !nextNameEn) {
    throw new Error('Category Arabic and English names are required.');
  }

  const [updated] = await db
    .update(productCategories)
    .set({
      nameAr: nextNameAr,
      nameEn: nextNameEn,
      isActive:
        typeof patch.isActive === 'boolean' ? (patch.isActive ? 1 : 0) : existing.isActive,
    })
    .where(eq(productCategories.id, existing.id))
    .returning();

  return rowToCategory(updated);
}

export async function deleteCategoryBySlugForStaff(slug: string): Promise<boolean> {
  await ensureCategoriesSeeded();
  const existingRows = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.slug, slug))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) return false;

  const assigned = await db
    .select({ id: productsCatalog.id })
    .from(productsCatalog)
    .where(eq(productsCatalog.category, slug))
    .limit(1);

  if (assigned.length > 0) {
    throw new Error(
      'Cannot delete a category that still has products assigned. Reassign its products first or hide it from the storefront.'
    );
  }

  await db.delete(productCategories).where(eq(productCategories.id, existing.id));
  return true;
}
