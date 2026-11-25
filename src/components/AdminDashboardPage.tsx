import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  BarChart3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
} from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { AdminLoginPage } from './AdminLoginPage.tsx';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { formatPkr, formatTimestamp } from '../lib/format.ts';
import { tryParseJson } from '../lib/http.ts';
import {
  ORDER_STATUS_STEPS,
  type Inquiry,
  type OrderStatus,
  type Product,
  type SiteConfig,
  type UserProfile,
} from '../types/immerso.ts';
import { SmartImage } from './SmartImage.tsx';

type AdminTab = 'analytics' | 'products' | 'orders' | 'customers' | 'settings';

interface AdminAuditEntry {
  id: string;
  action: string;
  detail: string;
  actor: string;
  timestamp: string;
}

export function AdminDashboardPage() {
  const {
    isAdmin,
    isFirebaseAdmin,
    adminSession,
    adminAuthReady,
    adminFetch,
    changeAdminPassword,
    logoutAdmin,
    signInWithGoogle,
    products,
    orders,
    updateOrderStatus,
    siteConfig,
    seedFirestoreCatalog,
    notify,
  } = useImmerso();

  const [tab, setTab] = useState<AdminTab>('analytics');
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditEntry[]>([]);
  const [serverVerified, setServerVerified] = useState(false);

  // Admin Password Change State (inside Settings tab)
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  // Order filter
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');

  // Product Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pCategory, setPCategory] = useState('Dresses');
  const [pBrand, setPBrand] = useState('IMMERSO Atelier');
  const [pPrice, setPPrice] = useState(5500);
  const [pOrigPrice, setPOrigPrice] = useState(6900);
  const [pStock, setPStock] = useState(12);
  const [pSizes, setPSizes] = useState('XS, S, M, L');
  const [pColors, setPColors] = useState('Black, Champagne');
  const [pImage, setPImage] = useState('/src/assets/images/product_obsidian_gown_1795173957517.jpg');
  const [pDesc, setPDesc] = useState('');

  // Site Config State
  const [cfg, setCfg] = useState<SiteConfig>(siteConfig);
  useEffect(() => {
    setCfg(siteConfig);
  }, [siteConfig]);

  // Verify server-side admin overview & per-tab section authorization
  useEffect(() => {
    if (!isAdmin) {
      setServerVerified(false);
      setAuditLogs([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const [overviewResp, tabResp] = await Promise.all([
          adminFetch('/api/admin/overview', { method: 'GET' }),
          adminFetch(`/api/admin/${tab}`, { method: 'GET' }),
        ]);
        if (!active) return;
        if (overviewResp.ok && tabResp.ok) {
          const data = await tryParseJson<{
            authorized?: boolean;
            auditLogs?: AdminAuditEntry[];
          }>(overviewResp);
          if (data) {
            setServerVerified(Boolean(data.authorized));
            if (Array.isArray(data.auditLogs)) {
              setAuditLogs(data.auditLogs);
            }
          }
        }
      } catch {
        // adminFetch handles 401 redirect cleanly
      }
    })();
    return () => {
      active = false;
    };
  }, [isAdmin, tab, adminFetch]);

  // Admin-only Firestore listeners (requires linked Firebase admin identity)
  useEffect(() => {
    if (!isAdmin || !isFirebaseAdmin) return;
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setCustomers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => console.warn('Admin users read:', err.message)
    );
    const unsubInq = onSnapshot(
      query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')),
      (snap) => setInquiries(snap.docs.map((d) => ({ ...(d.data() as Omit<Inquiry, 'id'>), id: d.id }))),
      (err) => console.warn('Admin inquiries read:', err.message)
    );
    return () => {
      unsubUsers();
      unsubInq();
    };
  }, [isAdmin, isFirebaseAdmin]);

  const analytics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'Cancelled');
    const revenue = validOrders.reduce((s, o) => s + o.totalPkr, 0);
    const pendingCount = orders.filter((o) => o.status === 'Pending WhatsApp Confirmation').length;
    const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;
    const lowStock = products.filter((p) => p.stock <= 10);
    return { revenue, pendingCount, deliveredCount, lowStock };
  }, [orders, products]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderStatusFilter !== 'All' && o.status !== orderStatusFilter) return false;
      if (q) {
        const hay = `${o.orderId} ${o.customerName} ${o.customerPhone} ${o.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  if (!adminAuthReady) {
    return (
      <section className="max-w-xl mx-auto px-4 sm:px-8 py-24 text-center flex flex-col items-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#B5945B] mb-3" />
        <p className="text-xs uppercase tracking-[0.18em] text-[#70685E]">
          Verifying Admin Access
        </p>
      </section>
    );
  }

  if (!isAdmin) {
    return <AdminLoginPage />;
  }

  const recordServerAudit = async (action: string, detail: string): Promise<boolean> => {
    try {
      const resp = await adminFetch('/api/admin/audit', {
        method: 'POST',
        body: JSON.stringify({ action, detail }),
      });
      if (!resp.ok) {
        notify('Admin session expired or unauthorized. Please sign in again.', 'error');
        return false;
      }
      const data = await tryParseJson<{ auditLogs?: AdminAuditEntry[] }>(resp);
      if (data && Array.isArray(data.auditLogs)) {
        setAuditLogs(data.auditLogs);
      }
      return true;
    } catch {
      notify('Unable to verify admin authorization.', 'error');
      return false;
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingId || `imm-${Date.now()}`;
    const authorized = await recordServerAudit(
      editingId ? 'PRODUCT_UPDATE' : 'PRODUCT_CREATE',
      `${pName.trim()} (${id})`
    );
    if (!authorized) return;

    if (!isFirebaseAdmin) {
      notify('Connect your verified Google Admin account below to write product changes to Firestore.', 'info');
      return;
    }

    const payload = {
      sku: pSku.trim() || `IMM-${Date.now().toString().slice(-4)}`,
      name: pName.trim(),
      description: pDesc.trim() || 'Tailored IMMERSO atelier piece.',
      category: pCategory,
      brand: pBrand.trim() || 'IMMERSO',
      pricePkr: Number(pPrice),
      originalPricePkr: Number(pOrigPrice),
      stock: Math.max(0, Math.round(Number(pStock))),
      images: [pImage.trim() || '/src/assets/images/product_obsidian_gown_1795173957517.jpg'],
      sizes: pSizes.split(',').map((s) => s.trim()).filter(Boolean),
      colors: pColors.split(',').map((s) => s.trim()).filter(Boolean),
      occasion: 'Signature',
      season: 'All Season',
      isFeatured: true,
      isNewArrival: true,
      isBestSeller: false,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), payload);
        notify('Product updated in Firestore.', 'success');
      } else {
        await setDoc(doc(db, 'products', id), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        notify('New product published to IMMERSO catalog.', 'success');
      }
      setEditingId(null);
      setPName('');
      setPSku('');
      setPDesc('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${id}`);
    }
  };

  const handleEditProduct = (p: Product) => {
    setEditingId(p.id);
    setPName(p.name);
    setPSku(p.sku);
    setPCategory(p.category);
    setPBrand(p.brand);
    setPPrice(p.pricePkr);
    setPOrigPrice(p.originalPricePkr || p.pricePkr);
    setPStock(p.stock);
    setPSizes(p.sizes.join(', '));
    setPColors(p.colors.join(', '));
    setPImage(p.images[0] || '');
    setPDesc(p.description);
    setTab('products');
  };

  const handleDeleteProduct = async (id: string) => {
    const authorized = await recordServerAudit('PRODUCT_DELETE', id);
    if (!authorized) return;

    if (!isFirebaseAdmin) {
      notify('Connect your verified Google Admin account to delete items from Firestore.', 'info');
      return;
    }

    try {
      await deleteDoc(doc(db, 'products', id));
      notify('Product removed.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorized = await recordServerAudit('SITE_CONFIG_UPDATE', 'Boutique & subscription settings');
    if (!authorized) return;

    if (!isFirebaseAdmin) {
      notify('Connect your verified Google Admin account to persist website settings.', 'info');
      return;
    }

    try {
      await setDoc(doc(db, 'siteConfig', 'main'), {
        ...cfg,
        defaultDeliveryChargePkr: Number(cfg.defaultDeliveryChargePkr),
        freeShippingThresholdPkr: Number(cfg.freeShippingThresholdPkr),
        freePlanAiLimit: Math.round(Number(cfg.freePlanAiLimit)),
        premiumPlanPricePkr: Number(cfg.premiumPlanPricePkr),
        premiumPlanAiLimit: Math.round(Number(cfg.premiumPlanAiLimit)),
        activeDiscountPercent: Number(cfg.activeDiscountPercent || 0),
        updatedAt: serverTimestamp(),
      });
      notify('Site, Chatbot & Plan settings saved.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'siteConfig/main');
    }
  };

  const handleInquiryStatusChange = async (inqId: string, status: string) => {
    const authorized = await recordServerAudit('INQUIRY_STATUS_UPDATE', `${inqId} -> ${status}`);
    if (!authorized) return;

    if (!isFirebaseAdmin) {
      notify('Connect your verified Google Admin account to update customer inquiries.', 'info');
      return;
    }

    try {
      await updateDoc(doc(db, 'inquiries', inqId), { status });
      notify('Inquiry status updated.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inquiries/${inqId}`);
    }
  };

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E5DDD0]">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#B5945B] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              IMMERSO Control Center
            </span>
            {adminSession.email && (
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-[#F7F3EC] border border-[#E5DDD0] text-[#2A231E]">
                {adminSession.email}
              </span>
            )}
          </div>
          <h1 className="font-editorial text-4xl font-medium">Admin Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => void seedFirestoreCatalog()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F7F3EC] border border-[#E5DDD0] text-xs font-medium rounded-lg hover:bg-[#E5DDD0] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Seed Catalog to Firestore</span>
          </button>
          <button
            onClick={() => void logoutAdmin()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-[#B5945B]" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {!isFirebaseAdmin && (
        <div className="bg-[#F7F3EC] border border-[#B5945B]/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#2A231E]">
              Server Admin Session Active · Link Google Account for Live Firestore Sync
            </p>
            <p className="text-xs text-[#70685E]">
              Connect your verified administrator Google identity ({adminSession.email}) to read customer inquiries and persist live catalog, order, and configuration updates to Firestore.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="px-4 py-2 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] shrink-0 cursor-pointer"
          >
            Connect Google Admin Account
          </button>
        </div>
      )}

      {adminSession.mustChangePassword && (
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <KeyRound className="w-4 h-4 text-[#B5945B] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#2A231E]">
                Initial Password Active — Security Recommendation
              </p>
              <p className="text-xs text-[#70685E]">
                You are currently signed in with the initial bootstrap password. Update your admin password in Settings to secure your account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className="px-4 py-2 bg-[#F7F3EC] border border-[#E5DDD0] text-[#2A231E] text-xs font-semibold rounded-lg hover:bg-[#E5DDD0] shrink-0 cursor-pointer"
          >
            Update Password
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'analytics', label: 'Business Analytics', icon: BarChart3 },
            { id: 'products', label: 'Products & Inventory', icon: ShoppingBag },
            { id: 'orders', label: `Orders (${orders.length})`, icon: Package },
            { id: 'customers', label: 'Customers & Inquiries', icon: Users },
            { id: 'settings', label: 'Website, Chatbot & Plans', icon: Settings },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg cursor-pointer ${
                tab === t.id
                  ? 'bg-[#2A231E] text-[#FDFBF7]'
                  : 'bg-[#F7F3EC] text-[#70685E] hover:text-[#2A231E]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ANALYTICS */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
              <p className="text-xs text-[#70685E]">Total Revenue</p>
              <p className="font-mono-num text-2xl font-semibold mt-1">{formatPkr(analytics.revenue)}</p>
            </div>
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
              <p className="text-xs text-[#70685E]">Total Orders</p>
              <p className="font-mono-num text-2xl font-semibold mt-1">{orders.length}</p>
            </div>
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
              <p className="text-xs text-[#70685E]">Pending WhatsApp Confirmation</p>
              <p className="font-mono-num text-2xl font-semibold text-[#B5945B] mt-1">
                {analytics.pendingCount}
              </p>
            </div>
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
              <p className="text-xs text-[#70685E]">Delivered Orders</p>
              <p className="font-mono-num text-2xl font-semibold mt-1">{analytics.deliveredCount}</p>
            </div>
          </div>

          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6">
            <h2 className="font-editorial text-2xl font-medium mb-4">Inventory & Low Stock Watch</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[540px]">
                <thead className="border-b border-[#E5DDD0] text-[#70685E]">
                  <tr>
                    <th className="py-2.5 pr-4 whitespace-nowrap">SKU</th>
                    <th className="py-2.5 pr-4 whitespace-nowrap">Product</th>
                    <th className="py-2.5 pr-4 whitespace-nowrap">Category</th>
                    <th className="py-2.5 pr-4 whitespace-nowrap">Price</th>
                    <th className="py-2.5 whitespace-nowrap">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DDD0]/60">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-4 font-mono-num whitespace-nowrap">{p.sku}</td>
                      <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                      <td className="py-2.5 pr-4 text-[#70685E] whitespace-nowrap">{p.category}</td>
                      <td className="py-2.5 pr-4 font-mono-num whitespace-nowrap">{formatPkr(p.pricePkr)}</td>
                      <td className="py-2.5 font-mono-num whitespace-nowrap">{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-editorial text-2xl font-medium">Admin Session Security Log</h2>
              <span className="text-[11px] uppercase tracking-[0.14em] text-[#B5945B] font-semibold">
                {serverVerified ? 'Server Verified' : 'Verifying'}
              </span>
            </div>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-[#70685E]">No recent admin security events in this session.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {auditLogs.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono-num font-semibold text-[#2A231E]">{entry.action}</span>
                      {entry.detail && (
                        <span className="text-[#70685E] ml-2">{entry.detail}</span>
                      )}
                    </div>
                    <span className="font-mono-num text-[11px] text-[#70685E]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCTS */}
      {tab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSaveProduct}
            className="lg:col-span-5 bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-3.5 h-fit"
          >
            <h2 className="font-editorial text-2xl font-medium">
              {editingId ? 'Edit Catalog Piece' : 'Add New Product'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">SKU *</label>
                <input
                  type="text"
                  required
                  value={pSku}
                  onChange={(e) => setPSku(e.target.value)}
                  placeholder="IMM-NEW-010"
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Category</label>
                <input
                  type="text"
                  value={pCategory}
                  onChange={(e) => setPCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Brand</label>
                <input
                  type="text"
                  value={pBrand}
                  onChange={(e) => setPBrand(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Price (PKR)</label>
                <input
                  type="number"
                  required
                  value={pPrice}
                  onChange={(e) => setPPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Original PKR</label>
                <input
                  type="number"
                  value={pOrigPrice}
                  onChange={(e) => setPOrigPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Stock</label>
                <input
                  type="number"
                  required
                  value={pStock}
                  onChange={(e) => setPStock(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Sizes (comma sep)</label>
                <input
                  type="text"
                  value={pSizes}
                  onChange={(e) => setPSizes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Colors (comma sep)</label>
                <input
                  type="text"
                  value={pColors}
                  onChange={(e) => setPColors(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#70685E] mb-1">Image URL</label>
              <input
                type="text"
                value={pImage}
                onChange={(e) => setPImage(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs text-[#70685E] mb-1">Description</label>
              <textarea
                rows={3}
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingId ? 'Update Product' : 'Publish Product'}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2.5 border border-[#E5DDD0] text-xs rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-[#E5DDD0] rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-16 rounded-lg overflow-hidden shrink-0 bg-[#F7F3EC]">
                    <SmartImage src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-[#70685E] font-mono-num">
                      {p.sku} · {formatPkr(p.pricePkr)} · Stock: {p.stock}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEditProduct(p)}
                    className="px-3 py-1.5 text-xs border border-[#E5DDD0] rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void handleDeleteProduct(p.id)}
                    aria-label="Delete product"
                    className="p-1.5 text-[#70685E] hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ORDERS */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search Order ID, customer, city..."
              className="px-3.5 py-2 text-xs bg-white border border-[#E5DDD0] rounded-lg w-full sm:w-64"
            />
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value as 'All' | OrderStatus)}
              className="w-full sm:w-auto px-3 py-2 text-xs bg-white border border-[#E5DDD0] rounded-lg"
            >
              <option value="All">All Statuses</option>
              {[...ORDER_STATUS_STEPS, 'Cancelled'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-10 text-center text-sm text-[#70685E]">
              No matching orders found.
            </div>
          ) : (
            filteredOrders.map((ord) => (
              <div key={ord.orderId} className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-mono-num text-xs font-semibold">
                      {ord.orderId} · {formatTimestamp(ord.createdAt)}
                    </p>
                    <p className="text-sm font-semibold mt-0.5">
                      {ord.customerName} ({ord.customerPhone})
                    </p>
                    <p className="text-xs text-[#70685E] break-words">
                      {ord.deliveryAddress}, {ord.city}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono-num text-base font-semibold">
                      {formatPkr(ord.totalPkr)}
                    </span>
                    <select
                      value={ord.status}
                      onChange={(e) => void updateOrderStatus(ord.orderId, e.target.value as OrderStatus)}
                      className="w-full sm:w-auto px-3 py-1.5 text-xs font-medium bg-[#F7F3EC] border border-[#E5DDD0] rounded-lg"
                    >
                      {[...ORDER_STATUS_STEPS, 'Cancelled'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-xs text-[#70685E] pt-2 border-t border-[#E5DDD0]">
                  {ord.items.map((i) => `${i.name} [${i.size}/${i.color}] × ${i.quantity}`).join(' · ')}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: CUSTOMERS & INQUIRIES */}
      {tab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-3">
            <h2 className="font-editorial text-2xl font-medium">Registered Customers ({customers.length})</h2>
            {customers.map((c) => (
              <div key={c.uid} className="p-3 bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl text-xs">
                <p className="font-semibold break-words">{c.displayName} ({c.email})</p>
                <p className="text-[#70685E] mt-0.5">
                  Plan: {c.plan} · Role: {c.role} · City: {c.city || 'Unset'}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-3">
            <h2 className="font-editorial text-2xl font-medium">
              Support Inquiries ({inquiries.length})
            </h2>
            {inquiries.length === 0 ? (
              <p className="text-xs text-[#70685E]">No customer support inquiries yet.</p>
            ) : (
              inquiries.map((inq) => (
                <div key={inq.id} className="p-3.5 bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{inq.subject}</span>
                    <select
                      value={inq.status}
                      onChange={(e) => void handleInquiryStatusChange(inq.id, e.target.value)}
                      className="text-[11px] bg-white border border-[#E5DDD0] rounded px-1.5 py-0.5"
                    >
                      <option value="New">New</option>
                      <option value="Replied">Replied</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                  <p className="text-[#70685E]">{inq.name} · {inq.email}</p>
                  <p className="text-[#2A231E]">{inq.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleSaveConfig}
            className="lg:col-span-7 bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-[#E5DDD0]">
              <MessageSquare className="w-5 h-5 text-[#B5945B]" />
              <h2 className="font-editorial text-2xl font-medium">
                Boutique Content, Chatbot & Subscription Settings
              </h2>
            </div>

            <div>
              <label className="block text-xs text-[#70685E] mb-1">Hero Title</label>
              <input
                type="text"
                value={cfg.heroTitle}
                onChange={(e) => setCfg({ ...cfg, heroTitle: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-[#70685E] mb-1">Hero Subtitle</label>
              <textarea
                rows={2}
                value={cfg.heroSubtitle}
                onChange={(e) => setCfg({ ...cfg, heroSubtitle: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-[#70685E] mb-1">AI Chatbot Welcome Message</label>
              <textarea
                rows={2}
                value={cfg.chatbotWelcome}
                onChange={(e) => setCfg({ ...cfg, chatbotWelcome: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Delivery Fee (PKR)</label>
                <input
                  type="number"
                  value={cfg.defaultDeliveryChargePkr}
                  onChange={(e) => setCfg({ ...cfg, defaultDeliveryChargePkr: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Free Ship Threshold</label>
                <input
                  type="number"
                  value={cfg.freeShippingThresholdPkr}
                  onChange={(e) => setCfg({ ...cfg, freeShippingThresholdPkr: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Promo Code</label>
                <input
                  type="text"
                  value={cfg.activeDiscountCode || ''}
                  onChange={(e) => setCfg({ ...cfg, activeDiscountCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Discount %</label>
                <input
                  type="number"
                  value={cfg.activeDiscountPercent || 0}
                  onChange={(e) => setCfg({ ...cfg, activeDiscountPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Free Plan AI Limit</label>
                <input
                  type="number"
                  value={cfg.freePlanAiLimit}
                  onChange={(e) => setCfg({ ...cfg, freePlanAiLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Premium Price (PKR/mo)</label>
                <input
                  type="number"
                  value={cfg.premiumPlanPricePkr}
                  onChange={(e) => setCfg({ ...cfg, premiumPlanPricePkr: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Premium AI Limit</label>
                <input
                  type="number"
                  value={cfg.premiumPlanAiLimit}
                  onChange={(e) => setCfg({ ...cfg, premiumPlanAiLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
            >
              Save Configuration
            </button>
          </form>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPwError('');
              if (!currentPw || !newPw) {
                setPwError('Please fill in both current and new password fields.');
                return;
              }
              if (newPw !== confirmPw) {
                setPwError('New password and confirmation do not match.');
                return;
              }
              setPwSaving(true);
              try {
                await changeAdminPassword(currentPw, newPw);
                setCurrentPw('');
                setNewPw('');
                setConfirmPw('');
              } catch (err) {
                setPwError(err instanceof Error ? err.message : 'Unable to update password.');
              } finally {
                setPwSaving(false);
              }
            }}
            className="lg:col-span-5 bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-[#E5DDD0]">
              <KeyRound className="w-5 h-5 text-[#B5945B]" />
              <h2 className="font-editorial text-2xl font-medium">Admin Account Security</h2>
            </div>

            {pwError && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs"
              >
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{pwError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs text-[#70685E] mb-1">Current Password</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#70685E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((p) => !p)}
                  aria-label="Toggle current password visibility"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#70685E] hover:text-[#2A231E] cursor-pointer"
                >
                  {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#70685E] mb-1">New Password (8+ chars, letters & number/symbol)</label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[#70685E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((p) => !p)}
                  aria-label="Toggle new password visibility"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#70685E] hover:text-[#2A231E] cursor-pointer"
                >
                  {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#70685E] mb-1">Confirm New Password</label>
              <input
                type={showNewPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={pwSaving}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] disabled:opacity-60 cursor-pointer"
            >
              {pwSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B5945B]" />}
              <span>{pwSaving ? 'Updating Password...' : 'Update Admin Password'}</span>
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
