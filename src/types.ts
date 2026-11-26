export type Language = 'ar' | 'en';
export type Theme = 'light' | 'dark';
export type CategoryKey = 'all' | 'outerwear' | 'tailoring' | 'knitwear' | 'shirts';

export interface Product {
  id: string;
  sku: string;
  category: Exclude<CategoryKey, 'all'>;
  image: string;
  priceEgp: number;
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
