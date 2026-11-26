import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FolderPlus,
  ImagePlus,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MessageSquarePlus,
  Minus,
  Navigation,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Language, Product, StoreCategory } from '../types';

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
  canManageProducts: boolean;
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

interface StaffOrderNote {
  id: number;
  orderId: number;
  staffEmail: string;
  staffName: string | null;
  note: string;
  createdAt: string;
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
  staffNotesList?: StaffOrderNote[];
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
  onCatalogUpdated?: () => void;
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
    canManageProducts: boolean;
  }
> = {
  admin: {
    ar: 'مدير النظام',
    en: 'Admin',
    canViewOrders: true,
    canUpdateOrderStatus: true,
    canViewSales: true,
    canManageStaff: true,
    canManageProducts: true,
  },
  manager: {
    ar: 'مشرف مبيعات ومنتجات',
    en: 'Sales & Catalog Manager',
    canViewOrders: true,
    canUpdateOrderStatus: true,
    canViewSales: true,
    canManageStaff: false,
    canManageProducts: true,
  },
  operations: {
    ar: 'موظف تجهيز وشحن',
    en: 'Operations & Fulfillment',
    canViewOrders: true,
    canUpdateOrderStatus: true,
    canViewSales: false,
    canManageStaff: false,
    canManageProducts: false,
  },
  viewer: {
    ar: 'مراقب طلبات',
    en: 'Order Viewer',
    canViewOrders: true,
    canUpdateOrderStatus: false,
    canViewSales: false,
    canManageStaff: false,
    canManageProducts: false,
  },
};

const FALLBACK_CATEGORIES: StoreCategory[] = [
  { id: 1, slug: 'outerwear', nameAr: 'بالطوهات وجواكت', nameEn: 'Outerwear', isActive: true, sortOrder: 0 },
  { id: 2, slug: 'tailoring', nameAr: 'بليزرات وتفصيل', nameEn: 'Tailoring', isActive: true, sortOrder: 1 },
  { id: 3, slug: 'knitwear', nameAr: 'تريكو وبلوفرات', nameEn: 'Knitwear', isActive: true, sortOrder: 2 },
  { id: 4, slug: 'shirts', nameAr: 'قمصان', nameEn: 'Shirts', isActive: true, sortOrder: 3 },
];

