import { Languages, LogIn, LogOut, Moon, Package, ShoppingBag, Sun } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import type { Language, Theme } from '../types';
import type { Translations } from '../i18n/translations';

interface HeaderProps {
  lang: Language;
  theme: Theme;
  t: Translations;
  cartCount: number;
  activeView?: 'store' | 'staff';
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onOpenCart: () => void;
  onOpenOrders: () => void;
  onOpenStaffPortal: () => void;
  onOpenStore: () => void;
}

export function Header({
  lang,
  theme,
  t,
  cartCount,
  activeView = 'store',
  onToggleLang,
  onToggleTheme,
  onOpenCart,
  onOpenOrders,
  onOpenStaffPortal,
  onOpenStore,
}: HeaderProps) {
  const { user, signInWithGoogle, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/[0.08] bg-[#F8F8FA]/90 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0B0D11]/90 transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Lockup */}
        <a
          href="#top"
          onClick={() => onOpenStore()}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] rounded-md shrink-0"
        >
          <BrandLogo lang={lang} />
        </a>

        {/* Zone 2: Concise single-line text nav links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#525866] dark:text-[#9CA3AF]">
          <a
            href="#collection"
            onClick={() => onOpenStore()}
            className="whitespace-nowrap shrink-0 hover:text-[#0F1115] dark:hover:text-[#F4F5F7] transition-colors py-1"
          >
            {t.nav.collection}
          </a>
          <a
            href="#atelier"
            onClick={() => onOpenStore()}
            className="whitespace-nowrap shrink-0 hover:text-[#0F1115] dark:hover:text-[#F4F5F7] transition-colors py-1"
          >
            {t.nav.craftsmanship}
          </a>
          <a
            href="#locations"
            onClick={() => onOpenStore()}
            className="whitespace-nowrap shrink-0 hover:text-[#0F1115] dark:hover:text-[#F4F5F7] transition-colors py-1"
          >
            {lang === 'ar' ? 'الفروع والتوصيل' : 'Locations'}
          </a>
          <button
            type="button"
            onClick={onOpenStaffPortal}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
              activeView === 'staff'
                ? 'text-[#1D4ED8] dark:text-[#60A5FA] font-semibold'
                : 'hover:text-[#0F1115] dark:hover:text-[#F4F5F7]'
            }`}
          >
            {lang === 'ar' ? 'بوابة الموظفين' : 'Staff Portal'}
          </button>
        </nav>

        {/* Zone 3: Account, Language, Theme & Bag */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenOrders}
                title={lang === 'ar' ? 'سجل أوردراتي' : 'Order History'}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/[0.1] dark:border-white/[0.12] px-2.5 text-xs font-semibold text-[#0F1115] hover:bg-black/[0.04] dark:text-[#F4F5F7] dark:hover:bg-white/[0.06] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Package className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                <span className="hidden md:inline max-w-[90px] truncate">
                  {user.displayName?.split(' ')[0] || (lang === 'ar' ? 'أوردراتي' : 'Orders')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#525866] hover:bg-black/[0.05] hover:text-[#0F1115] dark:text-[#D1D5DB] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/[0.1] dark:border-white/[0.12] px-2.5 text-xs font-semibold text-[#0F1115] hover:bg-black/[0.04] dark:text-[#F4F5F7] dark:hover:bg-white/[0.06] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'تسجيل الدخول' : 'Sign in'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleLang}
            aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#525866] hover:bg-black/[0.05] hover:text-[#0F1115] dark:text-[#D1D5DB] dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#525866] hover:bg-black/[0.05] hover:text-[#0F1115] dark:text-[#D1D5DB] dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0F1115] px-3.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#F4F5F7] dark:text-[#0B0D11] dark:hover:bg-[#60A5FA] dark:hover:text-[#0B0D11] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t.nav.bag}</span>
            <span className="tabular-nums opacity-85">({cartCount})</span>
          </button>
        </div>
      </div>
    </header>
  );
}
