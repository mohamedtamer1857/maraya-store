import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Loader2,
  LogIn,
  LogOut,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Language } from '../types';

type StaffRole = 'admin' | 'manager' | 'operations' | 'viewer';
type OrderStatusValue = 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface StaffProfile {
  id: number;
  email: string;
  displayName: string | null;
  role: StaffRole;
  canViewOrders: boolean;
  canUpdateOrderStatus: boolean;
  canViewSales: boolean;
  canManageStaff: boolean;
  isActive: boolean;
  isBootstrapAdmin: boolean;
}

interface StaffOrderItem {
  id: number;
  sku: string;
  title: string;
  size: string;
  quantity: number;
}

interface StaffOrderRecord {
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
  items: StaffOrderItem[];
}

interface SalesSummary {
  totalSalesEgp: number;
  deliveredSalesEgp: number;
  activeSalesEgp: number;
  codSalesEgp: number;
  cardSalesEgp: number;
  totalOrders: number;
  activeOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  averageOrderValueEgp: number;
}

interface StaffPortalPageProps {
  lang: Language;
  onBackToStore: () => void;
}

const ROLE_PRESETS: Record<
  StaffRole,
  {
    ar: string;
    en: string;
    canViewOrders: boolean;
    canUpdateOrderStatus: boolean;
    canViewSales: boolean;
    canManageStaff: boolean;
  }
> = {
  admin: {
    ar: 'مدير النظام',
    en: 'Admin',
    canViewOrders: true,
    canUpdateOrderStatus: true,
    canViewSales: true,
    canManageStaff: true,
  },
  manager: {
    ar: 'مشرف مبيعات وطلبات',
    en: 'Sales & Ops Manager',
    canViewOrders: true,
    canUpdateOrderStatus: true,
    canViewSales: true,
    canManageStaff: false,
  },
  operations: {
    ar: 'موظف تجهيز وشحن',
    en: 'Operations & Fulfillment',
    canViewOrders: true,
    canUpdateOrderStatus: true,
    canViewSales: false,
    canManageStaff: false,
  },
  viewer: {
    ar: 'مراقب طلبات',
    en: 'Order Viewer',
    canViewOrders: true,
    canUpdateOrderStatus: false,
    canViewSales: false,
    canManageStaff: false,
  },
};