const ORDER_STATUS_LABELS: Record<OrderStatusValue, { ar: string; en: string }> = {
  confirmed: { ar: 'تم التأكيد', en: 'Confirmed' },
  processing: { ar: 'قيد التجهيز', en: 'Processing' },
  shipped: { ar: 'تم الشحن', en: 'Shipped' },
  delivered: { ar: 'تم التوصيل', en: 'Delivered' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
};

function extractCoordinates(address: string): string | null {
  const match = address.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  return `${lat},${lng}`;
}

function buildGoogleMapsSearchUrl(address: string): string {
  const coords = extractCoordinates(address);
  const query = coords ?? address.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildGoogleMapsDirectionsUrl(address: string): string {
  const coords = extractCoordinates(address);
  const destination = coords ?? address.trim();
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

class ProxyRedirectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyRedirectError';
  }
}

async function parseApiJson<T>(res: Response, lang: Language): Promise<T> {
  if (
    res.redirected &&
    (res.url.includes('__cookie_check') || res.url.includes('applet-auth-bridge'))
  ) {
    throw new ProxyRedirectError(
      lang === 'ar'
        ? 'المتصفح منع كوكيز المعاينة داخل الإطار الحالي. افتح المتجر في نافذة جديدة أو حدث الصفحة ثم أعد المحاولة.'
        : 'Your browser blocked preview session cookies inside this embedded frame. Open the app in a new tab or refresh the page.'
    );
  }

  const rawText = await res.text();
  if (!rawText) {
    return {} as T;
  }
  try {
    return JSON.parse(rawText) as T;
  } catch {
    if (rawText.includes('Cookie check') || rawText.includes('__aistudio')) {
      throw new ProxyRedirectError(
        lang === 'ar'
          ? 'المتصفح منع كوكيز المعاينة داخل الإطار الحالي. افتح المتجر في نافذة جديدة أو حدث الصفحة ثم أعد المحاولة.'
          : 'Your browser blocked preview session cookies inside this embedded frame. Open the app in a new tab or refresh the page.'
      );
    }
    throw new Error(
      lang === 'ar'
        ? `تعذر الاتصال بخادم الموظفين حالياً (HTTP ${res.status}). اضغط "تحديث الصفحة" أو افتح التطبيق في نافذة جديدة.`
        : `Unable to reach the staff server right now (HTTP ${res.status}). Refresh the page or open in a new tab.`
    );
  }
}

export function StaffPortalPage({ lang, onBackToStore, onCatalogUpdated }: StaffPortalPageProps) {
  const { user, authReady, authError, signInWithGoogle, logout, getFreshToken } = useAuth();

  const [staffLoading, setStaffLoading] = useState(false);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [needsNewTab, setNeedsNewTab] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'team'>('orders');

  // Orders & Sales state
  const [orders, setOrders] = useState<StaffOrderRecord[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [updatingOrderRef, setUpdatingOrderRef] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<StaffOrderRecord | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [newStaffNote, setNewStaffNote] = useState('');
  const [savingStaffNote, setSavingStaffNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
  const [staffNoteError, setStaffNoteError] = useState<string | null>(null);

  // Products & Inventory state
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<StoreCategory[]>(FALLBACK_CATEGORIES);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [newCatNameAr, setNewCatNameAr] = useState('');
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [busyCategorySlug, setBusyCategorySlug] = useState<string | null>(null);
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState<string>('outerwear');
  const [prodTitleAr, setProdTitleAr] = useState('');
  const [prodTitleEn, setProdTitleEn] = useState('');
  const [prodSubtitleAr, setProdSubtitleAr] = useState('');
  const [prodSubtitleEn, setProdSubtitleEn] = useState('');
  const [prodPriceEgp, setProdPriceEgp] = useState('0');
  const [prodSizeStock, setProdSizeStock] = useState<Record<string, string>>({});
  const [prodImage, setProdImage] = useState('');
  const [prodSizesText, setProdSizesText] = useState('S, M, L, XL');
  const [prodActive, setProdActive] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [productModalError, setProductModalError] = useState<string | null>(null);
  const [quickAdjustingId, setQuickAdjustingId] = useState<string | null>(null);

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
  const [newPermProducts, setNewPermProducts] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState<string | null>(null);

  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;
  const currencyLabel = lang === 'ar' ? 'ج.م' : 'EGP';

  const loadStaffProfile = useCallback(async () => {
    if (!user) {
      setStaffProfile(null);
      setVerifiedEmail(null);
      setNeedsNewTab(false);
      return;
    }

    setStaffLoading(true);
    setPortalError(null);
    setNeedsNewTab(false);
    try {
      let forceRefresh = false;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const token = await getFreshToken(forceRefresh);
          if (!token) {
            setPortalError(
              lang === 'ar'
                ? 'تعذر الحصول على رمز التحقق من حساب جوجل. جرّب تحديث الصفحة أو تسجيل الدخول مجدداً.'
                : 'Unable to retrieve Google verification token. Try refreshing or signing in again.'
            );
            return;
          }

          const res = await fetch('/api/staff/me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });

          if (res.status === 401 && !forceRefresh) {
            forceRefresh = true;
            continue;
          }

          if (res.status >= 502 && res.status <= 504 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 650 * (attempt + 1)));
            continue;
          }

          const data = await parseApiJson<{
            isStaff?: boolean;
            staff?: StaffProfile | null;
            email?: string | null;
            error?: string;
          }>(res, lang);

          if (!res.ok) {
            if (res.status >= 500 && attempt < 2) {
              await new Promise((r) => setTimeout(r, 650 * (attempt + 1)));
              continue;
            }
            setPortalError(data.error || 'Unable to verify staff account.');
            setStaffProfile(null);
          } else {
            setVerifiedEmail(data.email || user.email || null);
            setStaffProfile(data.isStaff && data.staff ? data.staff : null);
          }
          return;
        } catch (err) {
          lastError = err;
          if (err instanceof ProxyRedirectError) {
            setNeedsNewTab(true);
            throw err;
          }
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 650 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }

      if (lastError) {
        throw lastError;
      }
    } catch (err) {
      if (err instanceof TypeError) {
        setNeedsNewTab(true);
      }
      setPortalError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'تعذر الاتصال بخادم الموظفين حالياً.'
          : 'Unable to reach staff server.'
      );
    } finally {
      setStaffLoading(false);
    }
  }, [user, getFreshToken, lang]);

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
            fetch('/api/staff/orders', { headers, cache: 'no-store' })
              .then(async (r) => {
                const json = await parseApiJson<{ orders?: StaffOrderRecord[]; error?: string }>(r, lang);
                if (!r.ok) {
                  throw new Error(json.error || 'Failed to load orders.');
                }
                setOrders(json.orders ?? []);
              })
          );
        } else {
          setOrders([]);
        }

        if (profile.canViewSales) {
          requests.push(
            fetch('/api/staff/sales', { headers, cache: 'no-store' })
              .then(async (r) => {
                const json = await parseApiJson<{ summary?: SalesSummary | null; error?: string }>(r, lang);
                if (!r.ok) {
                  throw new Error(json.error || 'Failed to load sales summary.');
                }
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
    [getFreshToken, lang]
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
          cache: 'no-store',
        });
        const data = await parseApiJson<{ members?: StaffProfile[]; error?: string }>(res, lang);
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
    [getFreshToken, lang]
  );

  const loadCatalogProducts = useCallback(
    async (profile: StaffProfile) => {
      if (!profile.canManageProducts) {
        setCatalogProducts([]);
        return;
      }
      setProductsLoading(true);
      try {
        const token = await getFreshToken();
        if (!token) return;
        const res = await fetch('/api/staff/products', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await parseApiJson<{
          products?: Product[];
          categories?: StoreCategory[];
          error?: string;
        }>(res, lang);
        if (!res.ok) {
          setPortalError(data.error || 'Unable to load products catalog.');
        } else {
          setCatalogProducts(data.products ?? []);
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCatalogCategories(data.categories);
          }
        }
      } catch (err) {
        setPortalError(err instanceof Error ? err.message : 'Unable to load products.');
      } finally {
        setProductsLoading(false);
      }
    },
    [getFreshToken, lang]
  );

  useEffect(() => {
    if (authReady) {
      void loadStaffProfile();
    }
  }, [authReady, loadStaffProfile]);

  useEffect(() => {
    if (!staffProfile) return;
    void loadDashboardData(staffProfile);
    if (staffProfile.canManageProducts) {
      void loadCatalogProducts(staffProfile);
    }
    if (staffProfile.canManageStaff) {
      void loadTeamMembers(staffProfile);
    }
  }, [staffProfile, loadDashboardData, loadCatalogProducts, loadTeamMembers]);

  useEffect(() => {
    if (!staffProfile) return;
    if (activeTab === 'team' && !staffProfile.canManageStaff) {
      setActiveTab(staffProfile.canViewOrders ? 'orders' : staffProfile.canManageProducts ? 'products' : 'orders');
    } else if (activeTab === 'products' && !staffProfile.canManageProducts) {
      setActiveTab('orders');
    } else if (activeTab === 'orders' && !staffProfile.canViewOrders && staffProfile.canManageProducts) {
      setActiveTab('products');
    }
  }, [staffProfile, activeTab]);

  const handleRolePresetChange = (role: StaffRole) => {
    setNewRole(role);
    const preset = ROLE_PRESETS[role];
    setNewPermOrders(preset.canViewOrders);
    setNewPermStatus(preset.canUpdateOrderStatus);
    setNewPermSales(preset.canViewSales);
    setNewPermManage(preset.canManageStaff);
    setNewPermProducts(preset.canManageProducts);
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
      const data = await parseApiJson<{ error?: string }>(res, lang);
      if (!res.ok) {
        setPortalError(data.error || 'Failed to update order status.');
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.orderRef === orderRef ? { ...o, status: nextStatus } : o))
      );
      setSelectedOrder((prev) =>
        prev && prev.orderRef === orderRef ? { ...prev, status: nextStatus } : prev
      );
      if (staffProfile.canViewSales) {
        const salesRes = await fetch('/api/staff/sales', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (salesRes.ok) {
          const salesData = await parseApiJson<{ summary?: SalesSummary | null }>(salesRes, lang);
          setSalesSummary(salesData.summary ?? null);
        }
      }
      if (staffProfile.canManageProducts) {
        await loadCatalogProducts(staffProfile);
      }
      onCatalogUpdated?.();
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
          canManageProducts: newPermProducts,
          isActive: true,
        }),
      });
      const data = await parseApiJson<{ member?: StaffProfile; error?: string }>(res, lang);
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
      | 'canManageProducts'
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
      const data = await parseApiJson<{ member?: StaffProfile; error?: string }>(res, lang);
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
          canManageProducts: preset.canManageProducts,
        }),
      });
      const data = await parseApiJson<{ member?: StaffProfile; error?: string }>(res, lang);
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
      const data = await parseApiJson<{ error?: string }>(res, lang);
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
        order.address.toLowerCase().includes(q) ||
        order.notes.toLowerCase().includes(q) ||
        (order.staffNotesList ?? []).some((n) => n.note.toLowerCase().includes(q))
      );
    });
  }, [orders, statusFilter, searchQuery]);

  useEffect(() => {
    if (!selectedOrder) return;
    setNewStaffNote('');
    setStaffNoteError(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedOrder(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedOrder?.orderRef]);

  const handleCopyPhone = (phone: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(phone).then(() => {
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 1800);
    });
  };

  const handleAddStaffNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !staffProfile?.canUpdateOrderStatus) return;
    const cleanNote = newStaffNote.trim();
    if (!cleanNote) return;

    setSavingStaffNote(true);
    setStaffNoteError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;

      const res = await fetch(
        `/api/staff/orders/${encodeURIComponent(selectedOrder.orderRef)}/notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ note: cleanNote }),
        }
      );
      const data = await parseApiJson<{ note?: StaffOrderNote; error?: string }>(res, lang);
      if (!res.ok || !data.note) {
        setStaffNoteError(
          data.error || (lang === 'ar' ? 'تعذر حفظ الملاحظة.' : 'Unable to save note.')
        );
        return;
      }

      const createdNote = data.note;
      setOrders((prev) =>
        prev.map((o) =>
          o.orderRef === selectedOrder.orderRef
            ? { ...o, staffNotesList: [createdNote, ...(o.staffNotesList ?? [])] }
            : o
        )
      );
      setSelectedOrder((prev) =>
        prev && prev.orderRef === selectedOrder.orderRef
          ? { ...prev, staffNotesList: [createdNote, ...(prev.staffNotesList ?? [])] }
          : prev
      );
      setNewStaffNote('');
    } catch (err) {
      setStaffNoteError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'حدث خطأ أثناء حفظ الملاحظة.'
          : 'Failed to save staff note.'
      );
    } finally {
      setSavingStaffNote(false);
    }
  };

  const handleDeleteStaffNote = async (orderRef: string, noteId: number) => {
    if (!staffProfile?.canUpdateOrderStatus) return;
    setDeletingNoteId(noteId);
    setStaffNoteError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(
        `/api/staff/orders/${encodeURIComponent(orderRef)}/notes/${noteId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const data = await parseApiJson<{ error?: string }>(res, lang);
        setStaffNoteError(data.error || 'Unable to delete note.');
        return;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.orderRef === orderRef
            ? {
                ...o,
                staffNotesList: (o.staffNotesList ?? []).filter((n) => n.id !== noteId),
              }
            : o
        )
      );
      setSelectedOrder((prev) =>
        prev && prev.orderRef === orderRef
          ? {
              ...prev,
              staffNotesList: (prev.staffNotesList ?? []).filter((n) => n.id !== noteId),
            }
          : prev
      );
    } catch (err) {
      setStaffNoteError(err instanceof Error ? err.message : 'Unable to delete note.');
    } finally {
      setDeletingNoteId(null);
    }
  };

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

  const filteredCatalogProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return catalogProducts;
    return catalogProducts.filter(
      (p) =>
        p.title.ar.toLowerCase().includes(q) ||
        p.title.en.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [catalogProducts, productSearch]);

  const parsedModalSizes = useMemo(() => {
    const list = Array.from(
      new Set(
        prodSizesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    return list.length > 0 ? list : ['S', 'M', 'L', 'XL'];
  }, [prodSizesText]);

  const modalTotalStock = useMemo(
    () =>
      parsedModalSizes.reduce((sum, sz) => {
        const val = Number(prodSizeStock[sz] ?? 0);
        return sum + (Number.isFinite(val) && val > 0 ? Math.round(val) : 0);
      }, 0),
    [parsedModalSizes, prodSizeStock]
  );

  const openEditProductModal = (product: Product) => {
    setIsCreatingProduct(false);
    setEditingProduct(product);
    setProdSku(product.sku);
    setProdCategory(product.category);
    setProdTitleAr(product.title.ar);
    setProdTitleEn(product.title.en);
    setProdSubtitleAr(product.subtitle.ar);
    setProdSubtitleEn(product.subtitle.en);
    setProdPriceEgp(String(product.priceEgp));

    const nextMap: Record<string, string> = {};
    const fallbackPerSize = Math.floor(
      (typeof product.stockQty === 'number' ? product.stockQty : 15) / Math.max(1, product.sizes.length)
    );
    for (const sz of product.sizes) {
      const qty =
        product.sizeStock && typeof product.sizeStock[sz] === 'number'
          ? product.sizeStock[sz]
          : fallbackPerSize;
      nextMap[sz] = String(qty);
    }
    setProdSizeStock(nextMap);

    setProdImage(product.image);
    setProdSizesText(product.sizes.join(', '));
    setProdActive(product.isActive !== false);
    setProductModalError(null);
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setIsCreatingProduct(true);
    setProdSku(`MRY-0${Math.floor(70 + Math.random() * 29)}`);
    setProdCategory(catalogCategories[0]?.slug || 'outerwear');
    setProdTitleAr('');
    setProdTitleEn('');
    setProdSubtitleAr('');
    setProdSubtitleEn('');
    setProdPriceEgp('12500');
    setProdSizeStock({ XS: '4', S: '4', M: '4', L: '4', XL: '4' });
    setProdImage('/src/assets/images/prod_only_trench_1795658686842.jpg');
    setProdSizesText('XS, S, M, L, XL');
    setProdActive(true);
    setProductModalError(null);
  };

  const getCategoryLabel = useCallback(
    (slug: string) => {
      const found = catalogCategories.find((c) => c.slug === slug);
      if (found) return lang === 'ar' ? found.nameAr : found.nameEn;
      return slug;
    },
    [catalogCategories, lang]
  );

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffProfile?.canManageProducts) return;
    const cleanAr = newCatNameAr.trim();
    const cleanEn = newCatNameEn.trim();
    if (!cleanAr || !cleanEn) return;

    setSavingCategory(true);
    setPortalError(null);
    setCategoryFeedback(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch('/api/staff/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nameAr: cleanAr, nameEn: cleanEn }),
      });
      const data = await parseApiJson<{ category?: StoreCategory; error?: string }>(res, lang);
      if (!res.ok || !data.category) {
        setPortalError(data.error || 'Unable to add category.');
        return;
      }
      setCatalogCategories((prev) => [...prev, data.category!]);
      setNewCatNameAr('');
      setNewCatNameEn('');
      setCategoryFeedback(
        lang === 'ar'
          ? `تم إضافة قسم "${data.category.nameAr}" للعرض على الموقع.`
          : `Added "${data.category.nameEn}" category to storefront.`
      );
      onCatalogUpdated?.();
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to create category.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleToggleCategoryVisibility = async (cat: StoreCategory) => {
    if (!staffProfile?.canManageProducts) return;
    setBusyCategorySlug(cat.slug);
    setPortalError(null);
    setCategoryFeedback(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/staff/categories/${encodeURIComponent(cat.slug)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      const data = await parseApiJson<{ category?: StoreCategory; error?: string }>(res, lang);
      if (!res.ok || !data.category) {
        setPortalError(data.error || 'Unable to update category.');
        return;
      }
      setCatalogCategories((prev) =>
        prev.map((c) => (c.slug === cat.slug ? data.category! : c))
      );
      onCatalogUpdated?.();
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to update category.');
    } finally {
      setBusyCategorySlug(null);
    }
  };

  const handleDeleteCategory = async (cat: StoreCategory) => {
    if (!staffProfile?.canManageProducts) return;
    setBusyCategorySlug(cat.slug);
    setPortalError(null);
    setCategoryFeedback(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/staff/categories/${encodeURIComponent(cat.slug)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<{ deleted?: boolean; error?: string }>(res, lang);
      if (!res.ok) {
        setPortalError(data.error || 'Unable to delete category.');
        return;
      }
      setCatalogCategories((prev) => prev.filter((c) => c.slug !== cat.slug));
      onCatalogUpdated?.();
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to delete category.');
    } finally {
      setBusyCategorySlug(null);
    }
  };

  const closeProductModal = () => {
    setEditingProduct(null);
    setIsCreatingProduct(false);
    setProductModalError(null);
  };

  const handleImageFileUpload = async (file: File | null) => {
    if (!file || !staffProfile?.canManageProducts) return;
    if (file.size > 5 * 1024 * 1024) {
      setProductModalError(
        lang === 'ar'
          ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت.'
          : 'Image size must be under 5 MB.'
      );
      return;
    }

    setUploadingImage(true);
    setProductModalError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });

      const token = await getFreshToken();
      if (!token) return;

      const res = await fetch('/api/staff/products/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await parseApiJson<{ imageUrl?: string; error?: string }>(res, lang);
      if (!res.ok || !data.imageUrl) {
        setProductModalError(data.error || 'Failed to upload image.');
        return;
      }
      setProdImage(data.imageUrl);
    } catch (err) {
      setProductModalError(err instanceof Error ? err.message : 'Unable to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProductModal = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffProfile?.canManageProducts) return;

    const priceNum = Number(prodPriceEgp);
    const sizes = parsedModalSizes;

    if (!prodTitleAr.trim() || !prodTitleEn.trim()) {
      setProductModalError(
        lang === 'ar'
          ? 'يرجى إدخال اسم المنتج بالعربية والإنجليزية.'
          : 'Please provide both Arabic and English display titles.'
      );
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setProductModalError(lang === 'ar' ? 'السعر غير صالح.' : 'Invalid price.');
      return;
    }

    const cleanSizeStock: Record<string, number> = {};
    for (const sz of sizes) {
      const val = Number(prodSizeStock[sz] ?? 0);
      if (!Number.isFinite(val) || val < 0 || val > 100000) {
        setProductModalError(
          lang === 'ar'
            ? `كمية المخزون للمقاس (${sz}) غير صالحة.`
            : `Invalid stock quantity for size ${sz}.`
        );
        return;
      }
      cleanSizeStock[sz] = Math.round(val);
    }

    setSavingProduct(true);
    setProductModalError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;

      if (isCreatingProduct) {
        const res = await fetch('/api/staff/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sku: prodSku.trim(),
            category: prodCategory,
            image: prodImage.trim(),
            priceEgp: Math.round(priceNum),
            sizeStock: cleanSizeStock,
            sizes,
            titleAr: prodTitleAr.trim(),
            titleEn: prodTitleEn.trim(),
            subtitleAr: prodSubtitleAr.trim() || prodTitleAr.trim(),
            subtitleEn: prodSubtitleEn.trim() || prodTitleEn.trim(),
          }),
        });
        const data = await parseApiJson<{ product?: Product; error?: string }>(res, lang);
        if (!res.ok || !data.product) {
          setProductModalError(data.error || 'Failed to create product.');
          return;
        }
        setCatalogProducts((prev) => [...prev, data.product!]);
        onCatalogUpdated?.();
        closeProductModal();
      } else if (editingProduct) {
        const res = await fetch(`/api/staff/products/${encodeURIComponent(editingProduct.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            titleAr: prodTitleAr.trim(),
            titleEn: prodTitleEn.trim(),
            subtitleAr: prodSubtitleAr.trim(),
            subtitleEn: prodSubtitleEn.trim(),
            priceEgp: Math.round(priceNum),
            sizeStock: cleanSizeStock,
            image: prodImage.trim(),
            category: prodCategory,
            sizes,
            isActive: prodActive,
          }),
        });
        const data = await parseApiJson<{ product?: Product; error?: string }>(res, lang);
        if (!res.ok || !data.product) {
          setProductModalError(data.error || 'Failed to update product.');
          return;
        }
        setCatalogProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? data.product! : p))
        );
        onCatalogUpdated?.();
        closeProductModal();
      }
    } catch (err) {
      setProductModalError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleQuickStockPatch = async (
    product: Product,
    patch: { sizeStock?: Record<string, number>; isActive?: boolean }
  ) => {
    if (!staffProfile?.canManageProducts) return;
    setQuickAdjustingId(product.id);
    setPortalError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/staff/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      const data = await parseApiJson<{ product?: Product; error?: string }>(res, lang);
      if (!res.ok || !data.product) {
        setPortalError(data.error || 'Unable to update product.');
        return;
      }
      setCatalogProducts((prev) => prev.map((p) => (p.id === product.id ? data.product! : p)));
      onCatalogUpdated?.();
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Unable to update product.');
    } finally {
      setQuickAdjustingId(null);
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
        staffProfile.canManageProducts
          ? lang === 'ar'
            ? 'إدارة المنتجات والمخزون'
            : 'Manage Products & Stock'
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
        /* State 3: Connection/Server Error vs Unauthorized Account */
        <div className="mx-auto max-w-lg rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#13161C] p-8 sm:p-10 text-center space-y-5">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${
              portalError
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}
          >
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h2 className="font-editorial text-xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
              {portalError
                ? lang === 'ar'
                  ? 'تعذر التحقق من صلاحيات الموظف مؤقتاً'
                  : 'Unable to Verify Staff Access Right Now'
                : lang === 'ar'
                ? 'الحساب ده معلهوش صلاحيات موظف'
                : 'No Active Staff Permissions'}
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
              {portalError
                ? lang === 'ar'
                  ? 'الحساب مسجل دخول حالياً، لكن تعذر استلام رد سليم من الخادم (قد يكون الخادم أُعيد تشغيله للتو أو تحتاج الصفحة لإعادة تحميل).'
                  : 'Your Google account is signed in, but the staff server did not return a valid response. Try refreshing the page or retrying.'
                : lang === 'ar'
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
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-4 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
            {portalError && needsNewTab && (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#/staff'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#1D4ED8]/30 bg-[#1D4ED8]/10 px-4 text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8]/15 whitespace-nowrap"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'فتح في نافذة جديدة' : 'Open in New Tab'}</span>
              </a>
            )}
            {portalError && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#1D4ED8]/30 bg-[#1D4ED8]/10 px-4 text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8]/15 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'تحديث الصفحة' : 'Refresh Page'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadStaffProfile()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 text-xs font-semibold text-white hover:bg-[#1E40AF] cursor-pointer whitespace-nowrap"
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
                  if (staffProfile.canManageProducts) void loadCatalogProducts(staffProfile);
                  if (staffProfile.canManageStaff) void loadTeamMembers(staffProfile);
                }}
                disabled={dataLoading || productsLoading}
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

          {/* Section Switcher: Orders Tracking vs Products & Inventory vs Staff & Permissions */}
          {(staffProfile.canManageStaff || staffProfile.canManageProducts) && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#ECEEF2] dark:bg-[#13161C] p-1.5 w-fit">
              {staffProfile.canViewOrders && (
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
              )}

              {staffProfile.canManageProducts && (
                <button
                  type="button"
                  onClick={() => setActiveTab('products')}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'products'
                      ? 'bg-white text-[#0F1115] shadow-xs dark:bg-[#232833] dark:text-[#F4F5F7]'
                      : 'text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7]'
                  }`}
                >
                  <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {lang === 'ar'
                      ? `المنتجات والمخزون (${catalogProducts.length})`
                      : `Products & Stock (${catalogProducts.length})`}
                  </span>
                </button>
              )}

              {staffProfile.canManageStaff && (
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
              )}
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
                                {lang === 'ar' ? 'العميل والعنوان' : 'Customer & Location'}
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
                              <th className="px-4 py-3 font-semibold text-end whitespace-nowrap">
                                {lang === 'ar' ? 'التفاصيل' : 'Details'}
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
                              const mapsUrl = buildGoogleMapsSearchUrl(order.address);

                              return (
                                <tr
                                  key={order.id}
                                  onClick={() => setSelectedOrder(order)}
                                  className="hover:bg-[#1D4ED8]/[0.03] dark:hover:bg-[#3B82F6]/[0.06] transition-colors align-top cursor-pointer"
                                >
                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    <span className="font-mono font-semibold text-[#1D4ED8] dark:text-[#60A5FA] tabular-nums">
                                      {order.orderRef}
                                    </span>
                                    <p className="mt-1 text-[11px] text-[#525866] dark:text-[#9CA3AF] tabular-nums">
                                      {formatDate(order.createdAt)}
                                    </p>
                                  </td>

                                  <td className="px-4 py-3.5 min-w-[230px] max-w-xs space-y-1.5">
                                    <p className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                                      {order.fullName}{' '}
                                      <span className="font-normal text-[#525866] dark:text-[#9CA3AF]" dir="ltr">
                                        · {order.phone}
                                      </span>
                                    </p>
                                    <a
                                      href={mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      title={lang === 'ar' ? 'افتح اللوكيشن في خرائط جوجل' : 'Open location in Google Maps'}
                                      className="group/loc inline-flex items-start gap-1.5 text-start text-[#1D4ED8] dark:text-[#60A5FA] hover:underline leading-relaxed"
                                    >
                                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                                      <span className="line-clamp-2">{order.address}</span>
                                      <ExternalLink className="h-3 w-3 shrink-0 mt-1 opacity-70 group-hover/loc:opacity-100" aria-hidden="true" />
                                    </a>
                                    {order.notes && (
                                      <p className="inline-flex items-start gap-1 text-[11px] text-[#525866] dark:text-[#9CA3AF] line-clamp-1">
                                        <FileText className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
                                        <span>{order.notes}</span>
                                      </p>
                                    )}
                                    {(order.staffNotesList?.length ?? 0) > 0 && (
                                      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                                        <MessageSquarePlus className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        <span>
                                          {lang === 'ar'
                                            ? `ملاحظات الموظف (${order.staffNotesList?.length})`
                                            : `Staff notes (${order.staffNotesList?.length})`}
                                        </span>
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

                                  <td
                                    className="px-4 py-3.5 whitespace-nowrap"
                                    onClick={(e) => e.stopPropagation()}
                                  >
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

                                  <td
                                    className="px-4 py-3.5 whitespace-nowrap text-end"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedOrder(order)}
                                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-[#F8F8FA] dark:bg-[#0B0D11] px-2.5 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#60A5FA] transition-colors cursor-pointer"
                                    >
                                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>{lang === 'ar' ? 'فتح الطلب' : 'Open'}</span>
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
                </>
              )}
            </div>
          )}

          {/* Tab B: Products, Inventory, Pricing, Display Names & Images */}
          {activeTab === 'products' && staffProfile.canManageProducts && (
            <div className="space-y-5">
              {/* Inventory Summary Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-4">
                  <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                    {catalogProducts.length}
                  </p>
                </div>
                <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-4">
                  <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'إجمالي القطع بالمخزون' : 'Total Stock Units'}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                    {catalogProducts.reduce((sum, p) => sum + (p.stockQty ?? 0), 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-4">
                  <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'مقاسات نفذت كميتها' : 'Products w/ Depleted Size'}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {
                      catalogProducts.filter((p) =>
                        p.sizes.some((sz) => (p.sizeStock?.[sz] ?? p.stockQty ?? 0) <= 0)
                      ).length
                    }
                  </p>
                </div>
                <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-4">
                  <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'نفذت بالكامل / مخفي' : 'Fully Out / Hidden'}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">
                    {catalogProducts.filter((p) => (p.stockQty ?? 0) <= 0 || p.isActive === false).length}
                  </p>
                </div>
              </div>

              {/* Storefront Categories Management Panel */}
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FolderPlus className="h-4 w-4 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                      {lang === 'ar' ? 'أقسام العرض على الموقع' : 'Storefront Categories'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar'
                      ? `${catalogCategories.filter((c) => c.isActive).length} أقسام ظاهرة بالموقع`
                      : `${catalogCategories.filter((c) => c.isActive).length} visible on storefront`}
                  </span>
                </div>

                <form
                  onSubmit={(e) => void handleCreateCategory(e)}
                  className="grid gap-3 sm:grid-cols-12 items-end"
                >
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-medium text-[#525866] dark:text-[#9CA3AF]">
                      {lang === 'ar' ? 'اسم القسم (عربي)' : 'Category Name (Arabic)'}
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatNameAr}
                      onChange={(e) => setNewCatNameAr(e.target.value)}
                      placeholder={lang === 'ar' ? 'مثال: فساتين سهرة / أحذية' : 'e.g. فساتين'}
                      className="mt-1 h-9 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-medium text-[#525866] dark:text-[#9CA3AF]">
                      {lang === 'ar' ? 'اسم القسم (إنجليزي)' : 'Category Name (English)'}
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={newCatNameEn}
                      onChange={(e) => setNewCatNameEn(e.target.value)}
                      placeholder="e.g. Dresses / Footwear"
                      className="mt-1 h-9 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={savingCategory}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F1115] dark:bg-[#F4F5F7] px-3 text-xs font-semibold text-white dark:text-[#0B0D11] hover:bg-[#1D4ED8] dark:hover:bg-[#60A5FA] disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {savingCategory ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{lang === 'ar' ? 'إضافة قسم' : 'Add'}</span>
                    </button>
                  </div>
                </form>

                {categoryFeedback && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{categoryFeedback}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {catalogCategories.map((cat) => {
                    const count = catalogProducts.filter((p) => p.category === cat.slug).length;
                    const busyCat = busyCategorySlug === cat.slug;
                    return (
                      <div
                        key={cat.slug}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                          cat.isActive
                            ? 'border-black/[0.1] dark:border-white/[0.12] bg-[#F8F8FA] dark:bg-[#0B0D11]'
                            : 'border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] opacity-65'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                            {lang === 'ar' ? cat.nameAr : cat.nameEn}
                          </span>
                          <span className="text-[11px] text-[#525866] dark:text-[#9CA3AF] tabular-nums">
                            ({count})
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={busyCat}
                          onClick={() => void handleToggleCategoryVisibility(cat)}
                          title={
                            cat.isActive
                              ? lang === 'ar'
                                ? 'إخفاء القسم من الموقع'
                                : 'Hide category from storefront'
                              : lang === 'ar'
                              ? 'إظهار القسم بالموقع'
                              : 'Show category on storefront'
                          }
                          className={`inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-semibold cursor-pointer ${
                            cat.isActive
                              ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-[#525866] dark:text-[#9CA3AF] hover:bg-black/[0.05]'
                          }`}
                        >
                          {cat.isActive ? (
                            <>
                              <Eye className="h-3 w-3" aria-hidden="true" />
                              <span>{lang === 'ar' ? 'ظاهر' : 'On'}</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" aria-hidden="true" />
                              <span>{lang === 'ar' ? 'مخفي' : 'Off'}</span>
                            </>
                          )}
                        </button>

                        {count === 0 && (
                          <button
                            type="button"
                            disabled={busyCat}
                            onClick={() => void handleDeleteCategory(cat)}
                            aria-label={lang === 'ar' ? 'حذف القسم' : 'Delete category'}
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-[#525866] hover:text-red-600 dark:text-[#9CA3AF] dark:hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Search & Add Product Toolbar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-80">
                  <Search
                    className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-[#525866] dark:text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'ابحث باسم المنتج أو كود SKU...'
                        : 'Search product title or SKU...'
                    }
                    className="h-10 w-full rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#13161C] ps-9 pe-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/70 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={openCreateProductModal}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'إضافة برودكت جديد' : 'Add New Product'}</span>
                </button>
              </div>

              {/* Products Inventory Table */}
              <div className="overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C]">
                {productsLoading && catalogProducts.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'جاري تحميل المنتجات والمخزون...' : 'Loading products & inventory...'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-start text-xs">
                      <thead>
                        <tr className="border-b border-black/[0.08] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] text-[#525866] dark:text-[#9CA3AF]">
                          <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                            {lang === 'ar' ? 'البرودكت والصورة' : 'Product & Image'}
                          </th>
                          <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                            {lang === 'ar' ? 'الاسم المعروض' : 'Display Names'}
                          </th>
                          <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                            {lang === 'ar' ? 'السعر' : 'Price'}
                          </th>
                          <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">
                            {lang === 'ar' ? 'المخزون لكل مقاس' : 'Stock per Size'}
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            {lang === 'ar' ? 'الظهور بالموقع' : 'Visibility'}
                          </th>
                          <th className="px-4 py-3 font-semibold text-end whitespace-nowrap">
                            {lang === 'ar' ? 'تحكم' : 'Manage'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
                        {filteredCatalogProducts.map((product) => {
                          const totalQty = typeof product.stockQty === 'number' ? product.stockQty : 0;
                          const visible = product.isActive !== false;
                          const busy = quickAdjustingId === product.id;
                          const currentMap: Record<string, number> = {};
                          for (const sz of product.sizes) {
                            currentMap[sz] =
                              product.sizeStock && typeof product.sizeStock[sz] === 'number'
                                ? product.sizeStock[sz]
                                : 0;
                          }

                          return (
                            <tr
                              key={product.id}
                              className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors align-middle"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={product.image}
                                    alt={product.title[lang]}
                                    referrerPolicy="no-referrer"
                                    className="h-14 w-11 rounded-lg object-cover bg-[#EBEDF0] dark:bg-[#1B1F27] shrink-0"
                                  />
                                  <div className="space-y-0.5">
                                    <span className="font-mono text-[11px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                                      {product.sku}
                                    </span>
                                    <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                                      {getCategoryLabel(product.category)}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3 min-w-[180px] max-w-xs space-y-0.5">
                                <p className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                                  {product.title.ar}
                                </p>
                                <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]" dir="ltr">
                                  {product.title.en}
                                </p>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                                {product.priceEgp.toLocaleString('en-US')} {currencyLabel}
                              </td>

                              <td className="px-4 py-3 min-w-[270px]">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <span className="text-[#525866] dark:text-[#9CA3AF]">
                                      {lang === 'ar' ? `الإجمالي: ${totalQty}` : `Total: ${totalQty}`}
                                    </span>
                                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" />}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {product.sizes.map((sz) => {
                                      const szQty = currentMap[sz] ?? 0;
                                      const szOut = szQty <= 0;
                                      return (
                                        <div
                                          key={sz}
                                          className={`inline-flex items-center rounded-md border text-[11px] ${
                                            szOut
                                              ? 'border-red-300/70 bg-red-50/70 text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-400'
                                              : 'border-black/[0.1] bg-[#F8F8FA] text-[#0F1115] dark:border-white/[0.12] dark:bg-[#0B0D11] dark:text-[#F4F5F7]'
                                          }`}
                                        >
                                          <span className="px-1.5 font-semibold">{sz}</span>
                                          <button
                                            type="button"
                                            disabled={busy || szQty <= 0}
                                            onClick={() =>
                                              void handleQuickStockPatch(product, {
                                                sizeStock: {
                                                  ...currentMap,
                                                  [sz]: Math.max(0, szQty - 1),
                                                },
                                              })
                                            }
                                            aria-label={`${sz} -1`}
                                            className="inline-flex h-6 w-5 items-center justify-center opacity-75 hover:opacity-100 disabled:opacity-30 cursor-pointer"
                                          >
                                            <Minus className="h-2.5 w-2.5" aria-hidden="true" />
                                          </button>
                                          <span className="min-w-[18px] text-center font-semibold tabular-nums">
                                            {szQty}
                                          </span>
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              void handleQuickStockPatch(product, {
                                                sizeStock: {
                                                  ...currentMap,
                                                  [sz]: szQty + 1,
                                                },
                                              })
                                            }
                                            aria-label={`${sz} +1`}
                                            className="inline-flex h-6 w-5 items-center justify-center opacity-75 hover:opacity-100 disabled:opacity-30 cursor-pointer"
                                          >
                                            <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleQuickStockPatch(product, { isActive: !visible })
                                  }
                                  className={`inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                                    visible
                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                      : 'border-black/[0.12] dark:border-white/[0.14] text-[#525866] dark:text-[#9CA3AF]'
                                  }`}
                                >
                                  {visible ? (
                                    <>
                                      <Eye className="h-3 w-3" aria-hidden="true" />
                                      <span>{lang === 'ar' ? 'ظاهر' : 'Visible'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="h-3 w-3" aria-hidden="true" />
                                      <span>{lang === 'ar' ? 'مخفي' : 'Hidden'}</span>
                                    </>
                                  )}
                                </button>
                              </td>

                              <td className="px-4 py-3 text-end whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openEditProductModal(product)}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-[#F8F8FA] dark:bg-[#0B0D11] px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#60A5FA] transition-colors cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
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

          {/* Tab C: Staff & Permissions Management */}
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
                      checked={newPermProducts}
                      onChange={(e) => setNewPermProducts(e.target.checked)}
                      className="rounded border-black/20"
                    />
                    <span>
                      {lang === 'ar'
                        ? 'إدارة المخزون والأسعار والصور والمنتجات'
                        : 'Manage products, stock, prices & images'}
                    </span>
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
                            {lang === 'ar' ? 'المنتجات' : 'Products'}
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
                                  'canManageProducts',
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

      {/* Full Customer Order Detail Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-order-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#13161C] shadow-2xl"
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-[#13161C]/95 backdrop-blur-md px-6 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[#1D4ED8] dark:text-[#60A5FA] tabular-nums">
                    {selectedOrder.orderRef}
                  </span>
                  <span aria-hidden="true" className="text-[#525866] dark:text-[#9CA3AF]">·</span>
                  <span className="text-xs text-[#525866] dark:text-[#9CA3AF] tabular-nums">
                    {formatDate(selectedOrder.createdAt)}
                  </span>
                </div>
                <h2
                  id="staff-order-modal-title"
                  className="mt-1 font-editorial text-xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]"
                >
                  {lang === 'ar' ? 'تفاصيل طلب العميل' : 'Customer Order Details'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.1] dark:border-white/[0.12] text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] p-4">
                <div>
                  <p className="text-[11px] font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'حالة الطلب الحالية' : 'Current Order Status'}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                    {
                      ORDER_STATUS_LABELS[
                        (['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(
                          selectedOrder.status
                        )
                          ? selectedOrder.status
                          : 'confirmed') as OrderStatusValue
                      ][lang]
                    }
                  </p>
                </div>

                {staffProfile?.canUpdateOrderStatus && (
                  <div className="flex items-center gap-2">
                    <select
                      value={
                        ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(
                          selectedOrder.status
                        )
                          ? selectedOrder.status
                          : 'confirmed'
                      }
                      disabled={updatingOrderRef === selectedOrder.orderRef}
                      onChange={(e) =>
                        void handleOrderStatusChange(
                          selectedOrder.orderRef,
                          e.target.value as OrderStatusValue
                        )
                      }
                      className="h-9 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#13161C] px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none cursor-pointer disabled:opacity-60"
                    >
                      {(Object.keys(ORDER_STATUS_LABELS) as OrderStatusValue[]).map((statusKey) => (
                        <option key={statusKey} value={statusKey}>
                          {ORDER_STATUS_LABELS[statusKey][lang]}
                        </option>
                      ))}
                    </select>
                    {updatingOrderRef === selectedOrder.orderRef && (
                      <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" />
                    )}
                  </div>
                )}
              </div>

              {/* Customer Contact Information */}
              <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] p-4 space-y-3">
                <p className="text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                  {lang === 'ar' ? 'بيانات العميل' : 'Customer Information'}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                      {lang === 'ar' ? 'الاسم بالكامل' : 'Full Name'}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                      {selectedOrder.fullName}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                      {lang === 'ar' ? 'رقم الموبايل' : 'Phone Number'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${selectedOrder.phone}`}
                        dir="ltr"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{selectedOrder.phone}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(selectedOrder.phone)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-black/[0.1] dark:border-white/[0.12] px-2 text-[11px] font-medium text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7] cursor-pointer"
                      >
                        {copiedPhone ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'تم النسخ' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" aria-hidden="true" />
                            <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Location with Direct Google Maps Trigger */}
              <div className="rounded-xl border border-[#1D4ED8]/25 bg-[#1D4ED8]/[0.04] dark:border-[#60A5FA]/25 dark:bg-[#3B82F6]/[0.08] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'لوكيشن وعنوان التوصيل' : 'Delivery Location & Address'}</span>
                  </p>
                </div>

                <a
                  href={buildGoogleMapsSearchUrl(selectedOrder.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#0B0D11] p-3 text-sm font-medium leading-relaxed text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] transition-colors"
                >
                  {selectedOrder.address}
                </a>

                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={buildGoogleMapsSearchUrl(selectedOrder.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 flex-1 min-w-[180px] items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors"
                  >
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {lang === 'ar' ? 'فتح اللوكيشن على خرائط جوجل' : 'Open Location in Google Maps'}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>

                  <a
                    href={buildGoogleMapsDirectionsUrl(selectedOrder.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#0B0D11] px-4 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] transition-colors"
                  >
                    <Navigation className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'اتجاهات التوصيل' : 'Get Directions'}</span>
                  </a>
                </div>
              </div>

              {/* Customer Notes */}
              <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] p-4 space-y-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                  <FileText className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'ملاحظات العميل عند الطلب' : 'Customer Checkout Notes'}</span>
                </p>
                {selectedOrder.notes ? (
                  <p className="rounded-lg bg-[#F8F8FA] dark:bg-[#0B0D11] p-3 text-sm leading-relaxed text-[#0F1115] dark:text-[#F4F5F7] whitespace-pre-wrap">
                    {selectedOrder.notes}
                  </p>
                ) : (
                  <p className="text-xs text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar'
                      ? 'لم يضف العميل أي ملاحظات إضافية على هذا الطلب.'
                      : 'No additional notes were provided by the customer.'}
                  </p>
                )}
              </div>

              {/* Staff Follow-up Notes with Customer */}
              <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                    <MessageSquarePlus className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'ملاحظات الموظف مع العميل'
                        : 'Staff Follow-up Notes with Customer'}
                    </span>
                  </p>
                  <span className="text-[11px] font-medium tabular-nums text-[#525866] dark:text-[#9CA3AF]">
                    {(selectedOrder.staffNotesList ?? []).length}
                  </span>
                </div>

                {staffProfile?.canUpdateOrderStatus && (
                  <form onSubmit={(e) => void handleAddStaffNote(e)} className="space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(lang === 'ar'
                        ? [
                            'تم التواصل مع العميل وتأكيد الطلب',
                            'العميل لم يرد — جاري إعادة المحاولة',
                            'تم الاتفاق على التوصيل غداً',
                            'العميل طلب تعديل ميعاد الاستلام',
                          ]
                        : [
                            'Called customer & confirmed order',
                            'No answer — will follow up later',
                            'Scheduled delivery for tomorrow',
                            'Customer requested time change',
                          ]
                      ).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setNewStaffNote(preset)}
                          className="rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-[#F8F8FA] dark:bg-[#0B0D11] px-2.5 py-1 text-[11px] font-medium text-[#525866] hover:border-[#1D4ED8] hover:text-[#1D4ED8] dark:text-[#D1D5DB] dark:hover:text-[#60A5FA] transition-colors cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={newStaffNote}
                      onChange={(e) => setNewStaffNote(e.target.value)}
                      placeholder={
                        lang === 'ar'
                          ? 'سجل تفاصيل المكالمة أو الاتفاق مع العميل (مثلاً: ميعاد مناسب للاستلام، علامة مميزة)...'
                          : 'Record call outcome or agreement with customer (e.g. preferred delivery time)...'
                      }
                      className="w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#0B0D11] p-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/70 focus:border-[#1D4ED8] focus:outline-none resize-y"
                    />

                    {staffNoteError && (
                      <p className="text-xs text-red-600 dark:text-red-400">{staffNoteError}</p>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingStaffNote || !newStaffNote.trim()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {savingStaffNote ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{lang === 'ar' ? 'تسجيل الملاحظة' : 'Save Staff Note'}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Saved Staff Notes Timeline */}
                {(selectedOrder.staffNotesList ?? []).length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {(selectedOrder.staffNotesList ?? []).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                              {entry.staffName || entry.staffEmail.split('@')[0]}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{formatDate(entry.createdAt)}</span>
                          </div>
                          {staffProfile?.canUpdateOrderStatus && (
                            <button
                              type="button"
                              disabled={deletingNoteId === entry.id}
                              onClick={() =>
                                void handleDeleteStaffNote(selectedOrder.orderRef, entry.id)
                              }
                              aria-label={lang === 'ar' ? 'حذف الملاحظة' : 'Delete note'}
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-[#525866] hover:text-red-600 dark:text-[#9CA3AF] dark:hover:text-red-400 disabled:opacity-40 cursor-pointer"
                            >
                              {deletingNoteId === entry.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm leading-relaxed text-[#0F1115] dark:text-[#F4F5F7] whitespace-pre-wrap">
                          {entry.note}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar'
                      ? 'لا توجد ملاحظات مسجلة من الموظفين لهذا العميل حتى الآن.'
                      : 'No staff follow-up notes recorded for this order yet.'}
                  </p>
                )}
              </div>

              {/* Items & Totals */}
              <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] p-4 space-y-3">
                <p className="text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                  {lang === 'ar' ? 'القطع المطلوبة والحساب' : 'Ordered Pieces & Payment'}
                </p>

                <div className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <div>
                        <p className="font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
                          {lang === 'ar' ? 'المقاس' : 'Size'}: {item.size} · SKU: {item.sku}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                        ×{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.08] dark:border-white/[0.08] pt-3 text-sm">
                  <span className="text-xs text-[#525866] dark:text-[#9CA3AF]">
                    {selectedOrder.paymentMethod === 'card'
                      ? lang === 'ar'
                        ? 'طريقة الدفع: كارت / ميزة'
                        : 'Payment: Card / Meeza'
                      : lang === 'ar'
                      ? 'طريقة الدفع: دفع عند الاستلام'
                      : 'Payment: Cash on Delivery'}
                  </span>
                  <span className="font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7]">
                    {lang === 'ar' ? 'الإجمالي: ' : 'Total: '}
                    {selectedOrder.totalAmount.toLocaleString('en-US')}{' '}
                    {lang === 'ar' && selectedOrder.currency === 'EGP'
                      ? 'ج.م'
                      : selectedOrder.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Product Modal */}
      {(editingProduct || isCreatingProduct) && staffProfile?.canManageProducts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={closeProductModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-product-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#13161C] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-[#13161C]/95 backdrop-blur-md px-6 py-4">
              <div>
                <p className="font-mono text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                  {isCreatingProduct ? 'NEW SKU' : editingProduct?.sku}
                </p>
                <h2
                  id="staff-product-modal-title"
                  className="mt-0.5 font-editorial text-xl font-semibold text-[#0F1115] dark:text-[#F4F5F7]"
                >
                  {isCreatingProduct
                    ? lang === 'ar'
                      ? 'إضافة برودكت جديد للمتجر'
                      : 'Add New Product'
                    : lang === 'ar'
                    ? 'تعديل بيانات وسعر ومخزون البرودكت'
                    : 'Edit Product Price, Stock & Media'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeProductModal}
                aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.1] dark:border-white/[0.12] text-[#525866] hover:text-[#0F1115] dark:text-[#9CA3AF] dark:hover:text-[#F4F5F7] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveProductModal(e)} className="p-6 space-y-5">
              {/* Image Preview + Upload / URL */}
              <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] p-4 space-y-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                  <ImagePlus className="h-4 w-4 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'صورة المنتج المعروضة بالموقع' : 'Product Image'}</span>
                </p>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="h-32 w-24 rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.1] bg-[#EBEDF0] dark:bg-[#1B1F27] shrink-0">
                    {prodImage ? (
                      <img
                        src={prodImage}
                        alt={prodTitleAr || prodTitleEn || 'Preview'}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="flex-1 w-full space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-[#525866] dark:text-[#9CA3AF]">
                        {lang === 'ar' ? 'رابط الصورة (URL أو مسار محلي)' : 'Image URL or Path'}
                      </label>
                      <input
                        type="text"
                        required
                        dir="ltr"
                        value={prodImage}
                        onChange={(e) => setProdImage(e.target.value)}
                        placeholder="https://... or /src/assets/images/..."
                        className="mt-1 h-9 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#13161C] px-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#13161C] px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] cursor-pointer">
                        {uploadingImage ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                        )}
                        <span>
                          {uploadingImage
                            ? lang === 'ar'
                              ? 'جاري رفع الصورة...'
                              : 'Uploading...'
                            : lang === 'ar'
                            ? 'رفع صورة من جهازك'
                            : 'Upload Image File'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingImage}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            void handleImageFileUpload(f);
                            e.target.value = '';
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Display Names */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'اسم البرودكت المعروض (عربي)' : 'Display Title (Arabic)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={prodTitleAr}
                    onChange={(e) => setProdTitleAr(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'اسم البرودكت المعروض (إنجليزي)' : 'Display Title (English)'}
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={prodTitleEn}
                    onChange={(e) => setProdTitleEn(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'الوصف المختصر (عربي)' : 'Subtitle (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={prodSubtitleAr}
                    onChange={(e) => setProdSubtitleAr(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'الوصف المختصر (إنجليزي)' : 'Subtitle (English)'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={prodSubtitleEn}
                    onChange={(e) => setProdSubtitleEn(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              {/* Price, Category & SKU */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'السعر (ج.م)' : 'Price (EGP)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5000000}
                    required
                    dir="ltr"
                    value={prodPriceEgp}
                    onChange={(e) => setProdPriceEgp(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar' ? 'القسم' : 'Category'}
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-[#F8F8FA] dark:bg-[#0B0D11] px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {catalogCategories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {lang === 'ar' ? cat.nameAr : cat.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {isCreatingProduct && (
                  <div>
                    <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                      {lang === 'ar' ? 'كود SKU' : 'Product SKU'}
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={prodSku}
                      onChange={(e) => setProdSku(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs font-mono text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                )}

                <div className={isCreatingProduct ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-medium text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar'
                      ? 'المقاسات المتاحة (مفصولة بفاصلة)'
                      : 'Available Sizes (comma separated)'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={prodSizesText}
                    onChange={(e) => setProdSizesText(e.target.value)}
                    placeholder="XS, S, M, L, XL"
                    className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-3 text-xs text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              {/* Per-Size Inventory Quantities */}
              <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0D11] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                    <Boxes className="h-4 w-4 text-[#1D4ED8] dark:text-[#60A5FA]" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'كمية المخزون لكل مقاس' : 'Stock Quantity per Size'}</span>
                  </p>
                  <span className="text-[11px] font-semibold tabular-nums text-[#525866] dark:text-[#9CA3AF]">
                    {lang === 'ar'
                      ? `إجمالي المخزون: ${modalTotalStock} قطعة`
                      : `Total Stock: ${modalTotalStock} units`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {parsedModalSizes.map((sz) => {
                    const currentVal = prodSizeStock[sz] ?? '0';
                    const isZero = Number(currentVal) <= 0;
                    return (
                      <div
                        key={sz}
                        className={`rounded-lg border p-2.5 bg-white dark:bg-[#13161C] ${
                          isZero
                            ? 'border-red-300/70 dark:border-red-900/50'
                            : 'border-black/[0.1] dark:border-white/[0.12]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <label className="text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                            {sz}
                          </label>
                          {isZero && (
                            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                              {lang === 'ar' ? 'نفذت' : 'Out'}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          required
                          dir="ltr"
                          value={currentVal}
                          onChange={(e) =>
                            setProdSizeStock((prev) => ({
                              ...prev,
                              [sz]: e.target.value,
                            }))
                          }
                          className="h-9 w-full rounded-md border border-black/[0.12] dark:border-white/[0.14] bg-transparent px-2 text-center text-xs font-semibold tabular-nums text-[#0F1115] dark:text-[#F4F5F7] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isCreatingProduct && (
                <label className="flex items-center gap-2 text-xs font-medium text-[#0F1115] dark:text-[#F4F5F7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodActive}
                    onChange={(e) => setProdActive(e.target.checked)}
                    className="h-4 w-4 rounded border-black/25 accent-[#1D4ED8]"
                  />
                  <span>
                    {lang === 'ar'
                      ? 'إظهار هذا المنتج للعملاء على الصفحة الرئيسية للمتجر'
                      : 'Show this product on the public storefront'}
                  </span>
                </label>
              )}

              {productModalError && (
                <div className="rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
                  {productModalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-black/[0.08] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-black/[0.12] dark:border-white/[0.14] px-4 text-xs font-semibold text-[#525866] dark:text-[#9CA3AF] cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || uploadingImage}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {savingProduct && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>
                    {isCreatingProduct
                      ? lang === 'ar'
                        ? 'إضافة المنتج'
                        : 'Create Product'
                      : lang === 'ar'
                      ? 'حفظ التعديلات على الموقع'
                      : 'Save Changes'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
