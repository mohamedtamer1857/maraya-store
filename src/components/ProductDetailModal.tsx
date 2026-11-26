import { useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import type { Language, Product } from '../types';
import type { Translations } from '../i18n/translations';

interface ProductDetailModalProps {
  product: Product | null;
  categoryLabel?: string;
  lang: Language;
  t: Translations;
  onClose: () => void;
  onAddToBag: (product: Product, size: string) => void;
}

export function ProductDetailModal({
  product,
  categoryLabel,
  lang,
  t,
  onClose,
  onAddToBag,
}: ProductDetailModalProps) {
  const [selectedSize, setSelectedSize] = useState<string>('M');

  if (!product) return null;

  const getSizeQty = (sz: string) => {
    if (product.sizeStock && typeof product.sizeStock[sz] === 'number') {
      return product.sizeStock[sz];
    }
    return typeof product.stockQty === 'number' ? product.stockQty : 15;
  };

  const firstAvailableSize = product.sizes.find((sz) => getSizeQty(sz) > 0) ?? product.sizes[0];
  const activeSize =
    product.sizes.includes(selectedSize) && getSizeQty(selectedSize) > 0
      ? selectedSize
      : firstAvailableSize;

  const price = `${product.priceEgp.toLocaleString('en-US')} ${t.catalog.currency}`;
  const totalStock = product.sizeStock
    ? product.sizes.reduce((sum, sz) => sum + (product.sizeStock?.[sz] ?? 0), 0)
    : typeof product.stockQty === 'number'
    ? product.stockQty
    : 15;
  const activeSizeStock = getSizeQty(activeSize);
  const isOutOfStock = totalStock <= 0 || activeSizeStock <= 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.title[lang]}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative grid w-full max-w-4xl max-h-[90vh] overflow-y-auto md:grid-cols-2 rounded-2xl bg-white dark:bg-[#13161C] border border-black/[0.08] dark:border-white/[0.1] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.productModal.close}
          className="absolute top-4 end-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-[#0F1115] hover:bg-white dark:bg-[#0B0D11]/90 dark:text-[#F4F5F7] dark:hover:bg-[#1B1F27] border border-black/[0.08] dark:border-white/[0.1] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Left / Start Gallery */}
        <div className="aspect-[3/4] w-full bg-[#EBEDF0] dark:bg-[#1B1F27] overflow-hidden">
          <img
            src={product.image}
            alt={product.title[lang]}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center"
          />
        </div>

        {/* Right / End Contiguous Purchase Module */}
        <div className="flex flex-col justify-between p-6 sm:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#525866] dark:text-[#9CA3AF]">
              <span>
                {categoryLabel ||
                  (t.catalog.categories as Record<string, string>)[product.category] ||
                  product.category}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{product.sku}</span>
              <span aria-hidden="true">·</span>
              {totalStock <= 0 ? (
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {lang === 'ar' ? 'نفذت الكمية' : 'Out of Stock'}
                </span>
              ) : (
                <span className="font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {lang === 'ar'
                    ? `متوفر لمقاس ${activeSize}: ${activeSizeStock}`
                    : `In stock (${activeSize}): ${activeSizeStock}`}
                </span>
              )}
            </div>

            <h2 className="mt-2 font-editorial text-2xl sm:text-3xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
              {product.title[lang]}
            </h2>

            <p className="mt-2 text-lg font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
              {price}
            </p>

            <p className="mt-4 text-sm leading-relaxed text-[#525866] dark:text-[#D1D5DB]">
              {product.description[lang]}
            </p>

            {/* Color & Fabric Specs */}
            <div className="mt-6 space-y-3 border-t border-black/[0.07] dark:border-white/[0.08] pt-5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#525866] dark:text-[#9CA3AF]">
                  {t.productModal.colorLabel}
                </span>
                <span className="inline-flex items-center gap-2 font-medium text-[#0F1115] dark:text-[#F4F5F7]">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full border border-black/15 dark:border-white/20"
                    style={{ backgroundColor: product.color.hex }}
                  />
                  {product.color[lang]}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[#525866] dark:text-[#9CA3AF]">
                  {t.productModal.fabricLabel}
                </span>
                <span className="font-medium text-[#0F1115] dark:text-[#F4F5F7]">
                  {product.fabric[lang]}
                </span>
              </div>
            </div>

            {/* Size Selector */}
            <div className="mt-6">
              <span className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                {t.productModal.selectSize}
              </span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {product.sizes.map((sz) => {
                  const szQty = getSizeQty(sz);
                  const szOut = szQty <= 0;
                  const isSelected = sz === activeSize && !szOut;
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={szOut}
                      onClick={() => setSelectedSize(sz)}
                      className={`inline-flex min-h-[44px] min-w-[56px] flex-col items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        szOut
                          ? 'border border-red-300/70 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 text-red-600/85 dark:text-red-400/85 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#0F1115] text-white dark:bg-[#F4F5F7] dark:text-[#0B0D11] cursor-pointer'
                          : 'border border-black/[0.12] text-[#0F1115] hover:bg-black/[0.04] dark:border-white/[0.14] dark:text-[#F4F5F7] dark:hover:bg-white/[0.06] cursor-pointer'
                      }`}
                    >
                      <span className={szOut ? 'line-through' : ''}>{sz}</span>
                      {szOut ? (
                        <span className="text-[10px] font-medium leading-tight">
                          {lang === 'ar' ? 'نفذت الكمية' : 'Out of Stock'}
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-normal tabular-nums ${
                            isSelected ? 'opacity-80' : 'text-[#525866] dark:text-[#9CA3AF]'
                          }`}
                        >
                          {szQty}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Primary Action */}
          <div className="mt-8">
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                if (isOutOfStock) return;
                onAddToBag(product, activeSize);
                onClose();
              }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0F1115] px-5 text-sm font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#F4F5F7] dark:text-[#0B0D11] dark:hover:bg-[#60A5FA] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {isOutOfStock
                  ? lang === 'ar'
                    ? 'غير متاح حالياً بالمخزون'
                    : 'Currently Out of Stock'
                  : t.productModal.addToBag}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
