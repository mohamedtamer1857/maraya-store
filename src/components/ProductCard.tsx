import { useState } from 'react';
import { Heart, Ruler, ShoppingBag, Shirt, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Language, Product } from '../types';
import type { Translations } from '../i18n/translations';

interface ProductCardProps {
  product: Product;
  lang: Language;
  t: Translations;
  onQuickView: (product: Product) => void;
  onQuickAdd: (product: Product, size: string) => void;
}

export function ProductCard({
  product,
  lang,
  t,
  onQuickView,
  onQuickAdd,
}: ProductCardProps) {
  const { wishlistIds, toggleWishlist } = useAuth();
  const isSaved = wishlistIds.includes(product.id);
  const [imgError, setImgError] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(false);

  const price = `${product.priceEgp.toLocaleString('en-US')} ${t.catalog.currency}`;

  const handleAddClick = () => {
    if (selectedSize) {
      onQuickAdd(product, selectedSize);
      setSizeMenuOpen(false);
      setPendingAdd(false);
      return;
    }
    setPendingAdd(true);
    setSizeMenuOpen(true);
  };

  const handlePickSize = (size: string) => {
    setSelectedSize(size);
    if (pendingAdd) {
      onQuickAdd(product, size);
      setPendingAdd(false);
      setSizeMenuOpen(false);
    } else {
      setSizeMenuOpen(false);
    }
  };

  return (
    <article className="group flex flex-col bg-white dark:bg-[#13161C] border border-black/[0.07] dark:border-white/[0.08] rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
      {/* 3:4 Clean Garment Portrait Media */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#EBEDF0] dark:bg-[#1B1F27]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void toggleWishlist(product);
          }}
          aria-label={lang === 'ar' ? 'احفظ في المفضلة' : 'Save to wishlist'}
          className={`absolute top-3 end-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-colors cursor-pointer ${
            isSaved
              ? 'border-red-500/40 bg-red-500 text-white'
              : 'border-black/10 bg-white/85 text-[#0F1115] hover:bg-white dark:border-white/15 dark:bg-[#13161C]/80 dark:text-[#F4F5F7]'
          }`}
        >
          <Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>

        {!imgError ? (
          <img
            src={product.image}
            alt={product.title[lang]}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            onClick={() => onQuickView(product)}
            className="h-full w-full object-cover object-center cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div
            onClick={() => onQuickView(product)}
            className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center cursor-pointer bg-gradient-to-b from-[#ECEEF2] to-[#DFE3EA] dark:from-[#1B1F27] dark:to-[#13161C]"
          >
            <Shirt className="h-10 w-10 text-[#525866] dark:text-[#9CA3AF]" aria-hidden="true" />
            <span className="text-sm font-medium text-[#525866] dark:text-[#9CA3AF]">
              {product.title[lang]}
            </span>
          </div>
        )}

        {/* Quick Size Selection Drawer on Bottom Edge of Card */}
        {sizeMenuOpen && (
          <div
            className="absolute inset-x-3 bottom-3 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#13161C]/95 p-3 shadow-lg backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                {pendingAdd ? t.catalog.pickSizePrompt : t.catalog.selectSizeBtn}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSizeMenuOpen(false);
                  setPendingAdd(false);
                }}
                aria-label={t.productModal.close}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#525866] hover:bg-black/[0.06] dark:text-[#9CA3AF] dark:hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {product.sizes.map((sz) => {
                const isSelected = selectedSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => handlePickSize(sz)}
                    className={`inline-flex h-9 min-w-[40px] flex-1 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1D4ED8] text-white dark:bg-[#3B82F6]'
                        : 'border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#0B0D11] text-[#0F1115] dark:text-[#F4F5F7] hover:bg-[#0F1115] hover:text-white dark:hover:bg-[#F4F5F7] dark:hover:text-[#0B0D11]'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Clean Unboxed Metadata & Card Actions */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#525866] dark:text-[#9CA3AF]">
            <span>{t.catalog.categories[product.category]}</span>
            <span aria-hidden="true">·</span>
            <span>{product.color[lang]}</span>
            {product.tag && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                  {product.tag[lang]}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => onQuickView(product)}
            className="mt-1.5 block text-start font-semibold text-base text-[#0F1115] dark:text-[#F4F5F7] hover:text-[#1D4ED8] dark:hover:text-[#60A5FA] transition-colors cursor-pointer"
          >
            {product.title[lang]}
          </button>
          <p className="mt-0.5 text-xs text-[#525866] dark:text-[#9CA3AF] line-clamp-1">
            {product.subtitle[lang]}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.07] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
              {price}
            </span>
            <button
              type="button"
              onClick={() => onQuickView(product)}
              className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-[#525866] hover:bg-black/[0.05] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:bg-white/[0.06] dark:hover:text-[#F4F5F7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.catalog.quickViewBtn}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingAdd(false);
                setSizeMenuOpen((prev) => !prev);
              }}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedSize || sizeMenuOpen
                  ? 'border-[#1D4ED8] bg-[#1D4ED8]/10 text-[#1D4ED8] dark:border-[#60A5FA] dark:bg-[#3B82F6]/15 dark:text-[#93C5FD]'
                  : 'border-black/[0.12] dark:border-white/[0.14] text-[#0F1115] hover:bg-black/[0.04] dark:text-[#F4F5F7] dark:hover:bg-white/[0.06]'
              }`}
            >
              <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {selectedSize ? `${t.cart.size}: ${selectedSize}` : t.catalog.selectSizeBtn}
              </span>
            </button>

            <button
              type="button"
              onClick={handleAddClick}
              aria-label={t.catalog.addToBagBtn}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0F1115] px-3 text-xs font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#F4F5F7] dark:text-[#0B0D11] dark:hover:bg-[#60A5FA] transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShoppingBag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{t.catalog.addToBagBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
