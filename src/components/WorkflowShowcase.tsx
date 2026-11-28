import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Language } from '../types';

interface WorkflowShowcaseProps {
  lang: Language;
  cartCount: number;
  onOpenCart: () => void;
  onOpenOrders: () => void;
}

export function WorkflowShowcase({
  lang,
  cartCount,
  onOpenCart,
  onOpenOrders,
}: WorkflowShowcaseProps) {
  const { savedProfile } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const isRtl = lang === 'ar';
  const ForwardArrow = isRtl ? ArrowLeft : ArrowRight;
  const PrevChevron = isRtl ? ChevronRight : ChevronLeft;
  const NextChevron = isRtl ? ChevronLeft : ChevronRight;

  const steps = [
    {
      index: '01',
      title: isRtl ? 'اختار القطعة والمقاس' : 'Select Garment & Size',
      shortLabel: isRtl ? 'اختيار القطعة' : 'Select Piece',
      heading: isRtl
        ? 'ابدأ باختيار قطعتك المناسبة من الكوليكشن'
        : 'Start by choosing your silhouette and exact size',
      body: isRtl
        ? 'استعرض تفاصيل القماش والقصّة من أي كارت منتج، اضغط «اختار المقاس» وحدد مقاسك (XS–XL)، وبعدها أضف القطعة لشنطة التسوق فوراً.'
        : 'Inspect fabric composition and cut on any piece, pick your size (XS–XL) directly on the card or detail modal, and add it to your bag in one click.',
      nextHint: isRtl
        ? 'الخطوة الجاية: هتلاقي القطع جاهزة في الشنطة لإدخال بيانات التوصيل.'
        : 'Next step: Your pieces await inside the shopping bag for delivery details.',
      ctaLabel: isRtl ? 'شوف الكوليكشن دلوقتي' : 'Browse Collection',
      onCta: () => {
        document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
      },
      Icon: ShoppingBag,
      previewLines: isRtl
        ? ['١. تصفح الأقسام أو ابحث باسم القطعة', '٢. حدد المقاس المناسب (XS – XL)', '٣. أضف للشنطة وانتقل للخطوة الثانية']
        : ['1. Filter categories or search silhouettes', '2. Pick your tailored size (XS – XL)', '3. Add to bag and proceed to checkout'],
    },
    {
      index: '02',
      title: isRtl ? 'حدد لوكيشن التوصيل على الخريطة' : 'Pin Your Delivery Location',
      shortLabel: isRtl ? 'لوكيشن التوصيل' : 'Pin Location',
      heading: isRtl
        ? 'خريطة مصر التفاعلية جوه صفحة بيانات الأوردر'
        : 'Interactive Egypt Map right inside Checkout',
      body: isRtl
        ? 'لما تفتح الشنطة وتضغط «كمل الأوردر»، النظام بيحدد موقعك الحالي تلقائياً أو يتيح لك تفتح خريطة مصر جوه الشنطة وتضغط على عنوانك بالتحديد.'
        : 'Inside Checkout, your current GPS location is detected automatically—or open the interactive Egypt map right in the drawer to search or drop a delivery pin.',
      nextHint: isRtl
        ? 'الخطوة الجاية: بيانات وعنوان التوصيل بيتحفظوا تلقائياً على متصفحك لأي طلب جاي.'
        : 'Next step: Your delivery address and phone are saved automatically on this browser.',
      ctaLabel: isRtl
        ? `افتح الشنطة (${cartCount})`
        : `Open Shopping Bag (${cartCount})`,
      onCta: onOpenCart,
      Icon: MapPin,
      previewLines: isRtl
        ? ['١. تحديد تلقائي لموقعك الحالي (GPS)', '٢. اختيار أو تعديل الدبوس من خريطة مصر جوه الشنطة', '٣. حساب مصاريف الشحن أو الشحن المجاني فوق 15,000 ج.م']
        : ['1. Automatic GPS detection inside checkout', '2. Search or click anywhere in Egypt on the embedded map', '3. Instant shipping calculation (Free over 15,000 EGP)'],
    },
    {
      index: '03',
      title: isRtl ? 'احفظ عنوانك لطلباتك الجاية' : 'Save Address for Future Orders',
      shortLabel: isRtl ? 'حفظ العنوان' : 'Save Address',
      heading: isRtl
        ? 'بياناتك وعنوانك بيفضلوا محفوظين تلقائياً من غير تسجيل حساب'
        : 'Your delivery details stay saved locally with zero sign-up needed',
      body: isRtl
        ? 'أول ما تأكد عنوانك أو تضغط «حفظ بيانات التوصيل»، الاسم ورقم الموبايل ولوكيشن التوصيل بيتحفظوا على جهازك عشان يملوا تلقائياً في طلباتك الجاية.'
        : 'As soon as you save or confirm a delivery address, your name, phone, and pinned location stay saved in your browser to auto-fill future orders.',
      nextHint: isRtl
        ? 'الخطوة الجاية: بعد تأكيد الأوردر تقدر تتابع حالته لحظة بلحظة.'
        : 'Next step: Follow your parcel progress live after confirmation.',
      ctaLabel: savedProfile?.savedAddress
        ? isRtl
          ? 'عنوانك محفوظ · افتح الشنطة'
          : 'Address Saved · Open Bag'
        : isRtl
        ? 'افتح الشنطة لحفظ العنوان'
        : 'Open Bag to Save Address',
      onCta: onOpenCart,
      Icon: BookmarkCheck,
      previewLines: isRtl
        ? [
            'طلب سريع مباشر بدون خطوات تسجيل دخول إضافية',
            savedProfile?.savedAddress
              ? `العنوان المحفوظ: ${savedProfile.savedAddress}`
              : 'يتم حفظ آخر لوكيشن تلقائياً فور تأكيد الطلب',
            'إمكانية التعديل في أي وقت من الشنطة',
          ]
        : [
            'Fast guest checkout with zero account friction',
            savedProfile?.savedAddress
              ? `Saved location: ${savedProfile.savedAddress}`
              : 'Automatically stores your latest confirmed address',
            'Editable anytime from Checkout',
          ],
    },
    {
      index: '04',
      title: isRtl ? 'تابع أوردرك خطوة بخطوة' : 'Track Delivery Live',
      shortLabel: isRtl ? 'متابعة الأوردر' : 'Track Order',
      heading: isRtl
        ? 'مراقبة مراحل التجهيز والشحن والتوصيل من أوردراتي'
        : 'Visual order progress from atelier prep to doorstep',
      body: isRtl
        ? 'أول ما تأكد الأوردر بيظهر لك في «أوردراتي» مع شريط متابعة مرئي بيتحدث أول بأول، وكمان تقدر تبحث عن أي طلب برقم الأوردر والموبايل.'
        : 'Every confirmed order appears immediately in My Orders with a live progress tracker, and you can also look up any order anytime by Order Ref and phone.',
      nextHint: isRtl
        ? 'تقدر ترجع تبدأ أوردر جديد في أي وقت أو تراجع طلباتك السابقة.'
        : 'You are all set—review active parcels or explore new arrivals anytime.',
      ctaLabel: isRtl ? 'افتح سجل أوردراتي' : 'View My Order History',
      onCta: onOpenOrders,
      Icon: Truck,
      previewLines: isRtl
        ? ['٠١ · قيد التجهيز والمراجعة في الدار', '٠٢ · تم الشحن مع المندوب داخل مصر', '٠٣ · تم التوصيل بنجاح لباب بيتك']
        : ['01 · Processing & atelier preparation', '02 · Shipped with courier across Egypt', '03 · Delivered to your doorstep'],
    },
  ];

  const current = steps[activeStep];
  const StepIcon = current.Icon;

  const goToStep = (nextIndex: number) => {
    const bounded = (nextIndex + steps.length) % steps.length;
    setDirection(bounded >= activeStep ? 1 : -1);
    setActiveStep(bounded);
  };

  const progressPercent = ((activeStep + 1) / steps.length) * 100;

  return (
    <motion.section
      id="workflow"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-black/[0.06] dark:border-white/[0.07]"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isRtl ? 'دليل الطلب خطوة بخطوة' : 'Interactive Guided Workflow'}
            </span>
          </div>
          <h2 className="mt-2 font-editorial text-2xl sm:text-3xl font-semibold text-[#0F1115] dark:text-[#F4F5F7] [text-wrap:balance]">
            {isRtl
              ? 'إزاي تطلب من مَرايا وتكمل كل خطوة بسهولة'
              : 'How your MARAYA order flows from selection to delivery'}
          </h2>
        </div>

        {/* Slide Arrows */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono tabular-nums text-[#525866] dark:text-[#9CA3AF] me-2">
            {current.index} / 0{steps.length}
          </span>
          <button
            type="button"
            onClick={() => goToStep(activeStep - 1)}
            aria-label={isRtl ? 'الخطوة السابقة' : 'Previous step'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#13161C] text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] transition-colors cursor-pointer"
          >
            <PrevChevron className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goToStep(activeStep + 1)}
            aria-label={isRtl ? 'الخطوة التالية' : 'Next step'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#0F1115] text-white hover:bg-[#1D4ED8] dark:bg-[#F4F5F7] dark:text-[#0B0D11] dark:hover:bg-[#60A5FA] transition-colors cursor-pointer"
          >
            <NextChevron className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Connected Interactive Stepper Rail */}
      <div className="mt-8 relative">
        <div
          aria-hidden="true"
          className="hidden sm:block h-1 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden mb-5"
        >
          <motion.div
            className="h-full bg-[#1D4ED8] dark:bg-[#60A5FA]"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {steps.map((step, idx) => {
            const active = idx === activeStep;
            const completed = idx < activeStep;
            return (
              <button
                key={step.index}
                type="button"
                onClick={() => goToStep(idx)}
                className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-start transition-colors cursor-pointer ${
                  active
                    ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.06] dark:border-[#60A5FA] dark:bg-[#3B82F6]/12'
                    : 'border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] hover:border-black/20 dark:hover:border-white/20'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold tabular-nums ${
                    active
                      ? 'bg-[#1D4ED8] text-white dark:bg-[#3B82F6]'
                      : completed
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-[#0B0D11]'
                      : 'bg-[#ECEEF2] text-[#525866] dark:bg-[#1B1F27] dark:text-[#9CA3AF]'
                  }`}
                >
                  {step.index}
                </span>
                <span
                  className={`text-xs font-semibold truncate ${
                    active
                      ? 'text-[#0F1115] dark:text-[#F4F5F7]'
                      : 'text-[#525866] dark:text-[#9CA3AF]'
                  }`}
                >
                  {step.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animated Workflow Slide Panel */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.index}
            initial={{ opacity: 0, x: (isRtl ? -1 : 1) * direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: (isRtl ? 1 : -1) * direction * 28 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:items-center"
          >
            {/* Left/Start Content: Explanation + Next-Step Guide + Live Action */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                <span className="font-mono tabular-nums">{current.index}.</span>
                <span>{current.title}</span>
              </div>

              <h3 className="font-editorial text-xl sm:text-2xl font-semibold text-[#0F1115] dark:text-[#F4F5F7] [text-wrap:balance]">
                {current.heading}
              </h3>

              <p className="text-sm leading-relaxed text-[#525866] dark:text-[#9CA3AF] max-w-2xl">
                {current.body}
              </p>

              <p className="text-xs font-medium text-[#0F1115] dark:text-[#D1D5DB] pt-1">
                {current.nextHint}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={current.onCta}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 text-xs font-semibold text-white hover:bg-[#1E40AF] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>{current.ctaLabel}</span>
                  <ForwardArrow className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>

                {activeStep < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goToStep(activeStep + 1)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-4 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>
                      {isRtl ? 'اشرح الخطوة اللي بعدها' : 'Next Workflow Step'}
                    </span>
                    <NextChevron className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goToStep(0)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-4 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>{isRtl ? 'ابدأ من الخطوة الأولى' : 'Restart Tour'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right/End Visual Blueprint Card */}
            <div className="lg:col-span-5 rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.07] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1D4ED8]/10 text-[#1D4ED8] dark:bg-[#3B82F6]/15 dark:text-[#60A5FA]">
                    <StepIcon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                    {current.title}
                  </span>
                </div>
                <span className="font-mono text-xs text-[#525866] dark:text-[#9CA3AF] tabular-nums">
                  {current.index}
                </span>
              </div>

              <ul className="space-y-2.5">
                {current.previewLines.map((line, i) => (
                  <motion.li
                    key={line}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * (i + 1), duration: 0.2 }}
                    className="flex items-start gap-2.5 text-xs text-[#525866] dark:text-[#D1D5DB]"
                  >
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed">{line}</span>
                  </motion.li>
                ))}
              </ul>

              {activeStep === 3 && (
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                  <span className="inline-flex items-center gap-1 text-[#1D4ED8] dark:text-[#60A5FA] font-semibold">
                    <PackageCheck className="h-3.5 w-3.5" />
                    {isRtl ? 'قيد التجهيز' : 'Processing'}
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Truck className="h-3.5 w-3.5" />
                    {isRtl ? 'تم الشحن' : 'Shipped'}
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isRtl ? 'تم التوصيل' : 'Delivered'}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
