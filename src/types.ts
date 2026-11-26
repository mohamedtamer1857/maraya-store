export type Language = 'ar' | 'en';
export type Theme = 'light' | 'dark';
export type CategoryKey = string;

export interface StoreCategory {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Product {
  id: string;
  sku: string;
  category: string;
  image: string;
  priceEgp: number;
  stockQty?: number;
  sizeStock?: Record<string, number>;
  isActive?: boolean;
  sizes: string[];
  tag?: {
    ar: string;
    en: string;
  };
  title: {
    ar: string;
    en: string;
  };
  subtitle: {
    ar: string;
    en: string;
  };
  color: {
    ar: string;
    en: string;
    hex: string;
  };
  fabric: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
}

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
}
