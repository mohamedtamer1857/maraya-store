import type { Language } from '../types';

interface BrandLogoProps {
  lang: Language;
  className?: string;
}

export function BrandLogo({ lang, className = '' }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 text-[#0F1115] dark:text-[#F4F5F7]"
      >
        <rect
          x="3"
          y="3"
          width="26"
          height="26"
          rx="6"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M10.5 23V13.5C10.5 10.4624 12.9624 8 16 8C19.0376 8 21.5 10.4624 21.5 13.5V23"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M13.5 23V14.2C13.5 12.8193 14.6193 11.7 16 11.7C17.3807 11.7 18.5 12.8193 18.5 14.2V23"
          stroke="#1D4ED8"
          className="dark:stroke-[#60A5FA]"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="23"
          x2="24"
          y2="23"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-editorial text-xl font-semibold tracking-tight text-[#0F1115] dark:text-[#F4F5F7]">
        {lang === 'ar' ? 'مَرايا' : 'MARAYA'}
      </span>
    </span>
  );
}
