import { useEffect, useState } from 'react';
import { Loader2, Package, X } from 'lucide-react';
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
  const { user, getFreshToken } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;

    const loadOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getFreshToken();
        if (!token) return;
        const res = await fetch('/api/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as { orders?: OrderRecord[]; error?: string };
        if (!cancelled) {
          if (!res.ok) {
            setError(data.error || 'Failed to load orders.');
          } else {
            setOrders(data.orders ?? []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to fetch orders.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOrders();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user, getFreshToken]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#13161C] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/[0.08] dark:border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
            <h2 className="font-editorial text-xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
              {lang === 'ar' ? 'سجل أوردراتي' : 'My Order History'}
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

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-xs text-[#525866] dark:text-[#9CA3AF]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{lang === 'ar' ? 'جاري تحميل الأوردرات...' : 'Loading orders...'}</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-sm text-[#525866] dark:text-[#9CA3AF] py-10">
              {lang === 'ar' ? 'مفيش أوردرات متسجلة لحسابك لسه.' : 'No orders saved for your account yet.'}
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
