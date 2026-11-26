import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F8FA] dark:bg-[#0B0D11] p-6">
          <div className="max-w-md w-full rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#13161C] p-6 text-center space-y-4">
            <h2 className="font-editorial text-2xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
              MARAYA | مَرايا
            </h2>
            <p className="text-sm text-[#525866] dark:text-[#9CA3AF]">
              حدث خطأ غير متوقع أثناء تحميل التطبيق. يرجى إعادة المحاولة.
            </p>
            <p className="text-xs font-mono text-red-600 dark:text-red-400 break-words">
              {this.state.message.slice(0, 180)}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0F1115] px-5 text-xs font-semibold text-white dark:bg-[#F4F5F7] dark:text-[#0B0D11] cursor-pointer"
            >
              إعادة تحميل الصفحة / Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
