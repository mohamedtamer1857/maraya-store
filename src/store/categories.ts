import { getStoreSnapshot, withStoreMutation } from './jsonStore.ts';
import type { StoreCategory } from '../types.ts';

export function normalizeCategorySlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function listPublicCategories(): Promise<StoreCategory[]> {
  const store = getStoreSnapshot();
  return store.categories
    .filter((c) => c.isActive)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export async function listAllCategoriesForStaff(): Promise<StoreCategory[]> {
  const store = getStoreSnapshot();
  return store.categories
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export async function categorySlugExists(slug: string): Promise<boolean> {
  const store = getStoreSnapshot();
  return store.categories.some((c) => c.slug === slug);
}

export async function createCategoryForStaff(input: {
  nameAr: string;
  nameEn: string;
  slug?: string;
}): Promise<StoreCategory> {
  const nameAr = input.nameAr.trim().slice(0, 80);
  const nameEn = input.nameEn.trim().slice(0, 80);
  if (!nameAr || !nameEn) {
    throw new Error('Category Arabic and English names are required.');
  }

  let slug = normalizeCategorySlug(input.slug || nameEn);
  if (!slug || slug.length < 2) {
    slug = `cat-${Math.floor(100 + Math.random() * 900)}`;
  }

  return withStoreMutation((store) => {
    const existing = store.categories.find((c) => c.slug === slug);
    if (existing) {
      throw new Error(`Category slug "${slug}" already exists.`);
    }

    const created: StoreCategory = {
      id: store.nextCategorySeq++,
      slug,
      nameAr,
      nameEn,
      isActive: true,
      sortOrder: store.categories.length,
    };
    store.categories.push(created);
    return created;
  });
}

export async function updateCategoryBySlugForStaff(
  slug: string,
  patch: {
    nameAr?: string;
    nameEn?: string;
    isActive?: boolean;
  }
): Promise<StoreCategory | null> {
  return withStoreMutation((store) => {
    const existing = store.categories.find((c) => c.slug === slug);
    if (!existing) return null;

    if (patch.nameAr !== undefined) {
      const cleanAr = patch.nameAr.trim().slice(0, 80);
      if (cleanAr) existing.nameAr = cleanAr;
    }
    if (patch.nameEn !== undefined) {
      const cleanEn = patch.nameEn.trim().slice(0, 80);
      if (cleanEn) existing.nameEn = cleanEn;
    }
    if (typeof patch.isActive === 'boolean') {
      existing.isActive = patch.isActive;
    }

    return { ...existing };
  });
}

export async function deleteCategoryBySlugForStaff(slug: string): Promise<boolean> {
  return withStoreMutation((store) => {
    const idx = store.categories.findIndex((c) => c.slug === slug);
    if (idx === -1) return false;

    const assignedProducts = store.products.some((p) => p.category === slug);
    if (assignedProducts) {
      throw new Error(
        'Cannot delete a category that still has products assigned. Move or hide those products first.'
      );
    }

    store.categories.splice(idx, 1);
    return true;
  });
}
