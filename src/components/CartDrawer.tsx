import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  BookmarkCheck,
  CheckCircle2,
  Loader2,
  LocateFixed,
  LogIn,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AtelierLocationsMap } from './AtelierLocationsMap';
import type { CartItem, Language } from '../types';
import type { Translations } from '../i18n/translations';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  lang: Language;
  t: Translations;
  mapsApiKey: string;
  onClose: () => void;
  onUpdateQty: (productId: string, size: string, delta: number) => void;
  onRemoveItem: (productId: string, size: string) => void;
  onClearCart: () => void;
  onOrderPlaced?: () => void;
}

interface ConfirmedOrder {
  orderRef: string;
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: 'cod' | 'card';
  totalLabel: string;
  items: Array<{ title: string; size: string; quantity: number }>;
}

export function CartDrawer({
  isOpen,
  items,
  lang,
  t,
  mapsApiKey,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderPlaced,
}: CartDrawerProps) {
  const { user, savedProfile, signInWithGoogle, getFreshToken, saveCheckoutContact } = useAuth();
  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>('bag');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'card'>('cod');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  const [locationSource, setLocationSource] = useState<'none' | 'saved' | 'gps' | 'map' | 'manual'>('none');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [locationSavedToast, setLocationSavedToast] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const autoTriedGpsRef = useRef(false);

  const persistLocationIfSignedIn = useCallback(
    async (nextAddress: string) => {
      if (!user || !nextAddress.trim()) return;
      try {
        await saveCheckoutContact(phone.trim() || savedProfile?.phone || '', nextAddress.trim(), lang);
        setLocationSavedToast(true);
        window.setTimeout(() => setLocationSavedToast(false), 2200);
      } catch {
        // Non-blocking background save
      }
    },
    [user, phone, savedProfile?.phone, lang, saveCheckoutContact]
  );

  const detectCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError(t.cart.locationDeniedHint);
      return;
    }

    setIsDetectingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(
            `/api/maps/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&lang=${lang}`
          );
          if (res.status === 429) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          const data = (await res.json()) as { address?: string };
          const resolved =
            data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setAddress(resolved);
          setLocationSource('gps');
          if (user) {
            void persistLocationIfSignedIn(resolved);
          }
        } catch {
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setAddress(fallback);
          setLocationSource('gps');
          if (user) {
            void persistLocationIfSignedIn(fallback);
          }
        } finally {
          setIsDetectingLocation(false);
        }
      },
      () => {
        setIsDetectingLocation(false);
        setLocationError(t.cart.locationDeniedHint);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [lang, t.cart.locationDeniedHint, user, persistLocationIfSignedIn]);

  useEffect(() => {
    if (user && !fullName && (savedProfile?.displayName || user.displayName)) {
      setFullName(savedProfile?.displayName || user.displayName || '');
    }
    if (savedProfile?.phone && !phone) {
      setPhone(savedProfile.phone);
    }
  }, [user, savedProfile, fullName, phone]);

  // Restore saved customer address if signed in; otherwise auto-detect GPS location
  useEffect(() => {
    if (!isOpen || step !== 'checkout') return;

    if (user && savedProfile?.savedAddress && (locationSource === 'none' || locationSource === 'saved')) {
      if (address !== savedProfile.savedAddress) {
        setAddress(savedProfile.savedAddress);
      }
      if (locationSource !== 'saved') {
        setLocationSource('saved');
      }
      return;
    }

    if (locationSource !== 'none') return;
    if (autoTriedGpsRef.current) return;

    autoTriedGpsRef.current = true;
    void detectCurrentLocation();
  }, [isOpen, step, user, savedProfile?.savedAddress, locationSource, address, detectCurrentLocation]);

  if (!isOpen) return null;

  const subtotalEgp = items.reduce((sum, item) => sum + item.product.priceEgp * item.quantity, 0);

  const formattedSubtotal = `${subtotalEgp.toLocaleString('en-US')} ${t.catalog.currency}`;

  const qualifiesFreeShipping = subtotalEgp >= 15000;
  const shippingCostLabel = qualifiesFreeShipping
    ? t.cart.freeShipping
    : `150 ${t.catalog.currency}`;

  const totalAmountNumeric = subtotalEgp + (qualifiesFreeShipping ? 0 : 150);

  const totalWithShippingLabel = `${totalAmountNumeric.toLocaleString('en-US')} ${t.catalog.currency}`;

  const handleCheckoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();
    const cleanNotes = notes.trim();
    if (!cleanName || !cleanPhone || !cleanAddress || items.length === 0) return;

    setIsSubmitting(true);
    setCheckoutError(null);
    let orderRef = `MRY-${Math.floor(1000 + Math.random() * 9000)}`;
    let confirmedTotalLabel = totalWithShippingLabel;

    try {
      const token = await getFreshToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fullName: cleanName,
          phone: cleanPhone,
          address: cleanAddress,
          notes: cleanNotes,
          paymentMethod,
          currency: 'EGP',
          totalAmount: totalAmountNumeric,
          items: items.map((i) => ({
            sku: i.product.sku,
            title: i.product.title[lang],
            size: i.size,
            quantity: i.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        setCheckoutError(
          errData.error ||
            (lang === 'ar'
              ? 'تعذر إتمام الطلب الآن، يرجى مراجعة الكميات المتاحة.'
              : 'Unable to complete order. Please check available stock.')
        );
        setIsSubmitting(false);
        return;
      }

      const data = (await res.json()) as { orderRef?: string; totalAmount?: number };
      if (data.orderRef) orderRef = data.orderRef;
      if (typeof data.totalAmount === 'number') {
        confirmedTotalLabel = `${data.totalAmount.toLocaleString('en-US')} ${t.catalog.currency}`;
      }

      if (user) {
        void saveCheckoutContact(cleanPhone, cleanAddress, lang);
      }
      onOrderPlaced?.();
    } catch {
      setCheckoutError(
        lang === 'ar'
          ? 'حدث خطأ في الاتصال بالخادم، يرجى المحاولة مرة أخرى.'
          : 'Network error while submitting your order. Please try again.'
      );
      setIsSubmitting(false);
      return;
    }

    setConfirmedOrder({
      orderRef,
      fullName: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      notes: cleanNotes,
      paymentMethod,
      totalLabel: confirmedTotalLabel,
      items: items.map((i) => ({
        title: i.product.title[lang],
        size: i.size,
        quantity: i.quantity,
      })),
    });

    setIsSubmitting(false);
    setStep('confirmed');
    setFullName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setLocationSource('none');
    setIsMapPickerOpen(false);
    setLocationError(null);
    autoTriedGpsRef.current = false;
    onClearCart();
  };

  const handleClose = () => {
    if (step === 'confirmed') {
      setStep('bag');
      setConfirmedOrder(null);
    }
    setIsMapPickerOpen(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.cart.title}
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div
        className={`flex h-full w-full flex-col bg-white dark:bg-[#13161C] border-s border-black/[0.08] dark:border-white/[0.08] shadow-2xl transition-[max-width] duration-200 ${
          step === 'checkout' && isMapPickerOpen ? 'max-w-lg' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-black/[0.07] dark:border-white/[0.08] px-6 py-4">
          <h2 className="font-editorial text-xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
            {step === 'checkout' ? t.cart.checkoutTitle : t.cart.title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t.productModal.close}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#525866] hover:bg-black/[0.05] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'confirmed' && confirmedOrder ? (
            <div className="flex flex-col items-center text-center py-6">
              <CheckCircle2
                className="h-12 w-12 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <h3 className="mt-4 font-editorial text-2xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                {t.cart.confirmedTitle}
              </h3>
              <p className="mt-2 text-sm text-[#525866] dark:text-[#9CA3AF] max-w-xs">
                {t.cart.confirmedDesc}
              </p>

              <div className="mt-5 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#F8F8FA] dark:bg-[#0B0D11] p-4 text-start space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.07]">
                  <span className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                    {t.cart.customerSummaryTitle}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#1D4ED8] dark:text-[#60A5FA]">
                    {confirmedOrder.orderRef}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#525866] dark:text-[#9CA3AF]">{t.cart.fullName}:</span>
                  <span className="font-medium text-[#0F1115] dark:text-[#F4F5F7] text-end">
                    {confirmedOrder.fullName}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#525866] dark:text-[#9CA3AF]">{t.cart.phone}:</span>
                  <span className="font-medium tabular-nums text-[#0F1115] dark:text-[#F4F5F7] text-end" dir="ltr">
                    {confirmedOrder.phone}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#525866] dark:text-[#9CA3AF] shrink-0">{t.cart.cityAddress}:</span>
                  <span className="font-medium text-[#0F1115] dark:text-[#F4F5F7] text-end">
                    {confirmedOrder.address}
                  </span>
                </div>
                {confirmedOrder.notes && (
                  <div className="flex justify-between gap-3">
                    <span className="text-[#525866] dark:text-[#9CA3AF] shrink-0">{t.cart.notes}:</span>
                    <span className="font-medium text-[#0F1115] dark:text-[#F4F5F7] text-end">
                      {confirmedOrder.notes}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.07] space-y-1">
                  {confirmedOrder.items.map((item, idx) => (
                    <div key={`${item.title}-${item.size}-${idx}`} className="flex justify-between gap-2 text-[#525866] dark:text-[#D1D5DB]">
                      <span className="truncate">
                        {item.title} ({item.size})
                      </span>
                      <span className="tabular-nums shrink-0">×{item.quantity}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5 font-semibold text-sm text-[#0F1115] dark:text-[#F4F5F7]">
                    <span>{t.cart.subtotal}</span>
                    <span className="tabular-nums">{confirmedOrder.totalLabel}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#0F1115] px-6 text-sm font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#F4F5F7] dark:text-[#0B0D11] dark:hover:bg-[#60A5FA] transition-colors cursor-pointer"
              >
                {t.cart.continueShopping}
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-10">
              <ShoppingBag
                className="h-10 w-10 text-[#525866] dark:text-[#9CA3AF]"
                aria-hidden="true"
              />
              <h3 className="mt-4 text-base font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                {t.cart.emptyTitle}
              </h3>
              <p className="mt-1.5 text-sm text-[#525866] dark:text-[#9CA3AF] max-w-xs">
                {t.cart.emptyDesc}
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[#0F1115] px-5 text-xs font-semibold text-white dark:bg-[#F4F5F7] dark:text-[#0B0D11] cursor-pointer"
              >
                {t.cart.browseBtn}
              </button>
            </div>
          ) : step === 'checkout' ? (
            <form id="checkout-form" onSubmit={(e) => void handleCheckoutSubmit(e)} className="space-y-4">
              {checkoutError && (
                <div className="rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs font-medium text-red-700 dark:text-red-300">
                  {checkoutError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                  {t.cart.fullName}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  placeholder={t.cart.fullNamePlaceholder}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3.5 text-sm text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/60 dark:placeholder:text-[#9CA3AF]/60 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                  {t.cart.phone}
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  placeholder={t.cart.phonePlaceholder}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3.5 text-sm tabular-nums text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/60 dark:placeholder:text-[#9CA3AF]/60 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {t.cart.cityAddress}
                  </label>
                  {isDetectingLocation ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      <span>{t.cart.detectingLocation}</span>
                    </span>
                  ) : locationSource === 'saved' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <BookmarkCheck className="h-3 w-3" aria-hidden="true" />
                      <span>
                        {lang === 'ar'
                          ? 'عنوانك المحفوظ في حسابك'
                          : 'Saved to your account'}
                      </span>
                    </span>
                  ) : locationSource === 'gps' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <LocateFixed className="h-3 w-3" aria-hidden="true" />
                      <span>{t.cart.currentLocationActive}</span>
                    </span>
                  ) : locationSource === 'map' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      <span>{t.cart.chosenLocationActive}</span>
                    </span>
                  ) : null}
                </div>

                <textarea
                  rows={2}
                  required
                  value={address}
                  placeholder={t.cart.cityAddressPlaceholder}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setLocationSource('manual');
                    setLocationError(null);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent p-3.5 text-sm text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/60 dark:placeholder:text-[#9CA3AF]/60 focus:border-[#1D4ED8] focus:outline-none"
                />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void detectCurrentLocation()}
                    disabled={isDetectingLocation}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                      locationSource === 'gps'
                        ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-300'
                        : 'border-black/[0.12] dark:border-white/[0.14] text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8]'
                    }`}
                  >
                    <LocateFixed className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{t.cart.useCurrentLocationBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen((prev) => !prev)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                      isMapPickerOpen
                        ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white dark:border-[#3B82F6] dark:bg-[#3B82F6]'
                        : 'border-black/[0.12] dark:border-white/[0.14] text-[#1D4ED8] dark:text-[#60A5FA] hover:border-[#1D4ED8] dark:hover:border-[#60A5FA]'
                    }`}
                  >
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>
                      {isMapPickerOpen
                        ? lang === 'ar'
                          ? 'إخفاء الخريطة'
                          : 'Hide Map'
                        : t.cart.chooseLocationOnMapBtn}
                    </span>
                  </button>

                  {user && address.trim() && address.trim() !== savedProfile?.savedAddress && (
                    <button
                      type="button"
                      onClick={() => void persistLocationIfSignedIn(address)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-2.5 text-[11px] font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      <BookmarkCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>
                        {lang === 'ar' ? 'حفظ في حسابي' : 'Save to Account'}
                      </span>
                    </button>
                  )}
                </div>

                {locationSavedToast && (
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    {lang === 'ar'
                      ? 'تم حفظ العنوان في حسابك وهيفضل محفوظ معاك في الأوردرات الجاية.'
                      : 'Location saved to your account for future orders.'}
                  </p>
                )}

                {!user && (
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                  >
                    <LogIn className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'سجل دخول بجوجل عشان اللوكيشن يفضل محفوظ مع حسابك دايماً'
                        : 'Sign in with Google to keep this location saved to your profile'}
                    </span>
                  </button>
                )}

                {locationError && (
                  <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                    {locationError}
                  </p>
                )}

                {isMapPickerOpen && (
                  <div className="mt-3 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#F8F8FA] dark:bg-[#0B0D11] p-3">
                    <AtelierLocationsMap
                      compact
                      lang={lang}
                      apiKey={mapsApiKey}
                      onSelectDeliveryAddress={(pickedAddr) => {
                        setAddress(pickedAddr);
                        setLocationSource('map');
                        setLocationError(null);
                        if (user) {
                          void persistLocationIfSignedIn(pickedAddr);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                  {t.cart.notes}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  placeholder={t.cart.notesPlaceholder}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent p-3.5 text-sm text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/60 dark:placeholder:text-[#9CA3AF]/60 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                  {t.cart.paymentMethod}
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`h-11 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                      paymentMethod === 'cod'
                        ? 'border-[#1D4ED8] bg-[#1D4ED8]/10 text-[#1D4ED8] dark:border-[#60A5FA] dark:bg-[#3B82F6]/15 dark:text-[#93C5FD]'
                        : 'border-black/[0.12] dark:border-white/[0.12] text-[#525866] dark:text-[#9CA3AF]'
                    }`}
                  >
                    {t.cart.codLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`h-11 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-[#1D4ED8] bg-[#1D4ED8]/10 text-[#1D4ED8] dark:border-[#60A5FA] dark:bg-[#3B82F6]/15 dark:text-[#93C5FD]'
                        : 'border-black/[0.12] dark:border-white/[0.12] text-[#525866] dark:text-[#9CA3AF]'
                    }`}
                  >
                    {t.cart.cardLabel}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[#525866] dark:text-[#9CA3AF] pb-2 border-b border-black/[0.06] dark:border-white/[0.07]">
                {t.cart.freeShippingProgress}
              </p>

              {items.map((item) => {
                const itemPrice = `${(item.product.priceEgp * item.quantity).toLocaleString('en-US')} ${t.catalog.currency}`;

                return (
                  <div
                    key={`${item.product.id}-${item.size}`}
                    className="flex gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.07]"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.title[lang]}
                      referrerPolicy="no-referrer"
                      className="h-24 w-18 rounded-lg object-cover object-center bg-[#EBEDF0] dark:bg-[#1B1F27] shrink-0"
                    />
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                            {item.product.title[lang]}
                          </h4>
                          <p className="mt-0.5 text-xs text-[#525866] dark:text-[#9CA3AF]">
                            {t.cart.size}: {item.size}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.product.id, item.size)}
                          aria-label="Remove item"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#525866] hover:text-red-600 dark:text-[#9CA3AF] dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="inline-flex items-center rounded-lg border border-black/[0.1] dark:border-white/[0.12]">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.product.id, item.size, -1)}
                            aria-label="Decrease quantity"
                            className="inline-flex h-8 w-8 items-center justify-center text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-white cursor-pointer"
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={(() => {
                              const sizeLimit =
                                item.product.sizeStock && typeof item.product.sizeStock[item.size] === 'number'
                                  ? item.product.sizeStock[item.size]
                                  : typeof item.product.stockQty === 'number'
                                  ? item.product.stockQty
                                  : null;
                              return sizeLimit !== null && item.quantity >= sizeLimit;
                            })()}
                            onClick={() => onUpdateQty(item.product.id, item.size, 1)}
                            aria-label="Increase quantity"
                            className="inline-flex h-8 w-8 items-center justify-center text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-white disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                          {itemPrice}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {items.length > 0 && step !== 'confirmed' && (
          <div className="border-t border-black/[0.08] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] p-6 space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-[#525866] dark:text-[#9CA3AF]">
                <span>{t.cart.shipping}</span>
                <span className="tabular-nums">{shippingCostLabel}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                <span>{t.cart.subtotal}</span>
                <span className="tabular-nums">{formattedSubtotal}</span>
              </div>
            </div>

            {step === 'bag' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#0F1115] px-5 text-sm font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#F4F5F7] dark:text-[#0B0D11] dark:hover:bg-[#60A5FA] transition-colors cursor-pointer"
              >
                {t.cart.checkoutBtn}
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('bag')}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-4 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] cursor-pointer"
                >
                  {t.cart.backToBag}
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting}
                  className="inline-flex h-11 flex-[2] items-center justify-center rounded-lg bg-[#1D4ED8] px-4 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] transition-colors cursor-pointer"
                >
                  {t.cart.placeOrder}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