const ORDER_STATUS_LABELS: Record<OrderStatusValue, { ar: string; en: string }> = {
  confirmed: { ar: 'تم التأكيد', en: 'Confirmed' },
  processing: { ar: 'قيد التجهيز', en: 'Processing' },
  shipped: { ar: 'تم الشحن', en: 'Shipped' },
  delivered: { ar: 'تم التوصيل', en: 'Delivered' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
};

export function StaffPortalPage({ lang, onBackToStore }: StaffPortalPageProps) {
  const { user, authReady, authError, signInWithGoogle, logout, getFreshToken } = useAuth();

  const [staffLoading, setStaffLoading] = useState(false);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'team'>('orders');

  // Orders & Sales state
  const [orders, setOrders] = useState<StaffOrderRecord[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [updatingOrderRef, setUpdatingOrderRef] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Team management state
  const [members, setMembers] = useState<StaffProfile[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('operations');
  const [newPermOrders, setNewPermOrders] = useState(true);
  const [newPermStatus, setNewPermStatus] = useState(true);
  const [newPermSales, setNewPermSales] = useState(false);
  const [newPermManage, setNewPermManage] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState<string | null>(null);

  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;
  const currencyLabel = lang === 'ar' ? 'ج.م' : 'EGP';

  const loadStaffProfile = useCallback(async () => {
    if (!user) {
      setStaffProfile(null);
      setVerifiedEmail(null);
      return;
    }

    setStaffLoading(true);
    setPortalError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;

      const res = await fetch('/api/staff/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        isStaff?: boolean;
        staff?: StaffProfile | null;
        email?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setPortalError(data.error || 'Unable to verify staff account.');
        setStaffProfile(null);
      } else {
        setVerifiedEmail(data.email || user.email || null);
        setStaffProfile(data.isStaff && data.staff ? data.staff : null);
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to reach staff server.');
    } finally {
      setStaffLoading(false);
    }
  }, [user, getFreshToken]);

  const loadDashboardData = useCallback(
    async (profile: StaffProfile) => {
      setDataLoading(true);
      setPortalError(null);
      try {
        const token = await getFreshToken();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };

        const requests: Array<Promise<void>> = [];

        if (profile.canViewOrders) {
          requests.push(
            fetch('/api/staff/orders', { headers })
              .then(async (r) => {
                if (!r.ok) {
                  const errData = (await r.json()) as { error?: string };
                  throw new Error(errData.error || 'Failed to load orders.');
                }
                const json = (await r.json()) as { orders?: StaffOrderRecord[] };
                setOrders(json.orders ?? []);
              })
          );
        } else {
          setOrders([]);
        }

        if (profile.canViewSales) {
          requests.push(
            fetch('/api/staff/sales', { headers })
              .then(async (r) => {
                if (!r.ok) {
                  const errData = (await r.json()) as { error?: string };
                  throw new Error(errData.error || 'Failed to load sales summary.');
                }
                const json = (await r.json()) as { summary?: SalesSummary | null };
                setSalesSummary(json.summary ?? null);
              })
          );
        } else {
          setSalesSummary(null);
        }

        await Promise.all(requests);
      } catch (err) {
        setPortalError(err instanceof Error ? err.message : 'Failed to load operations data.');
      } finally {
        setDataLoading(false);
      }
    },
    [getFreshToken]
  );

  const loadTeamMembers = useCallback(
    async (profile: StaffProfile) => {
      if (!profile.canManageStaff) return;
      setTeamLoading(true);
      try {
        const token = await getFreshToken();
        if (!token) return;
        const res = await fetch('/api/staff/members', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as { members?: StaffProfile[]; error?: string };
        if (!res.ok) {
          setPortalError(data.error || 'Unable to load staff permissions.');
        } else {
          setMembers(data.members ?? []);
        }
      } catch (err) {
        setPortalError(err instanceof Error ? err.message : 'Unable to load staff list.');
      } finally {
        setTeamLoading(false);
      }
    },
    [getFreshToken]
  );

  useEffect(() => {
    if (authReady) {
      void loadStaffProfile();
    }
  }, [authReady, loadStaffProfile]);

  useEffect(() => {
    if (!staffProfile) return;
    void loadDashboardData(staffProfile);
    if (staffProfile.canManageStaff) {
      void loadTeamMembers(staffProfile);
    } else if (activeTab === 'team') {
      setActiveTab('orders');
    }
  }, [staffProfile, loadDashboardData, loadTeamMembers, activeTab]);

  const handleRolePresetChange = (role: StaffRole) => {
    setNewRole(role);
    const preset = ROLE_PRESETS[role];
    setNewPermOrders(preset.canViewOrders);
    setNewPermStatus(preset.canUpdateOrderStatus);
    setNewPermSales(preset.canViewSales);
    setNewPermManage(preset.canManageStaff);
  };

  const handleOrderStatusChange = async (orderRef: string, nextStatus: OrderStatusValue) => {
    if (!staffProfile?.canUpdateOrderStatus) return;
    setUpdatingOrderRef(orderRef);
    setPortalError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/staff/orders/${encodeURIComponent(orderRef)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPortalError(data.error || 'Failed to update order status.');
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.orderRef === orderRef ? { ...o, status: nextStatus } : o))
      );
      if (staffProfile.canViewSales) {
        const salesRes = await fetch('/api/staff/sales', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (salesRes.ok) {
          const salesData = (await salesRes.json()) as { summary?: SalesSummary | null };
          setSalesSummary(salesData.summary ?? null);
        }
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to update order status.');
    } finally {
      setUpdatingOrderRef(null);
    }
  };

  const handleAddStaffMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffProfile?.canManageStaff) return;
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    setSavingMember(true);
    setPortalError(null);
    setTeamFeedback(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch('/api/staff/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          displayName: newName.trim() || null,
          role: newRole,
          canViewOrders: newPermOrders,
          canUpdateOrderStatus: newPermStatus,
          canViewSales: newPermSales,
          canManageStaff: newPermManage,
          isActive: true,
        }),
      });
      const data = (await res.json()) as { member?: StaffProfile; error?: string };
      if (!res.ok) {
        setPortalError(data.error || 'Unable to save staff member.');
        return;
      }

      setNewEmail('');
      setNewName('');
      setTeamFeedback(
        lang === 'ar'
          ? `تم حفظ صلاحيات الموظف (${cleanEmail}) بنجاح.`
          : `Saved permissions for ${cleanEmail}.`
      );
      await loadTeamMembers(staffProfile);
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to add staff member.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleToggleMemberPermission = async (
    member: StaffProfile,
    field:
      | 'canViewOrders'
      | 'canUpdateOrderStatus'
      | 'canViewSales'
      | 'canManageStaff'
      | 'isActive',
    nextValue: boolean
  ) => {
    if (!staffProfile?.canManageStaff) return;
    setPortalError(null);
    setTeamFeedback(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/staff/members/${member.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: nextValue }),
      });
      const data = (await res.json()) as { member?: StaffProfile; error?: string };
      if (!res.ok) {
        setPortalError(data.error || 'Permission update rejected.');
        return;
      }
      if (data.member) {
        setMembers((prev) => prev.map((m) => (m.id === member.id ? data.member! : m)));
        if (data.member.email === staffProfile.email) {
          setStaffProfile(data.member);
        }
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to update permissions.');
    }
  };

  const handleMemberRoleChange = async (member: StaffProfile, nextRole: StaffRole) => {
    if (!staffProfile?.canManageStaff) return;
    const preset = ROLE_PRESETS[nextRole];
    setPortalError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/staff/members/${member.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: nextRole,
          canViewOrders: preset.canViewOrders,
          canUpdateOrderStatus: preset.canUpdateOrderStatus,
          canViewSales: preset.canViewSales,
          canManageStaff: preset.canManageStaff,
        }),
      });
      const data = (await res.json()) as { member?: StaffProfile; error?: string };
      if (!res.ok) {
        setPortalError(data.error || 'Role update failed.');
        return;
      }
      if (data.member) {
        setMembers((prev) => prev.map((m) => (m.id === member.id ? data.member! : m)));
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to update role.');
    }
  };

  const handleDeleteMember = async (member: StaffProfile) => {
    if (!staffProfile?.canManageStaff) return;
    setPortalError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/staff/members/${member.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPortalError(data.error || 'Unable to delete staff member.');
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to delete staff member.');
    }
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const normalizedStatus =
        order.status === 'confirmed' ? 'processing' : order.status.toLowerCase();
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter && order.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        order.orderRef.toLowerCase().includes(q) ||
        order.fullName.toLowerCase().includes(q) ||
        order.phone.toLowerCase().includes(q) ||
        order.address.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, searchQuery]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const permissionSummaryList = staffProfile
    ? [
        staffProfile.canViewOrders
          ? lang === 'ar'
            ? 'عرض الأوردرات'
            : 'View Orders'
          : null,
        staffProfile.canUpdateOrderStatus
          ? lang === 'ar'
            ? 'تحديث الحالة'
            : 'Update Status'
          : null,
        staffProfile.canViewSales
          ? lang === 'ar'
            ? 'إجمالي المبيعات'
            : 'View Sales'
          : null,
        staffProfile.canManageStaff
          ? lang === 'ar'
            ? 'إدارة الموظفين'
            : 'Manage Staff'
          : null,
      ].filter((x): x is string => x !== null)
    : [];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.08] dark:border-white/[0.08] pb-5">
        <div>
          <p className="text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
            {lang === 'ar' ? 'دار مَرايا / بوابة العمليات الداخلية' : 'MARAYA / Internal Operations Portal'}
          </p>
          <h1 className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
            {lang === 'ar' ? 'بوابة الموظفين ومتابعة المبيعات' : 'Staff Portal, Orders & Sales'}
          </h1>
        </div>

        <button
          type="button"
          onClick={onBackToStore}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#13161C] px-4 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BackIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{lang === 'ar' ? 'الرجوع للمتجر' : 'Back to Storefront'}</span>
        </button>
      </div>

      {/* State 1: Auth loading or checking staff record */}
      {!authReady || staffLoading ? (
        <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-12 flex flex-col items-center justify-center gap-3 text-sm text-[#525866] dark:text-[#9CA3AF]">
          <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8] dark:text-[#60A5FA]" />
          <span>
            {lang === 'ar'
              ? 'جاري التحقق من حساب الموظف وصلاحياته...'
              : 'Verifying employee Google session & permissions...'}
          </span>
        </div>
      ) : !user ? (
        /* State 2: Dedicated Google Sign-In Gate for Staff */
        <div className="mx-auto max-w-lg rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#13161C] p-8 sm:p-10 text-center space-y-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1D4ED8]/10 text-[#1D4ED8] dark:bg-[#3B82F6]/15 dark:text-[#60A5FA]">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h2 className="font-editorial text-2xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
              {lang === 'ar' ? 'تسجيل دخول الموظفين' : 'Employee Google Sign-In'}
            </h2>
            <p className="text-sm leading-relaxed text-[#525866] dark:text-[#9CA3AF]">
              {lang === 'ar'
                ? 'سجل دخول بحساب جوجل المعتمد من الإدارة عشان تتابع الأوردرات، تحدث حالات التوصيل، وتشوف إجمالي المبيعات حسب صلاحياتك.'
                : 'Sign in with your authorized Google account to track orders, update fulfillment stages, and view total sales according to your assigned permissions.'}
            </p>
          </div>

          {authError && (
            <div className="rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#0F1115] px-6 text-sm font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#F4F5F7] dark:text-[#0B0D11] dark:hover:bg-[#60A5FA] transition-colors cursor-pointer"
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {lang === 'ar' ? 'تسجيل الدخول بحساب جوجل' : 'Continue with Google Account'}
            </span>
          </button>

          <p className="text-xs text-[#525866] dark:text-[#9CA3AF]">
            {lang === 'ar'
              ? 'الوصول مقتصر على الحسابات المفعّلة في سجل الصلاحيات.'
              : 'Access is restricted to verified accounts enabled in the staff permissions registry.'}
          </p>
        </div>
      ) : !staffProfile ? (
        /* State 3: Signed in via Google, but not authorized as active staff */
        <div className="mx-auto max-w-lg rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#13161C] p-8 sm:p-10 text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h2 className="font-editorial text-xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
              {lang === 'ar' ? 'الحساب ده معلهوش صلاحيات موظف' : 'No Active Staff Permissions'}
            </h2>
            <p className="text-sm text-[#525866] dark:text-[#9CA3AF]">
              {lang === 'ar'
                ? 'أنت مسجل دخول بالإيميل:'
                : 'You are currently signed in as:'}{' '}
              <strong className="text-[#0F1115] dark:text-[#F4F5F7]" dir="ltr">
                {verifiedEmail || user.email}
              </strong>
            </p>
            <p className="text-xs leading-relaxed text-[#525866] dark:text-[#9CA3AF]">
              {lang === 'ar'
                ? 'اطلب من مدير النظام يضيف إيميل جوجل ده من تبويب إدارة الموظفين ويفعّل لك الصلاحيات المناسبة.'
                : 'Ask an administrator to authorize this Google email in the Staff Permissions panel.'}
            </p>
          </div>

          {portalError && (
            <div className="rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
              {portalError}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-4 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
            <button
              type="button"
              onClick={() => void loadStaffProfile()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 text-xs font-semibold text-white hover:bg-[#1E40AF] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'إعادة التحقق' : 'Re-check Access'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* State 4: Authenticated Active Staff Dashboard */
        <div className="space-y-8">
          {/* Active Staff Account Identity & Permissions Strip */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-5 sm:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#525866] dark:text-[#9CA3AF]">
                <span className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                  {staffProfile.displayName || user.displayName || staffProfile.email}
                </span>
                <span aria-hidden="true">·</span>
                <span dir="ltr">{staffProfile.email}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                  {ROLE_PRESETS[staffProfile.role]?.[lang] || staffProfile.role}
                </span>
              </div>
              <p className="text-xs text-[#525866] dark:text-[#9CA3AF]">
                {lang === 'ar' ? 'الصلاحيات المفعلة: ' : 'Granted permissions: '}
                <span className="text-[#0F1115] dark:text-[#D1D5DB]">
                  {permissionSummaryList.length > 0
                    ? permissionSummaryList.join(' · ')
                    : lang === 'ar'
                    ? 'قراءة فقط'
                    : 'Read-only'}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  void loadDashboardData(staffProfile);
                  if (staffProfile.canManageStaff) void loadTeamMembers(staffProfile);
                }}
                disabled={dataLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${dataLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{lang === 'ar' ? 'تحديث البيانات' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-3 text-xs font-semibold text-[#525866] hover:text-red-600 dark:text-[#9CA3AF] dark:hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          </div>

          {portalError && (
            <div className="rounded-xl border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              {portalError}
            </div>
          )}

          {/* Total Sales KPI Row (Permission-Gated by canViewSales) */}
          {staffProfile.canViewSales ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-[#525866] dark:text-[#9CA3AF]">
                  <span>{lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales Revenue'}</span>
                  <BarChart3 className="h-4 w-4 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                </div>
                <p className="text-2xl font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                  {(salesSummary?.totalSalesEgp ?? 0).toLocaleString('en-US')} {currencyLabel}
                </p>
                <p className="text-xs text-[#525866] dark:text-[#9CA3AF] tabular-nums">
                  {lang === 'ar'
                    ? `تم توصيل ${(salesSummary?.deliveredSalesEgp ?? 0).toLocaleString('en-US')} ج.م`
                    : `Delivered: ${(salesSummary?.deliveredSalesEgp ?? 0).toLocaleString('en-US')} EGP`}
                </p>
              </div>

              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-[#525866] dark:text-[#9CA3AF]">
                  <span>{lang === 'ar' ? 'إجمالي الأوردرات' : 'Total Orders'}</span>
                  <Package className="h-4 w-4 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                </div>
                <p className="text-2xl font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                  {salesSummary?.totalOrders ?? 0}
                </p>
                <p className="text-xs text-[#525866] dark:text-[#9CA3AF] tabular-nums">
                  {lang === 'ar'
                    ? `نشط ${salesSummary?.activeOrders ?? 0} · مكتمل ${salesSummary?.deliveredOrders ?? 0}`
                    : `${salesSummary?.activeOrders ?? 0} active · ${salesSummary?.deliveredOrders ?? 0} delivered`}
                </p>
              </div>

              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-5 space-y-2">
                <span className="block text-xs text-[#525866] dark:text-[#9CA3AF]">
                  {lang === 'ar' ? 'متوسط قيمة الأوردر' : 'Average Order Value'}
                </span>
                <p className="text-2xl font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                  {(salesSummary?.averageOrderValueEgp ?? 0).toLocaleString('en-US')} {currencyLabel}
                </p>
                <p className="text-xs text-[#525866] dark:text-[#9CA3AF] tabular-nums">
                  {lang === 'ar'
                    ? `أوردرات ملغية: ${salesSummary?.cancelledOrders ?? 0}`
                    : `Cancelled: ${salesSummary?.cancelledOrders ?? 0}`}
                </p>
              </div>

              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-5 space-y-2">
                <span className="block text-xs text-[#525866] dark:text-[#9CA3AF]">
                  {lang === 'ar' ? 'توزيع التحصيل' : 'Payment Breakdown'}
                </span>
                <p className="text-sm font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                  {lang === 'ar' ? 'عند الاستلام: ' : 'COD: '}
                  {(salesSummary?.codSalesEgp ?? 0).toLocaleString('en-US')} {currencyLabel}
                </p>
                <p className="text-xs tabular-nums text-[#525866] dark:text-[#9CA3AF]">
                  {lang === 'ar' ? 'كارت / ميزة: ' : 'Card / Meeza: '}
                  {(salesSummary?.cardSalesEgp ?? 0).toLocaleString('en-US')} {currencyLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] px-5 py-3.5 text-xs text-[#525866] dark:text-[#9CA3AF]">
              {lang === 'ar'
                ? 'ملخص إجمالي المبيعات متاح فقط للحسابات اللي عندها صلاحية "عرض إجمالي المبيعات".'
                : 'Total sales figures are restricted to accounts with View Sales permission.'}
            </div>
          )}

          {/* Section Switcher: Orders Tracking vs Staff & Permissions */}
          {staffProfile.canManageStaff && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#ECEEF2] dark:bg-[#13161C] p-1.5 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-white text-[#0F1115] shadow-xs dark:bg-[#232833] dark:text-[#F4F5F7]'
                    : 'text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7]'
                }`}
              >
                <Package className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'متابعة الأوردرات' : 'Orders Tracking'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-white text-[#0F1115] shadow-xs dark:bg-[#232833] dark:text-[#F4F5F7]'
                    : 'text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7]'
                }`}
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? `إدارة الموظفين والصلاحيات (${members.length})`
                    : `Staff & Permissions (${members.length})`}
                </span>
              </button>
            </div>
          )}

          {/* Tab A: Orders Tracking & Fulfillment */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {!staffProfile.canViewOrders ? (
                <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-10 text-center text-sm text-[#525866] dark:text-[#9CA3AF]">
                  {lang === 'ar'
                    ? 'حسابك الحالي معلهوش صلاحية عرض الأوردرات.'
                    : 'Your account does not currently have permission to view orders.'}
                </div>
              ) : (
                <>
                  {/* Filter & Search Bar */}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#ECEEF2] dark:bg-[#13161C] p-1 w-fit">
                      {(
                        [
                          { id: 'all', ar: 'الكل', en: 'All' },
                          { id: 'processing', ar: 'قيد التجهيز', en: 'Processing' },
                          { id: 'shipped', ar: 'تم الشحن', en: 'Shipped' },
                          { id: 'delivered', ar: 'تم التوصيل', en: 'Delivered' },
                          { id: 'cancelled', ar: 'ملغي', en: 'Cancelled' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStatusFilter(tab.id)}
                          className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            statusFilter === tab.id
                              ? 'bg-white text-[#0F1115] shadow-xs dark:bg-[#232833] dark:text-[#F4F5F7]'
                              : 'text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7]'
                          }`}
                        >
                          {tab[lang]}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full md:w-80">
                      <Search
                        className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-[#525866] dark:text-[#9CA3AF]"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                          lang === 'ar'
                            ? 'ابحث برقم الأوردر أو الاسم أو الموبايل...'
                            : 'Search order ref, customer, phone...'
                        }
                        className="h-10 w-full rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#13161C] ps-9 pe-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/70 focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C]">
                    {dataLoading && orders.length === 0 ? (
                      <div className="p-10 text-center text-xs text-[#525866] dark:text-[#9CA3AF]">
                        {lang === 'ar' ? 'جاري تحميل الأوردرات...' : 'Loading orders...'}
                      </div>
                    ) : filteredOrders.length === 0 ? (
                      <div className="p-10 text-center text-sm text-[#525866] dark:text-[#9CA3AF]">
                        {lang === 'ar'
                          ? 'مفيش أوردرات مطابقة للفلتر ده دلوقتي.'
                          : 'No orders match this filter.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-start text-xs">
                          <thead>
                            <tr className="border-b border-black/[0.08] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] text-[#525866] dark:text-[#9CA3AF]">
                              <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                                {lang === 'ar' ? 'رقم الأوردر' : 'Order Ref'}
                              </th>
                              <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                                {lang === 'ar' ? 'العميل والعنوان' : 'Customer & Address'}
                              </th>
                              <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                                {lang === 'ar' ? 'القطع' : 'Items'}
                              </th>
                              <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                                {lang === 'ar' ? 'الإجمالي والدفع' : 'Total & Payment'}
                              </th>
                              <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                                {lang === 'ar' ? 'حالة الأوردر' : 'Status'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
                            {filteredOrders.map((order) => {
                              const currentStatus: OrderStatusValue = (
                                ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(
                                  order.status
                                )
                                  ? order.status
                                  : 'confirmed'
                              ) as OrderStatusValue;

                              return (
                                <tr
                                  key={order.id}
                                  className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors align-top"
                                >
                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    <span className="font-mono font-semibold text-[#1D4ED8] dark:text-[#60A5FA] tabular-nums">
                                      {order.orderRef}
                                    </span>
                                    <p className="mt-1 text-[11px] text-[#525866] dark:text-[#9CA3AF] tabular-nums">
                                      {formatDate(order.createdAt)}
                                    </p>
                                  </td>

                                  <td className="px-4 py-3.5 min-w-[220px] max-w-xs space-y-1">
                                    <p className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                                      {order.fullName}{' '}
                                      <span className="font-normal text-[#525866] dark:text-[#9CA3AF]" dir="ltr">
                                        · {order.phone}
                                      </span>
                                    </p>
                                    <p className="text-[#525866] dark:text-[#D1D5DB] leading-relaxed">
                                      {order.address}
                                    </p>
                                    {order.notes && (
                                      <p className="italic text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                                        {order.notes}
                                      </p>
                                    )}
                                  </td>

                                  <td className="px-4 py-3.5 min-w-[180px] space-y-1 text-[#525866] dark:text-[#D1D5DB]">
                                    {order.items.map((item) => (
                                      <div key={item.id} className="flex items-center justify-between gap-2">
                                        <span className="truncate max-w-[180px]">
                                          {item.title} ({item.size})
                                        </span>
                                        <span className="tabular-nums font-semibold shrink-0">
                                          ×{item.quantity}
                                        </span>
                                      </div>
                                    ))}
                                  </td>

                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    <p className="font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                                      {order.totalAmount.toLocaleString('en-US')}{' '}
                                      {lang === 'ar' && order.currency === 'EGP'
                                        ? 'ج.م'
                                        : order.currency}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                                      {order.paymentMethod === 'card'
                                        ? lang === 'ar'
                                          ? 'كارت / ميزة'
                                          : 'Card / Meeza'
                                        : lang === 'ar'
                                        ? 'دفع عند الاستلام'
                                        : 'Cash on Delivery'}
                                    </p>
                                  </td>

                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    {staffProfile.canUpdateOrderStatus ? (
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={currentStatus}
                                          disabled={updatingOrderRef === order.orderRef}
                                          onChange={(e) =>
                                            void handleOrderStatusChange(
                                              order.orderRef,
                                              e.target.value as OrderStatusValue
                                            )
                                          }
                                          aria-label={lang === 'ar' ? 'تغيير حالة الأوردر' : 'Order status'}
                                          className="h-9 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-[#F8F8FA] dark:bg-[#0B0D11] px-2.5 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none cursor-pointer disabled:opacity-60"
                                        >
                                          {(
                                            Object.keys(ORDER_STATUS_LABELS) as OrderStatusValue[]
                                          ).map((statusKey) => (
                                            <option key={statusKey} value={statusKey}>
                                              {ORDER_STATUS_LABELS[statusKey][lang]}
                                            </option>
                                          ))}
                                        </select>
                                        {updatingOrderRef === order.orderRef && (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" />
                                        )}
                                      </div>
                                    ) : (
                                      <span className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                                        {ORDER_STATUS_LABELS[currentStatus][lang]}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab B: Staff & Permissions Management */}
          {activeTab === 'team' && staffProfile.canManageStaff && (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Add Employee Form */}
              <form
                onSubmit={(e) => void handleAddStaffMember(e)}
                className="lg:col-span-4 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-6 space-y-4 h-fit"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                  <UserPlus className="h-4 w-4 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'إضافة موظف وتحديد صلاحياته' : 'Authorize Staff Member'}</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'إيميل حساب جوجل' : 'Google Email Address'}
                  </label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="employee@gmail.com"
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'اسم الموظف (اختياري)' : 'Employee Name (optional)'}
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: سارة محمود' : 'e.g. Sara Mahmoud'}
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'الدور الوظيفي' : 'Role Preset'}
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => handleRolePresetChange(e.target.value as StaffRole)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-[#F8F8FA] dark:bg-[#0B0D11] px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {(Object.keys(ROLE_PRESETS) as StaffRole[]).map((roleKey) => (
                      <option key={roleKey} value={roleKey}>
                        {ROLE_PRESETS[roleKey][lang]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 pt-1 border-t border-black/[0.06] dark:border-white/[0.07]">
                  <p className="text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                    {lang === 'ar' ? 'صلاحيات الحساب:' : 'Granular Permissions:'}
                  </p>
                  <label className="flex items-center gap-2 text-xs text-[#525866] dark:text-[#D1D5DB] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermOrders}
                      onChange={(e) => setNewPermOrders(e.target.checked)}
                      className="rounded border-black/20"
                    />
                    <span>{lang === 'ar' ? 'عرض ومتابعة الأوردرات' : 'View & track orders'}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#525866] dark:text-[#D1D5DB] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermStatus}
                      onChange={(e) => setNewPermStatus(e.target.checked)}
                      className="rounded border-black/20"
                    />
                    <span>
                      {lang === 'ar' ? 'تحديث حالة الشحن والتوصيل' : 'Update order fulfillment status'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#525866] dark:text-[#D1D5DB] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermSales}
                      onChange={(e) => setNewPermSales(e.target.checked)}
                      className="rounded border-black/20"
                    />
                    <span>{lang === 'ar' ? 'عرض إجمالي المبيعات' : 'View total sales metrics'}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#525866] dark:text-[#D1D5DB] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermManage}
                      onChange={(e) => setNewPermManage(e.target.checked)}
                      className="rounded border-black/20"
                    />
                    <span>
                      {lang === 'ar' ? 'إدارة الموظفين والصلاحيات' : 'Manage staff & permissions'}
                    </span>
                  </label>
                </div>

                {teamFeedback && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{teamFeedback}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingMember}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {savingMember && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{lang === 'ar' ? 'حفظ وإضافة الموظف' : 'Save Staff Permissions'}</span>
                </button>
              </form>

              {/* Staff Members Permissions Table */}
              <div className="lg:col-span-8 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C]">
                {teamLoading && members.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'جاري تحميل قائمة الموظفين...' : 'Loading staff registry...'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-start text-xs">
                      <thead>
                        <tr className="border-b border-black/[0.08] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] text-[#525866] dark:text-[#9CA3AF]">
                          <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                            {lang === 'ar' ? 'الموظف' : 'Staff Member'}
                          </th>
                          <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                            {lang === 'ar' ? 'الدور' : 'Role'}
                          </th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                            {lang === 'ar' ? 'الأوردرات' : 'Orders'}
                          </th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                            {lang === 'ar' ? 'الحالة' : 'Status'}
                          </th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                            {lang === 'ar' ? 'المبيعات' : 'Sales'}
                          </th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                            {lang === 'ar' ? 'الإدارة' : 'Admin'}
                          </th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                            {lang === 'ar' ? 'تفعيل' : 'Active'}
                          </th>
                          <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                            {lang === 'ar' ? 'حذف' : 'Remove'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
                        {members.map((member) => {
                          const lockedAdmin = member.isBootstrapAdmin;
                          return (
                            <tr
                              key={member.id}
                              className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                            >
                              <td className="px-4 py-3">
                                <p className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                                  {member.displayName || member.email.split('@')[0]}
                                  {lockedAdmin && (
                                    <span className="ms-1.5 text-[11px] font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                                      ({lang === 'ar' ? 'أساسي' : 'Primary'})
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]" dir="ltr">
                                  {member.email}
                                </p>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <select
                                  value={member.role}
                                  disabled={lockedAdmin}
                                  onChange={(e) =>
                                    void handleMemberRoleChange(member, e.target.value as StaffRole)
                                  }
                                  aria-label={lang === 'ar' ? 'تغيير دور الموظف' : 'Change role'}
                                  className="h-8 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-[#F8F8FA] dark:bg-[#0B0D11] px-2 text-xs font-medium text-[#0F1115] dark:text-[#F4F5F7] disabled:opacity-60 cursor-pointer"
                                >
                                  {(Object.keys(ROLE_PRESETS) as StaffRole[]).map((r) => (
                                    <option key={r} value={r}>
                                      {ROLE_PRESETS[r][lang]}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {(
                                [
                                  'canViewOrders',
                                  'canUpdateOrderStatus',
                                  'canViewSales',
                                  'canManageStaff',
                                  'isActive',
                                ] as const
                              ).map((permField) => (
                                <td key={permField} className="px-3 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={member[permField]}
                                    disabled={lockedAdmin}
                                    onChange={(e) =>
                                      void handleToggleMemberPermission(
                                        member,
                                        permField,
                                        e.target.checked
                                      )
                                    }
                                    className="h-4 w-4 rounded border-black/25 accent-[#1D4ED8] cursor-pointer disabled:opacity-50"
                                  />
                                </td>
                              ))}

                              <td className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  disabled={lockedAdmin || member.email === staffProfile.email}
                                  onClick={() => void handleDeleteMember(member)}
                                  aria-label={lang === 'ar' ? 'حذف موظف' : 'Delete staff'}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#525866] hover:text-red-600 dark:text-[#9CA3AF] dark:hover:text-red-400 disabled:opacity-30 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
