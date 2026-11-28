import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Package, Search, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Language } from '../types';
import { OrderTrackingStepper } from './OrderTrackingStepper';

interface OrderItemSummary {
  id: number;
  sku: string;
  title: string;
  size: string;
  quantity: number;
}

interface OrderRecord {
  id: number;
  orderRef: string;
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: string;
  currency: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItemSummary[];
}

interface OrdersHistoryModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
}

export function OrdersHistoryModal({ isOpen, lang, onClose }: OrdersHistoryModalProps) {
  const { savedOrderTokens } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupRef, setLookupRef] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupAttempted, setLookupAttempted] = useState(false);

  const fetchOrders = useCallback(
    async (lookup?: { orderRef: string; phone: string } | null) => {
      const tokens = savedOrderTokens.map((t) => t.token);
      if (tokens.length === 0 && !lookup) {
        setOrders([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/orders/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokens,
            lookup: lookup || null,
          }),
        });
        const data = (await res.json()) as { orders?: OrderRecord[]; error?: string };
        if (!res.ok) {
          setError(data.error || 'Failed to load orders.');
        } else {
          setOrders(data.orders ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to fetch orders.');
      } finally {
        setLoading(false);
      }
    },
    [savedOrderTokens]
  );

  useEffect(() => {
    if (!isOpen) return;
    setLookupAttempted(false);
    void fetchOrders(null);
  }, [isOpen, fetchOrders]);

  if (!isOpen) return null;

  const handleLookupSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanRef = lookupRef.trim();
    const cleanPhone = lookupPhone.trim();
    if (!cleanRef || !cleanPhone) return;
    setLookupAttempted(true);
    void fetchOrders({ orderRef: cleanRef, phone: cleanPhone });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#13161C] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/[0.08] dark:border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
            <h2 className="font-editorial text-xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
              {lang === 'ar' ? 'سجل ومتابعة أوردراتي' : 'My Orders & Live Tracking'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'ar' ? 'اقفل' : 'Close'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#525866] hover:bg-black/[0.05] dark:text-[#9CA3AF] dark:hover:bg-white/[0.08] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Direct Order Lookup by Ref + Phone */}
          <form
            onSubmit={handleLookupSubmit}
            className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] p-4 space-y-3"
          >
            <p className="text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
              {lang === 'ar'
                ? 'تتبع أي أوردر برقم الطلب ورقم الموبايل'
                : 'Track an order by Order Ref & Phone'}
            </p>
            <div className="grid gap-2.5 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <input
                  type="text"
                  dir="ltr"
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value)}
                  placeholder="MRY-3728"
                  className="h-9 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#13161C] px-3 text-xs font-mono text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-5">
                <input
                  type="tel"
                  dir="ltr"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="h-9 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#13161C] px-3 text-xs tabular-nums text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={loading || !lookupRef.trim() || !lookupPhone.trim()}
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'تتبع' : 'Track'}</span>
                </button>
              </div>
            </div>
          </form>

          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-xs text-[#525866] dark:text-[#9CA3AF]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{lang === 'ar' ? 'جاري تحميل الأوردرات...' : 'Loading orders...'}</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-sm text-[#525866] dark:text-[#9CA3AF] py-8">
              {lookupAttempted
                ? lang === 'ar'
                  ? 'لم يتم العثور على طلب مطابق لهذا الرقم ورقم الموبايل.'
                  : 'No order matched that reference number and phone.'
                : lang === 'ar'
                ? 'مفيش أوردرات محفوظة على المتصفح ده لسه — تقدر تبحث برقم الأوردر والموبايل فوق.'
                : 'No orders saved in this browser yet—enter your Order Ref and phone above to track.'}
            </p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#F8F8FA] dark:bg-[#0B0D11] p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.07] pb-2">
                  <span className="font-mono font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                    {order.orderRef}
                  </span>
                  <span className="tabular-nums font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                    {order.totalAmount.toLocaleString('en-US')}{' '}
                    {lang === 'ar' && order.currency === 'EGP' ? 'ج.م' : order.currency}
                  </span>
                </div>
                <OrderTrackingStepper
                  status={order.status}
                  createdAt={order.createdAt}
                  lang={lang}
                />
                <div className="grid gap-1 text-[#525866] dark:text-[#D1D5DB]">
                  <p>
                    <strong className="text-[#0F1115] dark:text-[#F4F5F7]">{order.fullName}</strong> ·{' '}
                    <span dir="ltr">{order.phone}</span>
                  </p>
                  <p>{order.address}</p>
                  {order.notes && <p className="italic">{order.notes}</p>}
                </div>
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.07] space-y-1">
                  {order.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-[#525866] dark:text-[#9CA3AF]">
                      <span>
                        {it.title} ({it.size})
                      </span>
                      <span className="tabular-nums">×{it.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
