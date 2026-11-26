import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, MapPin, Search } from 'lucide-react';
import { HERO_CAMPAIGN_IMAGE, PRODUCTS } from './data/products';
import { TRANSLATIONS } from './i18n/translations';
import type { CartItem, CategoryKey, Language, Product, Theme } from './types';
import { Header } from './components/Header';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { BrandLogo } from './components/BrandLogo';
import { AtelierLocationsMap } from './components/AtelierLocationsMap';
import { OrdersHistoryModal } from './components/OrdersHistoryModal';
import { StaffPortalPage } from './components/StaffPortalPage';

const CATEGORIES: CategoryKey[] = ['all', 'outerwear', 'tailoring', 'knitwear', 'shirts'];

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
  const [activeView, setActiveView] = useState<'store' | 'staff'>(() => {
    try {
      return window.location.hash === '#/staff' || window.location.hash === '#staff'
        ? 'staff'
        : 'store';
    } catch {
      return 'store';
    }
  });
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryAddressNonce, setDeliveryAddressNonce] = useState(0);
  const [isPickingCheckoutLocation, setIsPickingCheckoutLocation] = useState(false);
  const [startCartAtCheckout, setStartCartAtCheckout] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash;
      setActiveView(h === '#/staff' || h === '#staff' ? 'staff' : 'store');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const openStaffPortal = () => {
    setActiveView('staff');
    if (window.location.hash !== '#/staff') {
      window.location.hash = '#/staff';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openStorefront = () => {
    setActiveView('store');
    if (window.location.hash === '#/staff' || window.location.hash === '#staff') {
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

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
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
  }, [activeCategory, searchQuery]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const handleAddToBag = (product: Product, size: string) => {
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
        .map((item) =>
          item.product.id === productId && item.size === size
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string, size: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.product.id === productId && item.size === size))
    );
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8F8FA] text-[#0F1115] dark:bg-[#0B0D11] dark:text-[#F4F5F7] transition-colors duration-200">
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
        activeView={activeView}
        onToggleLang={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenOrders={() => setIsOrdersOpen(true)}
        onOpenStaffPortal={openStaffPortal}
        onOpenStore={openStorefront}
      />

      <main className="flex-1">
        {activeView === 'staff' ? (
          <StaffPortalPage lang={lang} onBackToStore={openStorefront} />
        ) : (
          <>
            {/* Section 1: Storefront Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-12 sm:pt-10 sm:pb-16">
          <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#13161C]">
            <div className="aspect-[16/10] sm:aspect-[16/9] lg:aspect-[21/9] w-full">
              <img
                src={HERO_CAMPAIGN_IMAGE}
                alt={t.hero.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-center"
              />
            </div>

            {/* Measured Contrast Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />

            <div className="absolute inset-0 flex items-end p-6 sm:p-10 lg:p-12">
              <div className="max-w-2xl">
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
                    href="#atelier"
                    className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors whitespace-nowrap"
                  >
                    <span>{t.hero.secondaryCta}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
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
            {CATEGORIES.map((category) => {
              const active = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`h-9 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-[#0F1115] shadow-xs dark:bg-[#232833] dark:text-[#F4F5F7]'
                      : 'text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7]'
                  }`}
                >
                  {t.catalog.categories[category]}
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

        {/* Section 3: House Craft & Material Standards */}
        <section
          id="atelier"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-black/[0.06] dark:border-white/[0.07]"
        >
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-4">
              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#0F1115] dark:text-[#F4F5F7] [text-wrap:balance]">
                {t.craft.heading}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#525866] dark:text-[#9CA3AF]">
                {t.craft.subheading}
              </p>
            </div>

            <div className="lg:col-span-8 grid gap-6 sm:grid-cols-3">
              {t.craft.pillars.map((pillar) => (
                <div
                  key={pillar.index}
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
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Egypt Boutiques, Address Autocomplete & Delivery Route */}
        <section
          id="locations"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-black/[0.06] dark:border-white/[0.07]"
        >
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'خرائط جوجل · مصر' : 'Google Maps Platform · Egypt'}</span>
              </div>
              <h2 className="mt-2 font-editorial text-2xl sm:text-3xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                {lang === 'ar' ? 'فروعنا في مصر ومسار التوصيل' : 'Egypt Boutique Locator & Delivery Routing'}
              </h2>
              <p className="mt-2 text-sm text-[#525866] dark:text-[#9CA3AF]">
                {lang === 'ar'
                  ? 'ابحث عن عنوانك جوه مصر عشان تحدد مسار التوصيل والمسافة، والعنوان هيتكتب تلقائياً في شنطة الأوردر.'
                  : 'Search your street address in Egypt to preview the delivery route and auto-fill your checkout address.'}
              </p>
            </div>
          </div>

          <AtelierLocationsMap
            lang={lang}
            apiKey={mapsApiKey}
            isPickingForCheckout={isPickingCheckoutLocation}
            onConfirmCheckoutLocation={() => {
              setIsPickingCheckoutLocation(false);
              setStartCartAtCheckout(true);
              setIsCartOpen(true);
            }}
            onSelectDeliveryAddress={(addr) => {
              setDeliveryAddress(addr);
              setDeliveryAddressNonce((n) => n + 1);
              setToastText(
                lang === 'ar'
                  ? 'تم تحديد عنوان التوصيل في الشنطة'
                  : 'Delivery address synced to bag'
              );
            }}
          />
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
        prefillAddress={deliveryAddress}
        prefillNonce={deliveryAddressNonce}
        startAtCheckout={startCartAtCheckout}
        onClose={() => {
          setIsCartOpen(false);
          setStartCartAtCheckout(false);
        }}
        onRequestMapPicker={() => {
          setIsCartOpen(false);
          setIsPickingCheckoutLocation(true);
          document.getElementById('locations')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCart([])}
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
  );
}
