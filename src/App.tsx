import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ImmersoProvider, useImmerso } from './context/ImmersoContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { ShopSection } from './components/ShopSection.tsx';
import { StyleInspirationPage } from './components/StyleInspirationPage.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { CheckoutModal } from './components/CheckoutModal.tsx';
import { FloatingChatbot } from './components/FloatingChatbot.tsx';
import { Footer } from './components/Footer.tsx';

const AiStylistPage = lazy(() =>
  import('./components/AiStylistPage.tsx').then((m) => ({ default: m.AiStylistPage }))
);
const WardrobePage = lazy(() =>
  import('./components/WardrobePage.tsx').then((m) => ({ default: m.WardrobePage }))
);
const OutfitGeneratorPage = lazy(() =>
  import('./components/OutfitGeneratorPage.tsx').then((m) => ({ default: m.OutfitGeneratorPage }))
);
const VirtualTryOnPage = lazy(() =>
  import('./components/VirtualTryOnPage.tsx').then((m) => ({ default: m.VirtualTryOnPage }))
);
const OutfitPlannerPage = lazy(() =>
  import('./components/OutfitPlannerPage.tsx').then((m) => ({ default: m.OutfitPlannerPage }))
);
const OrderTrackingPage = lazy(() =>
  import('./components/OrderTrackingPage.tsx').then((m) => ({ default: m.OrderTrackingPage }))
);
const UserDashboardPage = lazy(() =>
  import('./components/UserDashboardPage.tsx').then((m) => ({ default: m.UserDashboardPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./components/AdminDashboardPage.tsx').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminLoginPage = lazy(() =>
  import('./components/AdminLoginPage.tsx').then((m) => ({ default: m.AdminLoginPage }))
);
const SubscriptionsPage = lazy(() =>
  import('./components/SupportAndInfoPages.tsx').then((m) => ({ default: m.SubscriptionsPage }))
);
const AboutPage = lazy(() =>
  import('./components/SupportAndInfoPages.tsx').then((m) => ({ default: m.AboutPage }))
);
const ContactPage = lazy(() =>
  import('./components/SupportAndInfoPages.tsx').then((m) => ({ default: m.ContactPage }))
);
const FaqPage = lazy(() =>
  import('./components/SupportAndInfoPages.tsx').then((m) => ({ default: m.FaqPage }))
);
const PolicyPage = lazy(() =>
  import('./components/SupportAndInfoPages.tsx').then((m) => ({ default: m.PolicyPage }))
);

function PageFallback() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-20 flex flex-col items-center justify-center text-center">
      <div className="w-7 h-7 rounded-full border-2 border-[#E5DDD0] border-t-[#B5945B] animate-spin mb-3" />
      <p className="text-xs uppercase tracking-[0.18em] text-[#70685E]">Loading IMMERSO</p>
    </div>
  );
}

function ToastStack() {
  const { toasts } = useImmerso();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-3 left-3 sm:left-auto sm:right-4 z-50 space-y-2 sm:max-w-xs sm:w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl text-xs font-medium shadow-lg border backdrop-blur-md break-words ${
            t.tone === 'error'
              ? 'bg-red-950/90 text-white border-red-700'
              : t.tone === 'success'
              ? 'bg-[#2A231E]/95 text-[#FDFBF7] border-[#B5945B]/60'
              : 'bg-white/95 text-[#2A231E] border-[#E5DDD0]'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function ImmersoShell() {
  const { currentPage, isAdmin, adminAuthReady } = useImmerso();

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <>
            <HeroSection />
            <ShopSection previewOnly />
            <StyleInspirationPage previewOnly />
          </>
        );
      case 'shop':
      case 'collections':
        return <ShopSection />;
      case 'ai-stylist':
        return <AiStylistPage />;
      case 'wardrobe':
        return <WardrobePage />;
      case 'planner':
        return <OutfitPlannerPage />;
      case 'outfit-generator':
        return <OutfitGeneratorPage />;
      case 'virtual-tryon':
        return <VirtualTryOnPage />;
      case 'inspiration':
        return <StyleInspirationPage />;
      case 'order-tracking':
        return <OrderTrackingPage />;
      case 'dashboard':
        return <UserDashboardPage />;
      case 'admin-login':
        return <AdminLoginPage />;
      case 'admin':
        return adminAuthReady && isAdmin ? <AdminDashboardPage /> : <AdminLoginPage />;
      case 'subscriptions':
        return <SubscriptionsPage />;
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactPage />;
      case 'faq':
        return <FaqPage />;
      case 'privacy':
        return <PolicyPage type="privacy" />;
      case 'terms':
        return <PolicyPage type="terms" />;
      case 'shipping':
        return <PolicyPage type="shipping" />;
      case 'returns':
        return <PolicyPage type="returns" />;
      default:
        return <HeroSection />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] text-[#2A231E] overflow-x-clip">
      <Navbar />
      <main className="flex-1 min-w-0">
        <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
      </main>
      <Footer />
      <ProductDetailModal />
      <CartDrawer />
      <CheckoutModal />
      <FloatingChatbot />
      <ToastStack />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ImmersoProvider>
        <ImmersoShell />
      </ImmersoProvider>
    </ErrorBoundary>
  );
}
