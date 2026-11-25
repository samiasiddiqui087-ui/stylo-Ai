import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase.ts';
import {
  SEED_INSPIRATIONS,
  SEED_PRODUCTS,
  SEED_SITE_CONFIG,
} from '../data/seedCatalog.ts';
import {
  buildWhatsAppOrderMessage,
  generateOrderId,
  getWhatsAppOrderUrl,
} from '../lib/whatsapp.ts';
import {
  parseJsonResponse,
  toFriendlyNetworkError,
  tryParseJson,
} from '../lib/http.ts';
import type {
  AdminSessionInfo,
  CartItem,
  InspirationLook,
  Order,
  OrderStatus,
  OutfitSchedule,
  PageId,
  Product,
  SavedOutfit,
  SiteConfig,
  TryOnResult,
  UserProfile,
  WardrobeItem,
  WeatherInfo,
} from '../types/immerso.ts';

interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface CheckoutSubmitInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  city: string;
  postalCode?: string;
  notes?: string;
}

interface ImmersoContextValue {
  // Navigation
  currentPage: PageId;
  navigate: (page: PageId) => void;
  selectedProduct: Product | null;
  openProductModal: (product: Product) => void;
  closeProductModal: () => void;
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setCheckoutOpen: (open: boolean) => void;
  isChatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  chatPrefill: string;
  setChatPrefill: (text: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Auth & Profile
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isFirebaseAdmin: boolean;
  adminSession: AdminSessionInfo;
  adminAuthReady: boolean;
  authReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (patch: Partial<UserProfile>) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<AdminSessionInfo>;
  changeAdminPassword: (currentPassword: string, newPassword: string) => Promise<AdminSessionInfo>;
  logoutAdmin: () => Promise<void>;
  adminFetch: (input: string, init?: RequestInit) => Promise<Response>;

  // Catalog & Config
  products: Product[];
  catalogLoading: boolean;
  inspirations: InspirationLook[];
  siteConfig: SiteConfig;
  seedFirestoreCatalog: () => Promise<void>;

  // Cart & Discounts (Shared by Website + Chatbot)
  cart: CartItem[];
  addToCart: (product: Product, size?: string, color?: string, qty?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQty: (cartItemId: string, qty: number) => void;
  updateCartVariant: (cartItemId: string, size: string, color: string) => void;
  clearCart: () => void;
  appliedDiscountCode: string;
  applyDiscountCode: (code: string) => boolean;
  subtotalPkr: number;
  deliveryChargePkr: number;
  discountPkr: number;
  totalPkr: number;

  // Checkout & Orders
  placeWhatsAppOrder: (input: CheckoutSubmitInput) => Promise<{
    orderId: string;
    message: string;
    waUrl: string;
  }>;
  orders: Order[];

  // Private User Features
  wardrobe: WardrobeItem[];
  addWardrobeItem: (item: Omit<WardrobeItem, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  updateWardrobeItem: (id: string, patch: Partial<WardrobeItem>) => Promise<void>;
  deleteWardrobeItem: (id: string) => Promise<void>;

  savedOutfits: SavedOutfit[];
  saveOutfit: (outfit: Omit<SavedOutfit, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  deleteSavedOutfit: (id: string) => Promise<void>;

  schedules: OutfitSchedule[];
  saveSchedule: (schedule: Omit<OutfitSchedule, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  updateSchedule: (id: string, patch: Partial<OutfitSchedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;

  wishlistIds: string[];
  toggleWishlist: (productId: string) => Promise<void>;

  tryOnHistory: TryOnResult[];
  saveTryOnResult: (res: Omit<TryOnResult, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  deleteTryOnResult: (id: string) => Promise<void>;

  // Discovery helpers
  recentlyViewedIds: string[];
  compareIds: string[];
  toggleCompare: (productId: string) => void;

  // Weather
  weather: WeatherInfo | null;
  weatherLoading: boolean;
  fetchWeatherByCity: (city: string) => Promise<void>;
  fetchWeatherByGeolocation: () => Promise<void>;

  // Admin helpers
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;

  // Toast
  toasts: ToastMessage[];
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

const ImmersoContext = createContext<ImmersoContextValue | null>(null);

const GUEST_CART_KEY = 'immerso_guest_cart_v1';
const RECENT_KEY = 'immerso_recent_v1';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function resolveInitialPage(): PageId {
  const params = new URLSearchParams(window.location.search);
  const p = params.get('page');
  if (p) {
    if (p === 'admin-login') return 'admin-login';
    if (p === 'admin' || p.startsWith('admin-') || p.startsWith('admin/')) return 'admin';
    return p as PageId;
  }
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  if (path === '/admin-login' || path.startsWith('/admin-login/')) return 'admin-login';
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
  return 'home';
}

export function ImmersoProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageId>(resolveInitialPage);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isChatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const adminTokenRef = useRef<string | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSessionInfo>({
    authenticated: false,
    email: null,
    mustChangePassword: false,
  });
  const [adminAuthReady, setAdminAuthReady] = useState(false);

  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [firestoreInspirations, setFirestoreInspirations] = useState<InspirationLook[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(SEED_SITE_CONFIG);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(GUEST_CART_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [appliedDiscountCode, setAppliedDiscountCode] = useState('');

  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [schedules, setSchedules] = useState<OutfitSchedule[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tryOnHistory, setTryOnHistory] = useState<TryOnResult[]>([]);

  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const navigate = useCallback((page: PageId, replaceHistory = false) => {
    setCurrentPage(page);
    const url = new URL(window.location.href);
    url.pathname = '/';
    if (page === 'home') {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', page);
    }
    if (replaceHistory) {
      window.history.replaceState({}, '', url.toString());
    } else {
      window.history.pushState({}, '', url.toString());
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setCurrentPage(resolveInitialPage());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openProductModal = useCallback((product: Product) => {
    setSelectedProduct(product);
    setRecentlyViewedIds((prev) => {
      const next = [product.id, ...prev.filter((id) => id !== product.id)].slice(0, 6);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota
      }
      return next;
    });
  }, []);

  const closeProductModal = useCallback(() => setSelectedProduct(null), []);

  // Derived catalog: live Firestore products if present, fallback to curated SEED_PRODUCTS
  const products = useMemo(
    () => (firestoreProducts.length > 0 ? firestoreProducts : SEED_PRODUCTS),
    [firestoreProducts]
  );

  const inspirations = useMemo(
    () => (firestoreInspirations.length > 0 ? firestoreInspirations : SEED_INSPIRATIONS),
    [firestoreInspirations]
  );

  const isAdmin = useMemo(
    () => Boolean(adminSession.authenticated),
    [adminSession.authenticated]
  );

  const isFirebaseAdmin = useMemo(() => {
    if (!user || !isAdmin || !adminSession.email) return false;
    return (
      hasAdminDoc ||
      (user.emailVerified && user.email?.toLowerCase() === adminSession.email.toLowerCase())
    );
  }, [user, isAdmin, adminSession.email, hasAdminDoc]);

  const adminFetch = useCallback(async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('X-Requested-With', 'IMMERSO-Admin');
    if (adminTokenRef.current) {
      headers.set('Authorization', `Bearer ${adminTokenRef.current}`);
    }
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const resp = await fetch(input, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (resp.status === 401 && !input.endsWith('/auth/login') && !input.endsWith('/auth/session')) {
      adminTokenRef.current = null;
      setAdminSession({ authenticated: false, email: null, mustChangePassword: false });
      setCurrentPage('admin-login');
    }
    return resp;
  }, []);

  // Verify existing HttpOnly cookie admin session on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const resp = await fetch('/api/admin/auth/session', {
          method: 'GET',
          credentials: 'include',
          headers: { 'X-Requested-With': 'IMMERSO-Admin' },
        });
        if (!active) return;
        if (resp.ok) {
          const data = await tryParseJson<{
            authenticated?: boolean;
            admin?: { email: string; mustChangePassword: boolean; updatedAt?: string };
          }>(resp);
          if (data?.authenticated && data.admin) {
            setAdminSession({
              authenticated: true,
              email: data.admin.email,
              mustChangePassword: data.admin.mustChangePassword,
              updatedAt: data.admin.updatedAt,
            });
          }
        }
      } catch {
        // remain unauthenticated
      } finally {
        if (active) setAdminAuthReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Automatically protect admin route and redirect unauthorized users to admin-login
  useEffect(() => {
    if (!adminAuthReady) return;
    if (currentPage === 'admin' && !isAdmin) {
      navigate('admin-login', true);
    } else if (currentPage === 'admin-login' && isAdmin) {
      navigate('admin', true);
    }
  }, [adminAuthReady, currentPage, isAdmin, navigate]);

  // Listen to public catalog, inspirations, and siteConfig
  useEffect(() => {
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const list: Product[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<Product, 'id'>),
          id: d.id,
        }));
        setFirestoreProducts(list);
        setCatalogLoaded(true);
      },
      () => {
        setCatalogLoaded(true);
      }
    );

    const unsubInspirations = onSnapshot(
      collection(db, 'inspirations'),
      (snap) => {
        const list: InspirationLook[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<InspirationLook, 'id'>),
          id: d.id,
        }));
        setFirestoreInspirations(list);
      },
      () => {
        // fallback to SEED_INSPIRATIONS
      }
    );

    const unsubConfig = onSnapshot(
      doc(db, 'siteConfig', 'main'),
      (snap) => {
        if (snap.exists()) {
          setSiteConfig({ ...SEED_SITE_CONFIG, ...(snap.data() as SiteConfig) });
        }
      },
      () => {
        // fallback to SEED_SITE_CONFIG
      }
    );

    return () => {
      unsubProducts();
      unsubInspirations();
      unsubConfig();
    };
  }, []);

  // Auth listener & User profile creation/sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserProfile(null);
        setHasAdminDoc(false);
        setWardrobe([]);
        setSavedOutfits([]);
        setSchedules([]);
        setWishlistIds([]);
        setOrders([]);
        setTryOnHistory([]);
        setAuthReady(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        setHasAdminDoc(adminSnap.exists());

        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const initialProfile: Record<string, unknown> = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'IMMERSO Member',
            email: firebaseUser.email || '',
            photoUrl: firebaseUser.photoURL || '',
            role: 'customer',
            plan: 'free',
            aiRequestsUsed: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, initialProfile);
        }
      } catch (error) {
        console.warn('Profile bootstrap warning:', error);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Authenticated private listeners
  useEffect(() => {
    if (!authReady || !user) return;
    const uid = user.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (err) => console.warn('Profile snapshot:', err.message)
    );

    const unsubWardrobe = onSnapshot(
      query(collection(db, 'users', uid, 'wardrobe'), orderBy('createdAt', 'desc')),
      (snap) => {
        setWardrobe(snap.docs.map((d) => ({ ...(d.data() as Omit<WardrobeItem, 'id'>), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/wardrobe`)
    );

    const unsubOutfits = onSnapshot(
      query(collection(db, 'users', uid, 'savedOutfits'), orderBy('createdAt', 'desc')),
      (snap) => {
        setSavedOutfits(snap.docs.map((d) => ({ ...(d.data() as Omit<SavedOutfit, 'id'>), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/savedOutfits`)
    );

    const unsubSchedules = onSnapshot(
      query(collection(db, 'users', uid, 'schedules'), orderBy('date', 'asc')),
      (snap) => {
        setSchedules(snap.docs.map((d) => ({ ...(d.data() as Omit<OutfitSchedule, 'id'>), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/schedules`)
    );

    const unsubWishlist = onSnapshot(
      collection(db, 'users', uid, 'wishlist'),
      (snap) => {
        setWishlistIds(snap.docs.map((d) => (d.data() as { productId: string }).productId));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/wishlist`)
    );

    const unsubCart = onSnapshot(
      collection(db, 'users', uid, 'cart'),
      (snap) => {
        if (!snap.empty) {
          const synced = snap.docs.map((d) => ({ ...(d.data() as Omit<CartItem, 'id'>), id: d.id }));
          setCart(synced);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/cart`)
    );

    const unsubTryOn = onSnapshot(
      query(collection(db, 'users', uid, 'tryOnHistory'), orderBy('createdAt', 'desc')),
      (snap) => {
        setTryOnHistory(snap.docs.map((d) => ({ ...(d.data() as Omit<TryOnResult, 'id'>), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/tryOnHistory`)
    );

    const ordersQuery = isFirebaseAdmin
      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'orders'), where('userId', '==', uid));

    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        setOrders(snap.docs.map((d) => d.data() as Order));
      },
      (err) => console.warn('Orders snapshot:', err.message)
    );

    return () => {
      unsubProfile();
      unsubWardrobe();
      unsubOutfits();
      unsubSchedules();
      unsubWishlist();
      unsubCart();
      unsubTryOn();
      unsubOrders();
    };
  }, [authReady, user, isFirebaseAdmin]);

  // Seed Firestore catalog automatically if authenticated Firebase Admin signs in and Firestore is empty
  const seedFirestoreCatalog = useCallback(async () => {
    if (!isAdmin) {
      notify('Admin session required.', 'error');
      return;
    }
    const auditResp = await adminFetch('/api/admin/audit', {
      method: 'POST',
      body: JSON.stringify({ action: 'CATALOG_SEED', detail: 'Syncing seed catalog to Firestore' }),
    });
    if (!auditResp.ok) {
      notify('Unauthorized server session.', 'error');
      return;
    }
    if (!isFirebaseAdmin) {
      notify('Connect your verified Google Admin account in the header to write to Firestore.', 'info');
      return;
    }
    try {
      const batch = writeBatch(db);
      for (const p of SEED_PRODUCTS) {
        const { id, ...rest } = p;
        batch.set(doc(db, 'products', id), {
          ...rest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const look of SEED_INSPIRATIONS) {
        const { id, ...rest } = look;
        batch.set(doc(db, 'inspirations', id), {
          ...rest,
          createdAt: serverTimestamp(),
        });
      }
      batch.set(doc(db, 'siteConfig', 'main'), {
        ...SEED_SITE_CONFIG,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      notify('IMMERSO catalog synced to Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  }, [isAdmin, isFirebaseAdmin, adminFetch, notify]);

  useEffect(() => {
    if (catalogLoaded && firestoreProducts.length === 0 && isFirebaseAdmin) {
      void seedFirestoreCatalog();
    }
  }, [catalogLoaded, firestoreProducts.length, isFirebaseAdmin, seedFirestoreCatalog]);

  // Persist guest cart in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Weather fetcher
  const fetchWeatherByCity = useCallback(async (city: string) => {
    setWeatherLoading(true);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      if (res.ok) {
        const data = await tryParseJson<WeatherInfo>(res);
        if (data) setWeather(data);
      }
    } catch {
      // silent fail
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const fetchWeatherByGeolocation = useCallback(async () => {
    if (!navigator.geolocation) {
      notify('Geolocation is not supported in this browser.', 'error');
      return;
    }
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          if (res.ok) {
            const data = await tryParseJson<WeatherInfo>(res);
            if (data) setWeather(data);
          }
        } catch {
          // silent fail
        } finally {
          setWeatherLoading(false);
        }
      },
      () => {
        setWeatherLoading(false);
        notify('Location permission declined. Showing city forecast instead.', 'info');
      }
    );
  }, [notify]);

  useEffect(() => {
    void fetchWeatherByCity('Karachi');
  }, [fetchWeatherByCity]);

  // Auth Actions
  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      notify('Welcome to IMMERSO.', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sign-in cancelled.';
      notify(msg, 'error');
    }
  }, [notify]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    notify('Signed out of IMMERSO.', 'info');
  }, [notify]);

  const loginAdmin = useCallback(
    async (email: string, password: string): Promise<AdminSessionInfo> => {
      try {
        const resp = await fetch('/api/admin/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'IMMERSO-Admin',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await parseJsonResponse<{
          authenticated?: boolean;
          token?: string;
          admin?: { email: string; mustChangePassword: boolean; updatedAt?: string };
          error?: string;
        }>(resp, 'Unable to sign in to Admin Portal.');

        if (!resp.ok || !data.authenticated || !data.admin) {
          throw new Error(data.error || 'Invalid email or password. Access Denied.');
        }

        adminTokenRef.current = data.token || null;
        const nextSession: AdminSessionInfo = {
          authenticated: true,
          email: data.admin.email,
          mustChangePassword: data.admin.mustChangePassword,
          updatedAt: data.admin.updatedAt,
        };
        setAdminSession(nextSession);

        notify('Admin session verified. Welcome to IMMERSO Control Center.', 'success');
        navigate('admin', true);
        return nextSession;
      } catch (err) {
        throw new Error(toFriendlyNetworkError(err, 'Invalid email or password. Access Denied.'));
      }
    },
    [navigate, notify]
  );

  const changeAdminPassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AdminSessionInfo> => {
      try {
        const resp = await adminFetch('/api/admin/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data = await parseJsonResponse<{
          authenticated?: boolean;
          token?: string;
          admin?: { email: string; mustChangePassword: boolean; updatedAt?: string };
          error?: string;
        }>(resp, 'Unable to update admin password.');

        if (!resp.ok || !data.authenticated || !data.admin) {
          throw new Error(data.error || 'Unable to update admin password.');
        }

        adminTokenRef.current = data.token || null;
        const nextSession: AdminSessionInfo = {
          authenticated: true,
        email: data.admin.email,
        mustChangePassword: false,
        updatedAt: data.admin.updatedAt,
      };
      setAdminSession(nextSession);
      notify('Admin password updated securely.', 'success');
      return nextSession;
      } catch (err) {
        throw new Error(toFriendlyNetworkError(err, 'Unable to update admin password.'));
      }
    },
    [adminFetch, notify]
  );

  const logoutAdmin = useCallback(async () => {
    try {
      await adminFetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      // ignore network failure while clearing local state
    }
    adminTokenRef.current = null;
    setAdminSession({ authenticated: false, email: null, mustChangePassword: false });
    notify('Logged out of Admin Console.', 'info');
    navigate('admin-login', true);
  }, [adminFetch, navigate, notify]);

  const updateUserProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) return;
      try {
        const allowed: Record<string, unknown> = { updatedAt: serverTimestamp() };
        const keys: Array<keyof UserProfile> = [
          'displayName',
          'photoUrl',
          'phone',
          'city',
          'address',
          'preferredColors',
          'preferredStyle',
          'preferredSize',
          'aiRequestsUsed',
        ];
        for (const k of keys) {
          if (patch[k] !== undefined) allowed[k] = patch[k];
        }
        await updateDoc(doc(db, 'users', user.uid), allowed);
        notify('Profile updated.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [user, notify]
  );

  // Cart Actions (synchronized between main storefront + AI chatbot + Firestore)
  const syncCartItemToFirestore = useCallback(
    async (item: CartItem) => {
      if (!user) return;
      try {
        await setDoc(doc(db, 'users', user.uid, 'cart', item.id), {
          userId: user.uid,
          productId: item.productId,
          name: item.name,
          pricePkr: item.pricePkr,
          image: item.image,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Cart sync warning:', err);
      }
    },
    [user]
  );

  const addToCart = useCallback(
    (product: Product, size?: string, color?: string, qty = 1) => {
      if (product.stock <= 0) {
        notify(`${product.name} is currently out of stock.`, 'error');
        return;
      }
      const chosenSize = size || product.sizes[0] || 'One Size';
      const chosenColor = color || product.colors[0] || 'Default';
      const cartItemId = sanitizeId(`${product.id}__${chosenSize}__${chosenColor}`);

      setCart((prev) => {
        const existing = prev.find((c) => c.id === cartItemId);
        const nextQty = Math.min(product.stock, (existing?.quantity || 0) + qty);
        const nextItem: CartItem = {
          id: cartItemId,
          productId: product.id,
          name: product.name,
          pricePkr: product.pricePkr,
          image: product.images[0] || '',
          size: chosenSize,
          color: chosenColor,
          quantity: nextQty,
        };
        void syncCartItemToFirestore(nextItem);
        if (existing) {
          return prev.map((c) => (c.id === cartItemId ? nextItem : c));
        }
        return [...prev, nextItem];
      });
      notify(`Added ${product.name} (${chosenSize}, ${chosenColor}) to bag.`, 'success');
    },
    [notify, syncCartItemToFirestore]
  );

  const removeFromCart = useCallback(
    (cartItemId: string) => {
      setCart((prev) => prev.filter((c) => c.id !== cartItemId));
      if (user) {
        void deleteDoc(doc(db, 'users', user.uid, 'cart', cartItemId));
      }
    },
    [user]
  );

  const updateCartQty = useCallback(
    (cartItemId: string, qty: number) => {
      if (qty <= 0) {
        removeFromCart(cartItemId);
        return;
      }
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== cartItemId) return item;
          const prod = products.find((p) => p.id === item.productId);
          const maxStock = prod ? prod.stock : 20;
          const nextItem = { ...item, quantity: Math.min(maxStock, qty) };
          void syncCartItemToFirestore(nextItem);
          return nextItem;
        })
      );
    },
    [products, removeFromCart, syncCartItemToFirestore]
  );

  const updateCartVariant = useCallback(
    (cartItemId: string, size: string, color: string) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== cartItemId) return item;
          const nextItem = { ...item, size, color };
          void syncCartItemToFirestore(nextItem);
          return nextItem;
        })
      );
    },
    [syncCartItemToFirestore]
  );

  const clearCart = useCallback(() => {
    setCart((prev) => {
      if (user) {
        prev.forEach((item) => {
          void deleteDoc(doc(db, 'users', user.uid, 'cart', item.id));
        });
      }
      return [];
    });
  }, [user]);

  const applyDiscountCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toUpperCase();
      const active = (siteConfig.activeDiscountCode || '').trim().toUpperCase();
      if (normalized && active && normalized === active) {
        setAppliedDiscountCode(normalized);
        notify(`Code ${normalized} applied (${siteConfig.activeDiscountPercent || 10}% off).`, 'success');
        return true;
      }
      notify('Invalid or expired discount code.', 'error');
      return false;
    },
    [siteConfig, notify]
  );

  const subtotalPkr = useMemo(
    () => cart.reduce((sum, item) => sum + item.pricePkr * item.quantity, 0),
    [cart]
  );

  const deliveryChargePkr = useMemo(() => {
    if (cart.length === 0) return 0;
    if (subtotalPkr >= siteConfig.freeShippingThresholdPkr) return 0;
    return siteConfig.defaultDeliveryChargePkr;
  }, [cart.length, subtotalPkr, siteConfig]);

  const discountPkr = useMemo(() => {
    if (!appliedDiscountCode || !siteConfig.activeDiscountPercent) return 0;
    return Math.round((subtotalPkr * siteConfig.activeDiscountPercent) / 100);
  }, [appliedDiscountCode, siteConfig.activeDiscountPercent, subtotalPkr]);

  const totalPkr = useMemo(
    () => Math.max(0, subtotalPkr + deliveryChargePkr - discountPkr),
    [subtotalPkr, deliveryChargePkr, discountPkr]
  );

  // Place Order via Direct WhatsApp (+923112537554)
  const placeWhatsAppOrder = useCallback(
    async (input: CheckoutSubmitInput) => {
      if (cart.length === 0) {
        throw new Error('Your shopping bag is empty.');
      }

      // Stock validation
      for (const item of cart) {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod || prod.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.name}. Available: ${prod?.stock ?? 0}`);
        }
      }

      const orderId = generateOrderId();
      const orderItems = cart.map((c) => {
        const prod = products.find((p) => p.id === c.productId);
        return {
          productId: c.productId,
          sku: prod?.sku || 'IMM-SKU',
          name: c.name,
          image: c.image,
          size: c.size,
          color: c.color,
          quantity: c.quantity,
          pricePkr: c.pricePkr,
        };
      });

      const message = buildWhatsAppOrderMessage({
        orderId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryAddress: input.deliveryAddress,
        city: input.city,
        postalCode: input.postalCode,
        items: orderItems,
        subtotalPkr,
        deliveryChargePkr,
        discountPkr,
        totalPkr,
        notes: input.notes,
      });

      const waUrl = getWhatsAppOrderUrl(message);
      const cleanDigits = input.customerPhone.replace(/\D/g, '');
      const phoneLast4 = cleanDigits.slice(-4).padStart(4, '0');
      const itemSummary = orderItems.map((i) => `${i.name} (${i.size}) x${i.quantity}`).join(', ').slice(0, 480);

      const batch = writeBatch(db);
      const orderDoc: Record<string, unknown> = {
        orderId,
        userId: user?.emailVerified ? user.uid : null,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        deliveryAddress: input.deliveryAddress.trim(),
        city: input.city.trim(),
        items: orderItems,
        subtotalPkr,
        deliveryChargePkr,
        discountPkr,
        totalPkr,
        status: 'Pending WhatsApp Confirmation',
        whatsappMessage: message.slice(0, 3900),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.customerEmail?.trim()) orderDoc.customerEmail = input.customerEmail.trim();
      if (input.postalCode?.trim()) orderDoc.postalCode = input.postalCode.trim();
      if (input.notes?.trim()) orderDoc.notes = input.notes.trim();
      if (appliedDiscountCode) orderDoc.discountCode = appliedDiscountCode;

      batch.set(doc(db, 'orders', orderId), orderDoc);
      batch.set(doc(db, 'orderTracking', orderId), {
        orderId,
        phoneLast4,
        city: input.city.trim(),
        itemCount: orderItems.reduce((s, i) => s + i.quantity, 0),
        itemSummary,
        totalPkr,
        status: 'Pending WhatsApp Confirmation',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
      }

      // Optional Meta WhatsApp Cloud API notification
      void fetch('/api/whatsapp/notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          totalPkr,
          itemsSummary: itemSummary,
        }),
      }).catch(() => {});

      clearCart();
      return { orderId, message, waUrl };
    },
    [
      cart,
      products,
      subtotalPkr,
      deliveryChargePkr,
      discountPkr,
      totalPkr,
      user,
      appliedDiscountCode,
      clearCart,
    ]
  );

  // Wardrobe CRUD
  const addWardrobeItem = useCallback(
    async (item: Omit<WardrobeItem, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) {
        notify('Please sign in to save items to your private wardrobe.', 'info');
        return;
      }
      const id = `ward_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        const payload: Record<string, unknown> = {
          userId: user.uid,
          name: item.name.trim(),
          category: item.category,
          color: item.color.trim(),
          season: item.season.trim(),
          size: item.size.trim(),
          isFavorite: Boolean(item.isFavorite),
          createdAt: serverTimestamp(),
        };
        if (item.brand?.trim()) payload.brand = item.brand.trim();
        if (item.collectionName?.trim()) payload.collectionName = item.collectionName.trim();
        if (item.imageUrl) payload.imageUrl = item.imageUrl;
        if (item.notes?.trim()) payload.notes = item.notes.trim();

        await setDoc(doc(db, 'users', user.uid, 'wardrobe', id), payload);
        notify('Added to your virtual wardrobe.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/wardrobe/${id}`);
      }
    },
    [user, notify]
  );

  const updateWardrobeItem = useCallback(
    async (id: string, patch: Partial<WardrobeItem>) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'wardrobe', id), patch as Record<string, unknown>);
        notify('Wardrobe item updated.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/wardrobe/${id}`);
      }
    },
    [user, notify]
  );

  const deleteWardrobeItem = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'wardrobe', id));
        notify('Removed from wardrobe.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/wardrobe/${id}`);
      }
    },
    [user, notify]
  );

  // Saved Outfits CRUD
  const saveOutfit = useCallback(
    async (outfit: Omit<SavedOutfit, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) {
        notify('Please sign in to save outfits.', 'info');
        return;
      }
      const id = `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'savedOutfits', id), {
          ...outfit,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        notify('Outfit saved to your lookbook.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/savedOutfits/${id}`);
      }
    },
    [user, notify]
  );

  const deleteSavedOutfit = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'savedOutfits', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/savedOutfits/${id}`);
      }
    },
    [user]
  );

  // Schedules CRUD
  const saveSchedule = useCallback(
    async (schedule: Omit<OutfitSchedule, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) {
        notify('Please sign in to schedule outfits on your calendar.', 'info');
        return;
      }
      const id = `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'schedules', id), {
          ...schedule,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        notify('Outfit scheduled.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/schedules/${id}`);
      }
    },
    [user, notify]
  );

  const updateSchedule = useCallback(
    async (id: string, patch: Partial<OutfitSchedule>) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'schedules', id), patch as Record<string, unknown>);
        notify('Schedule updated.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/schedules/${id}`);
      }
    },
    [user, notify]
  );

  const deleteSchedule = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'schedules', id));
        notify('Schedule removed.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/schedules/${id}`);
      }
    },
    [user, notify]
  );

  // Wishlist
  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!user) {
        setWishlistIds((prev) =>
          prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
        );
        return;
      }
      const docId = sanitizeId(productId);
      const ref = doc(db, 'users', user.uid, 'wishlist', docId);
      try {
        if (wishlistIds.includes(productId)) {
          await deleteDoc(ref);
          notify('Removed from wishlist.', 'info');
        } else {
          await setDoc(ref, {
            userId: user.uid,
            productId,
            createdAt: serverTimestamp(),
          });
          notify('Saved to wishlist.', 'success');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/wishlist/${docId}`);
      }
    },
    [user, wishlistIds, notify]
  );

  // Try-On History
  const saveTryOnResult = useCallback(
    async (res: Omit<TryOnResult, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) return;
      const id = `try_${Date.now()}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'tryOnHistory', id), {
          ...res,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        notify('Virtual try-on look saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/tryOnHistory/${id}`);
      }
    },
    [user, notify]
  );

  const deleteTryOnResult = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'tryOnHistory', id));
        notify('Preview deleted permanently.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/tryOnHistory/${id}`);
      }
    },
    [user, notify]
  );

  const toggleCompare = useCallback((productId: string) => {
    setCompareIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : prev.length >= 3
        ? [...prev.slice(1), productId]
        : [...prev, productId]
    );
  }, []);

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (!isAdmin) return;
      const auditResp = await adminFetch('/api/admin/audit', {
        method: 'POST',
        body: JSON.stringify({ action: 'ORDER_STATUS_UPDATE', detail: `${orderId} -> ${status}` }),
      });
      if (!auditResp.ok) {
        notify('Unauthorized admin action.', 'error');
        return;
      }
      if (!isFirebaseAdmin) {
        notify('Connect verified Google Admin identity to persist Firestore order updates.', 'info');
        return;
      }
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'orders', orderId), {
          status,
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'orderTracking', orderId), {
          status,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        notify(`Order ${orderId} marked as ${status}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [isAdmin, isFirebaseAdmin, adminFetch, notify]
  );

  const value: ImmersoContextValue = {
    currentPage,
    navigate,
    selectedProduct,
    openProductModal,
    closeProductModal,
    isCartOpen,
    setCartOpen,
    isCheckoutOpen,
    setCheckoutOpen,
    isChatOpen,
    setChatOpen,
    chatPrefill,
    setChatPrefill,
    searchQuery,
    setSearchQuery,
    user,
    userProfile,
    isAdmin,
    isFirebaseAdmin,
    adminSession,
    adminAuthReady,
    authReady,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    loginAdmin,
    changeAdminPassword,
    logoutAdmin,
    adminFetch,
    products,
    catalogLoading: !catalogLoaded,
    inspirations,
    siteConfig,
    seedFirestoreCatalog,
    cart,
    addToCart,
    removeFromCart,
    updateCartQty,
    updateCartVariant,
    clearCart,
    appliedDiscountCode,
    applyDiscountCode,
    subtotalPkr,
    deliveryChargePkr,
    discountPkr,
    totalPkr,
    placeWhatsAppOrder,
    orders,
    wardrobe,
    addWardrobeItem,
    updateWardrobeItem,
    deleteWardrobeItem,
    savedOutfits,
    saveOutfit,
    deleteSavedOutfit,
    schedules,
    saveSchedule,
    updateSchedule,
    deleteSchedule,
    wishlistIds,
    toggleWishlist,
    tryOnHistory,
    saveTryOnResult,
    deleteTryOnResult,
    recentlyViewedIds,
    compareIds,
    toggleCompare,
    weather,
    weatherLoading,
    fetchWeatherByCity,
    fetchWeatherByGeolocation,
    updateOrderStatus,
    toasts,
    notify,
  };

  return <ImmersoContext.Provider value={value}>{children}</ImmersoContext.Provider>;
}

export function useImmerso() {
  const ctx = useContext(ImmersoContext);
  if (!ctx) throw new Error('useImmerso must be used inside ImmersoProvider');
  return ctx;
}
