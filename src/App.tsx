import { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion, useScroll } from 'motion/react';
import { ArrowUpRight, Check, Search } from 'lucide-react';
import { HERO_CAMPAIGN_IMAGE, PRODUCTS } from './data/products';
import { TRANSLATIONS } from './i18n/translations';
import type { CartItem, CategoryKey, Language, Product, StoreCategory, Theme } from './types';
import { Header } from './components/Header';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { BrandLogo } from './components/BrandLogo';
import { WorkflowShowcase } from './components/WorkflowShowcase';
import { OrdersHistoryModal } from './components/OrdersHistoryModal';
import { StaffPortalPage } from './components/StaffPortalPage';

const DEFAULT_STORE_CATEGORIES: StoreCategory[] = [
  { id: 1, slug: 'outerwear', nameAr: 'بالطوهات وجواكت', nameEn: 'Outerwear', isActive: true, sortOrder: 0 },
  { id: 2, slug: 'tailoring', nameAr: 'بليزرات وتفصيل', nameEn: 'Tailoring', isActive: true, sortOrder: 1 },
  { id: 3, slug: 'knitwear', nameAr: 'تريكو وبلوفرات', nameEn: 'Knitwear', isActive: true, sortOrder: 2 },
  { id: 4, slug: 'shirts', nameAr: 'قمصان', nameEn: 'Shirts', isActive: true, sortOrder: 3 },
];

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('maraya-lang');
      return saved === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('maraya-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const isStaffLocation = () => {
    try {
      const p = window.location.pathname.replace(/\/+$/, '');
      const h = window.location.hash;
      return p === '/staff' || h === '#/staff' || h === '#staff';
    } catch {
      return false;
    }
  };

  const [activeView, setActiveView] = useState<'store' | 'staff'>(() =>
    isStaffLocation() ? 'staff' : 'store'
  );
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>(DEFAULT_STORE_CATEGORIES);
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const { scrollYProgress } = useScroll();
  const t = TRANSLATIONS[lang];

  const refreshProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) return;
      const data = (await res.json()) as {
        products?: Product[];
        categories?: StoreCategory[];
      };
      if (Array.isArray(data.categories)) {
        setStoreCategories(data.categories);
      }
      if (Array.isArray(data.products)) {
        const nextProducts = data.products;
        setProducts(nextProducts);
        setDetailProduct((prev) =>
          prev ? nextProducts.find((p) => p.id === prev.id) ?? prev : null
        );
        setCart((prev) =>
          prev
            .map((item) => {
              const latest = nextProducts.find((p) => p.id === item.product.id);
              if (!latest) return item;
              const sizeLimit =
                latest.sizeStock && typeof latest.sizeStock[item.size] === 'number'
                  ? latest.sizeStock[item.size]
                  : typeof latest.stockQty === 'number'
                  ? latest.stockQty
                  : 99;
              return {
                ...item,
                product: latest,
                quantity: Math.min(item.quantity, sizeLimit),
              };
            })
            .filter((item) => item.product.isActive !== false && item.quantity > 0)
        );
      }
    } catch {
      // Keep fallback catalog on transient errors
    }
  }, []);

  useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  useEffect(() => {
    const syncRoute = () => {
      setActiveView(isStaffLocation() ? 'staff' : 'store');
    };
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  const openStaffPortal = () => {
    setActiveView('staff');
    if (window.location.pathname.replace(/\/+$/, '') !== '/staff') {
      try {
        window.history.pushState(null, '', '/staff');
      } catch {
        window.location.hash = '#/staff';
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openStorefront = () => {
    setActiveView('store');
    if (window.location.pathname.replace(/\/+$/, '') === '/staff') {
      try {
        window.history.pushState(null, '', '/');
      } catch {
        window.location.hash = '#top';
      }
    } else if (window.location.hash === '#/staff' || window.location.hash === '#staff') {
      window.location.hash = '#top';
    }
  };

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    if (mapsApiKey) return;
    let cancelled = false;
    fetch('/api/maps/key')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { apiKey?: string } | null) => {
        if (!cancelled && data?.apiKey) {
          setMapsApiKey(data.apiKey);
        }
      })
      .catch(() => {
        // Ignore fallback fetch errors
      });
    return () => {
      cancelled = true;
    };
  }, [mapsApiKey]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('maraya-lang', lang);
    } catch {
      // Ignore storage errors
    }
  }, [lang]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('maraya-theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    if (!toastText) return;
    const timer = window.setTimeout(() => setToastText(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastText]);

  const categoryLabelMap = useMemo(() => {
    const map: Record<string, { ar: string; en: string }> = {
      all: { ar: TRANSLATIONS.ar.catalog.categories.all, en: TRANSLATIONS.en.catalog.categories.all },
      outerwear: {
        ar: TRANSLATIONS.ar.catalog.categories.outerwear,
        en: TRANSLATIONS.en.catalog.categories.outerwear,
      },
      tailoring: {
        ar: TRANSLATIONS.ar.catalog.categories.tailoring,
        en: TRANSLATIONS.en.catalog.categories.tailoring,
      },
      knitwear: {
        ar: TRANSLATIONS.ar.catalog.categories.knitwear,
        en: TRANSLATIONS.en.catalog.categories.knitwear,
      },
      shirts: {
        ar: TRANSLATIONS.ar.catalog.categories.shirts,
        en: TRANSLATIONS.en.catalog.categories.shirts,
      },
    };
    for (const cat of storeCategories) {
      map[cat.slug] = { ar: cat.nameAr, en: cat.nameEn };
    }
    return map;
  }, [storeCategories]);

  useEffect(() => {
    if (
      activeCategory !== 'all' &&
      !storeCategories.some((c) => c.slug === activeCategory)
    ) {
      setActiveCategory('all');
    }
  }, [activeCategory, storeCategories]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        p.title.ar.toLowerCase().includes(q) ||
        p.title.en.toLowerCase().includes(q) ||
        p.subtitle.ar.toLowerCase().includes(q) ||
        p.subtitle.en.toLowerCase().includes(q) ||
        p.color.ar.toLowerCase().includes(q) ||
        p.color.en.toLowerCase().includes(q)
      );
    });
  }, [products, activeCategory, searchQuery]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const handleAddToBag = (product: Product, size: string) => {
    const maxStockForSize =
      product.sizeStock && typeof product.sizeStock[size] === 'number'
        ? product.sizeStock[size]
        : typeof product.stockQty === 'number'
        ? product.stockQty
        : 99;
    if (maxStockForSize <= 0) {
      setToastText(
        lang === 'ar'
          ? `مقاس ${size} نفذت كميته حالياً`
          : `Size ${size} is currently out of stock`
      );
      return;
    }

    const currentForSize =
      cart.find((i) => i.product.id === product.id && i.size === size)?.quantity ?? 0;
    if (currentForSize >= maxStockForSize) {
      setToastText(
        lang === 'ar'
          ? `وصلت للحد الأقصى المتاح لمقاس ${size} (${maxStockForSize})`
          : `Maximum available stock reached for size ${size} (${maxStockForSize})`
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && i.size === size);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && i.size === size
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, size, quantity: 1 }];
    });
    setToastText(`${product.title[lang]} (${size})`);
  };

  const handleUpdateQty = (productId: string, size: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId || item.size !== size) return item;
          const maxStock =
            item.product.sizeStock && typeof item.product.sizeStock[size] === 'number'
              ? item.product.sizeStock[size]
              : typeof item.product.stockQty === 'number'
              ? item.product.stockQty
              : 99;
          const nextQty = delta > 0 ? Math.min(maxStock, item.quantity + delta) : item.quantity + delta;
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string, size: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.product.id === productId && item.size === size))
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className="min-h-screen flex flex-col bg-[#F8F8FA] text-[#0F1115] dark:bg-[#0B0D11] dark:text-[#F4F5F7] transition-colors duration-200">
        {/* Subtle Scroll Progress Indicator */}
        <motion.div
          aria-hidden="true"
          style={{ scaleX: scrollYProgress }}
          className="fixed top-0 inset-x-0 z-50 h-[2.5px] origin-left bg-[#1D4ED8] dark:bg-[#60A5FA]"
        />
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Header
        lang={lang}
        theme={theme}
        t={t}
        cartCount={cartCount}
        onToggleLang={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenOrders={() => setIsOrdersOpen(true)}
        onOpenStore={openStorefront}
      />

      <main className="flex-1">
        {activeView === 'staff' ? (
          <StaffPortalPage
            lang={lang}
            onBackToStore={openStorefront}
            onCatalogUpdated={() => void refreshProducts()}
          />
        ) : (
          <>
            {/* Section 1: Storefront Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-12 sm:pt-10 sm:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#13161C]"
          >
            <div className="aspect-[16/10] sm:aspect-[16/9] lg:aspect-[21/9] w-full overflow-hidden">
              <motion.img
                initial={{ scale: 1.04 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                src={HERO_CAMPAIGN_IMAGE}
                alt={t.hero.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-center"
              />
            </div>

            {/* Measured Contrast Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />

            <div className="absolute inset-0 flex items-end p-6 sm:p-10 lg:p-12">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-2xl"
              >
                <p className="text-xs sm:text-sm font-medium text-white/80">
                  {t.hero.kicker}
                </p>
                <h1 className="mt-2 font-editorial text-3xl sm:text-5xl font-semibold tracking-tight text-white [text-wrap:balance] leading-[1.12]">
                  {t.hero.title}
                </h1>
                <p className="mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-white/85">
                  {t.hero.subtitle}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href="#collection"
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1D4ED8] px-5 text-sm font-semibold text-white hover:bg-[#2563EB] transition-colors whitespace-nowrap"
                  >
                    <span>{t.hero.primaryCta}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                  <a
                    href="#workflow"
                    className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors whitespace-nowrap"
                  >
                    <span>{lang === 'ar' ? 'إزاي تطلب خطوة بخطوة' : 'How Ordering Works'}</span>
                  </a>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* Section 2: Featured Collection */}
        <section
          id="collection"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 border-t border-black/[0.06] dark:border-white/[0.07]"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <h2 className="font-editorial text-2xl sm:text-4xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                {t.catalog.heading}
              </h2>
              <p className="mt-2 text-sm text-[#525866] dark:text-[#9CA3AF]">
                {t.catalog.subheading}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search
                className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-[#525866] dark:text-[#9CA3AF]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.catalog.searchPlaceholder}
                className="h-10 w-full rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#13161C] ps-10 pe-4 text-sm text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/70 dark:placeholder:text-[#9CA3AF]/70 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>

          {/* Interactive Category Filter Segmented Controls */}
          <div className="mt-6 flex flex-wrap items-center gap-1.5 rounded-xl bg-[#ECEEF2] dark:bg-[#13161C] p-1.5 w-fit max-w-full">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`h-9 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-white text-[#0F1115] shadow-xs dark:bg-[#232833] dark:text-[#F4F5F7]'
                  : 'text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7]'
              }`}
            >
              {t.catalog.categories.all}
            </button>
            {storeCategories.map((cat) => {
              const active = activeCategory === cat.slug;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`h-9 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-[#0F1115] shadow-xs dark:bg-[#232833] dark:text-[#F4F5F7]'
                      : 'text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7]'
                  }`}
                >
                  {lang === 'ar' ? cat.nameAr : cat.nameEn}
                </button>
              );
            })}
          </div>

          {/* 3-Column Product Grid */}
          {filteredProducts.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryLabel={categoryLabelMap[product.category]?.[lang] ?? product.category}
                  lang={lang}
                  t={t}
                  onQuickView={(item) => setDetailProduct(item)}
                  onQuickAdd={handleAddToBag}
                />
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-12 text-center">
              <p className="text-sm text-[#525866] dark:text-[#9CA3AF]">{t.catalog.emptyState}</p>
            </div>
          )}
        </section>

        {/* Section 3: Interactive Scroll-Triggered Ordering Workflow */}
        <WorkflowShowcase
          lang={lang}
          cartCount={cartCount}
          onOpenCart={() => setIsCartOpen(true)}
          onOpenOrders={() => setIsOrdersOpen(true)}
        />

        {/* Section 4: House Craft & Material Standards */}
        <section
          id="atelier"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-black/[0.06] dark:border-white/[0.07]"
        >
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-4"
            >
              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#0F1115] dark:text-[#F4F5F7] [text-wrap:balance]">
                {t.craft.heading}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#525866] dark:text-[#9CA3AF]">
                {t.craft.subheading}
              </p>
            </motion.div>

            <div className="lg:col-span-8 grid gap-6 sm:grid-cols-3">
              {t.craft.pillars.map((pillar, idx) => (
                <motion.div
                  key={pillar.index}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -3 }}
                  className="rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-6"
                >
                  <span className="font-mono text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA] tabular-nums">
                    {pillar.index}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#525866] dark:text-[#9CA3AF]">
                    {pillar.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
          </>
        )}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="border-t border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="space-y-1.5">
            <BrandLogo lang={lang} />
            <p className="text-xs text-[#525866] dark:text-[#9CA3AF]">{t.footer.tagline}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#525866] dark:text-[#9CA3AF]">
            <button
              type="button"
              onClick={openStaffPortal}
              className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap cursor-pointer"
            >
              {lang === 'ar' ? 'دخول الموظفين (جوجل)' : 'Staff Portal (Google Sign-In)'}
            </button>
            <span aria-hidden="true">·</span>
            <span>{t.footer.rights}</span>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={detailProduct}
        categoryLabel={
          detailProduct
            ? categoryLabelMap[detailProduct.category]?.[lang] ?? detailProduct.category
            : undefined
        }
        lang={lang}
        t={t}
        onClose={() => setDetailProduct(null)}
        onAddToBag={handleAddToBag}
      />

      <CartDrawer
        isOpen={isCartOpen}
        items={cart}
        lang={lang}
        t={t}
        mapsApiKey={mapsApiKey}
        onClose={() => setIsCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCart([])}
        onOrderPlaced={() => void refreshProducts()}
      />

      <OrdersHistoryModal
        isOpen={isOrdersOpen}
        lang={lang}
        onClose={() => setIsOrdersOpen(false)}
      />

      {/* Quick-Add Toast Feedback */}
      {toastText && (
        <div
          role="status"
          className="fixed bottom-5 end-5 z-50 inline-flex items-center gap-2 rounded-lg bg-[#0F1115] px-4 py-2.5 text-xs font-semibold text-white shadow-lg dark:bg-[#F4F5F7] dark:text-[#0B0D11]"
        >
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600" aria-hidden="true" />
          <span>{toastText}</span>
        </div>
      )}
      </div>
    </MotionConfig>
  );
}
