import { Check, CheckCircle2, PackageCheck, Truck, XCircle } from 'lucide-react';
import type { Language } from '../types';

interface OrderTrackingStepperProps {
  status: string;
  createdAt: string;
  lang: Language;
}

type NormalizedStage = 'processing' | 'shipped' | 'delivered' | 'cancelled';

function normalizeOrderStatus(rawStatus: string): NormalizedStage {
  const s = rawStatus.trim().toLowerCase();
  if (s === 'delivered' || s === 'completed') return 'delivered';
  if (s === 'shipped' || s === 'in_transit' || s === 'out_for_delivery') return 'shipped';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'processing';
}

export function OrderTrackingStepper({
  status,
  createdAt,
  lang,
}: OrderTrackingStepperProps) {
  const stage = normalizeOrderStatus(status);

  const formattedDate = (() => {
    try {
      const d = new Date(createdAt);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  if (stage === 'cancelled') {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
          <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{lang === 'ar' ? 'الأوردر ملغي' : 'Order Cancelled'}</span>
        </div>
        {formattedDate && (
          <span className="text-[11px] text-red-600/80 dark:text-red-300/80 tabular-nums">
            {formattedDate}
          </span>
        )}
      </div>
    );
  }

  const steps = [
    {
      key: 'processing' as const,
      label: lang === 'ar' ? 'قيد التجهيز' : 'Processing',
      sublabel: lang === 'ar' ? 'تم تأكيد الطلب' : 'Confirmed',
      Icon: PackageCheck,
    },
    {
      key: 'shipped' as const,
      label: lang === 'ar' ? 'تم الشحن' : 'Shipped',
      sublabel: lang === 'ar' ? 'في الطريق إليك' : 'In transit',
      Icon: Truck,
    },
    {
      key: 'delivered' as const,
      label: lang === 'ar' ? 'تم التوصيل' : 'Delivered',
      sublabel: lang === 'ar' ? 'وصل بنجاح' : 'Completed',
      Icon: CheckCircle2,
    },
  ];

  const activeIndex = stage === 'delivered' ? 2 : stage === 'shipped' ? 1 : 0;
  const progressPercent = activeIndex === 0 ? 18 : activeIndex === 1 ? 58 : 100;

  return (
    <div
      aria-label={lang === 'ar' ? 'متابعة حالة الأوردر' : 'Order tracking status'}
      className="rounded-lg border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-3.5 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
          {lang === 'ar' ? 'حالة الأوردر' : 'Order Status'}
        </span>
        <div className="flex items-center gap-2">
          {formattedDate && (
            <span className="text-[11px] text-[#525866] dark:text-[#9CA3AF] tabular-nums">
              {formattedDate}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              stage === 'delivered'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-[#1D4ED8]/10 text-[#1D4ED8] dark:bg-[#3B82F6]/15 dark:text-[#60A5FA]'
            }`}
          >
            {steps[activeIndex].label}
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="relative pt-1">
        <div
          aria-hidden="true"
          className="absolute top-[18px] inset-x-6 h-0.5 bg-black/[0.08] dark:bg-white/[0.1] overflow-hidden rounded-full"
        >
          <div
            className={`h-full transition-all duration-300 ${
              stage === 'delivered'
                ? 'bg-emerald-600 dark:bg-emerald-400'
                : 'bg-[#1D4ED8] dark:bg-[#60A5FA]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <ol className="relative grid grid-cols-3 gap-2">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeIndex || (idx === 2 && activeIndex === 2);
            const isCurrent = idx === activeIndex;
            const StepIcon = step.Icon;

            return (
              <li key={step.key} className="flex flex-col items-center text-center">
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                    isCompleted
                      ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-[#0B0D11]'
                      : isCurrent
                      ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white ring-4 ring-[#1D4ED8]/15 dark:border-[#60A5FA] dark:bg-[#3B82F6] dark:ring-[#60A5FA]/20'
                      : 'border-black/[0.12] bg-[#F8F8FA] text-[#525866] dark:border-white/[0.14] dark:bg-[#0B0D11] dark:text-[#9CA3AF]'
                  }`}
                >
                  {isCompleted && idx < activeIndex ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={`mt-1.5 text-[11px] font-semibold leading-tight ${
                    isCurrent || isCompleted
                      ? 'text-[#0F1115] dark:text-[#F4F5F7]'
                      : 'text-[#525866] dark:text-[#9CA3AF]'
                  }`}
                >
                  {step.label}
                </span>
                <span className="mt-0.5 text-[10px] text-[#525866] dark:text-[#9CA3AF] leading-tight">
                  {step.sublabel}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
