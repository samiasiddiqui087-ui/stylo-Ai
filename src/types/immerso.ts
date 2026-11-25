export type PageId =
  | 'home'
  | 'shop'
  | 'collections'
  | 'ai-stylist'
  | 'wardrobe'
  | 'planner'
  | 'outfit-generator'
  | 'virtual-tryon'
  | 'inspiration'
  | 'order-tracking'
  | 'dashboard'
  | 'admin'
  | 'admin-login'
  | 'subscriptions'
  | 'about'
  | 'contact'
  | 'faq'
  | 'privacy'
  | 'terms'
  | 'shipping'
  | 'returns';

export type OrderStatus =
  | 'Pending WhatsApp Confirmation'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export const ORDER_STATUS_STEPS: OrderStatus[] = [
  'Pending WhatsApp Confirmation',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export type WardrobeCategory =
  | 'Tops'
  | 'Bottoms'
  | 'Dresses'
  | 'Outerwear'
  | 'Shoes'
  | 'Bags'
  | 'Accessories'
  | 'Jewellery';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  pricePkr: number;
  originalPricePkr?: number;
  stock: number;
  images: string[];
  sizes: string[];
  colors: string[];
  occasion?: string;
  season?: string;
  details?: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CartItem {
  id: string; // productId__size__color
  productId: string;
  name: string;
  pricePkr: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  pricePkr: number;
}

export interface Order {
  orderId: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  city: string;
  postalCode?: string;
  notes?: string;
  discountCode?: string;
  items: OrderItem[];
  subtotalPkr: number;
  deliveryChargePkr: number;
  discountPkr: number;
  totalPkr: number;
  status: OrderStatus;
  whatsappMessage?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderTrackingRecord {
  orderId: string;
  phoneLast4: string;
  city: string;
  itemCount: number;
  itemSummary: string;
  totalPkr: number;
  status: OrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: WardrobeCategory;
  brand?: string;
  color: string;
  season: string;
  size: string;
  collectionName?: string;
  imageUrl?: string;
  isFavorite: boolean;
  notes?: string;
  createdAt?: unknown;
}

export interface SavedOutfit {
  id: string;
  userId: string;
  title: string;
  occasion: string;
  season?: string;
  aesthetic?: string;
  stylingExplanation: string;
  colorPalette?: string[];
  productIds: string[];
  totalEstimatedPkr: number;
  createdAt?: unknown;
}

export interface OutfitSchedule {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  occasion: string;
  accessoriesNote?: string;
  weatherNote?: string;
  productIds: string[];
  reminderEnabled: boolean;
  createdAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  phone?: string;
  city?: string;
  address?: string;
  preferredColors?: string[];
  preferredStyle?: string;
  preferredSize?: string;
  role: 'customer' | 'admin';
  plan: 'free' | 'premium';
  aiRequestsUsed: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SiteConfig {
  heroTitle: string;
  heroSubtitle: string;
  chatbotWelcome: string;
  defaultDeliveryChargePkr: number;
  freeShippingThresholdPkr: number;
  freePlanAiLimit: number;
  premiumPlanPricePkr: number;
  premiumPlanAiLimit: number;
  activeDiscountCode?: string;
  activeDiscountPercent?: number;
  updatedAt?: unknown;
}

export interface InspirationLook {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  stylingNote: string;
  productIds: string[];
  createdAt?: unknown;
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'New' | 'Replied' | 'Resolved';
  createdAt?: unknown;
}

export interface WeatherInfo {
  city: string;
  temperatureC: number;
  condition: string;
  isRainy: boolean;
  humidity?: number;
  windKmh?: number;
  stylingTip: string;
  dailyForecast: Array<{
    date: string;
    maxC: number;
    minC: number;
    condition: string;
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products?: Product[];
  timestamp: string;
}

export interface TryOnResult {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  previewDataUrl: string;
  disclaimer: string;
  createdAt?: unknown;
}

export type RobotState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface TrendingLookItem {
  trendTitle: string;
  trendSummary: string;
  palette: string[];
  stylingCue: string;
  matchedProducts: Product[];
}

export interface TrendingAnalysisResult {
  seasonHeadline: string;
  analyzedAt: string;
  trends: TrendingLookItem[];
  sources: Array<{ title: string; uri: string }>;
}

export interface AdminSessionInfo {
  authenticated: boolean;
  email: string | null;
  mustChangePassword: boolean;
  updatedAt?: string;
}

