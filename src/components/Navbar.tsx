import { useState } from 'react';
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import type { PageId } from '../types/immerso.ts';

const PRIMARY_NAV: Array<{ id: PageId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'ai-stylist', label: 'AI Stylist' },
  { id: 'wardrobe', label: 'My Wardrobe' },
  { id: 'planner', label: 'Planner' },
];

const ALL_MENU_LINKS: Array<{ id: PageId; label: string; section: string }> = [
  { id: 'home', label: 'Home', section: 'Boutique' },
  { id: 'shop', label: 'Shop All', section: 'Boutique' },
  { id: 'collections', label: 'Collections', section: 'Boutique' },
  { id: 'inspiration', label: 'Style Inspiration', section: 'Boutique' },
  { id: 'ai-stylist', label: 'AI Personal Stylist', section: 'Styling Studio' },
  { id: 'wardrobe', label: 'My Virtual Wardrobe', section: 'Styling Studio' },
  { id: 'planner', label: 'Outfit Planner', section: 'Styling Studio' },
  { id: 'outfit-generator', label: 'AI Outfit Generator', section: 'Styling Studio' },
  { id: 'virtual-tryon', label: 'AI Virtual Try-On', section: 'Styling Studio' },
  { id: 'order-tracking', label: 'Order Tracking', section: 'Account & Support' },
  { id: 'dashboard', label: 'My Profile & Dashboard', section: 'Account & Support' },
  { id: 'subscriptions', label: 'Memberships', section: 'Account & Support' },
  { id: 'about', label: 'About IMMERSO', section: 'Account & Support' },
  { id: 'contact', label: 'Contact & Support', section: 'Account & Support' },
];

export function Navbar() {
  const {
    currentPage,
    navigate,
    cart,
    setCartOpen,
    wishlistIds,
    user,
    isAdmin,
    signInWithGoogle,
    searchQuery,
    setSearchQuery,
  } = useImmerso();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handleNav = (id: PageId) => {
    navigate(id);
    setDrawerOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOpen(false);
    navigate('shop');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#E5DDD0]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            onClick={() => handleNav('home')}
            className="font-editorial text-xl sm:text-2xl font-semibold tracking-[0.14em] sm:tracking-[0.18em] text-[#2A231E] whitespace-nowrap shrink-0 cursor-pointer"
          >
            IMMERSO
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#70685E]">
            {PRIMARY_NAV.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`relative py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'text-[#2A231E] font-semibold' : 'hover:text-[#2A231E]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-0.5 h-[1.5px] bg-[#B5945B]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Compact utility affordances + Primary Action */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setSearchOpen((s) => !s)}
              aria-label="Search boutique"
              className="p-2 text-[#2A231E] hover:bg-[#F7F3EC] rounded-lg transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleNav('dashboard')}
              aria-label="Wishlist"
              className="hidden sm:inline-flex relative p-2 text-[#2A231E] hover:bg-[#F7F3EC] rounded-lg transition-colors cursor-pointer"
            >
              <Heart className="w-4 h-4" />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[10px] font-mono-num bg-[#2A231E] text-[#FDFBF7] w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlistIds.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCartOpen(true)}
              aria-label="Shopping Bag"
              className="relative p-2 text-[#2A231E] hover:bg-[#F7F3EC] rounded-lg transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[10px] font-mono-num bg-[#B5945B] text-white w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => handleNav(isAdmin ? 'admin' : 'admin-login')}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                isAdmin
                  ? 'bg-[#F7F3EC] border-[#B5945B]/60 text-[#2A231E] hover:bg-[#E5DDD0]'
                  : 'bg-[#2A231E] border-[#2A231E] text-[#FDFBF7] hover:bg-[#3F352E]'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-[#B5945B]" />
              <span>Admin</span>
            </button>

            {user && (
              <button
                onClick={() => handleNav('dashboard')}
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-[#F7F3EC] border border-[#E5DDD0] text-[#2A231E] rounded-lg hover:bg-[#E5DDD0] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>{user.displayName?.split(' ')[0] || 'Profile'}</span>
              </button>
            )}

            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open Studio Directory"
              className="p-2 text-[#2A231E] hover:bg-[#F7F3EC] rounded-lg transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inline Expandable Search Bar */}
        {searchOpen && (
          <div className="border-t border-[#E5DDD0] bg-[#FDFBF7] px-4 sm:px-8 py-3">
            <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex items-center gap-2">
              <Search className="w-4 h-4 text-[#70685E] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dresses, cashmere trench, handbags..."
                autoFocus
                className="flex-1 min-w-0 bg-transparent text-sm text-[#2A231E] placeholder-[#70685E] focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 sm:px-4 py-1.5 text-xs font-medium bg-[#2A231E] text-[#FDFBF7] rounded-lg shrink-0 cursor-pointer"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1.5 text-[#70685E] hover:text-[#2A231E] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Full Directory & Mobile Navigation Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#2A231E]/40 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 w-full max-w-sm bg-[#FDFBF7] h-full border-l border-[#E5DDD0] p-4 sm:p-6 overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-[#E5DDD0]">
                <span className="font-editorial text-xl tracking-[0.18em] font-semibold">IMMERSO</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="p-2 hover:bg-[#F7F3EC] rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-6">
                {['Boutique', 'Styling Studio', 'Account & Support'].map((section) => (
                  <div key={section}>
                    <p className="text-xs font-medium text-[#70685E] mb-2.5">{section}</p>
                    <div className="space-y-1">
                      {ALL_MENU_LINKS.filter((l) => l.section === section).map((link) => (
                        <button
                          key={link.id}
                          onClick={() => handleNav(link.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                            currentPage === link.id
                              ? 'bg-[#F7F3EC] text-[#2A231E] font-semibold'
                              : 'text-[#2A231E]/85 hover:bg-[#F7F3EC]'
                          }`}
                        >
                          {link.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-[#E5DDD0]">
                  <button
                    onClick={() => handleNav(isAdmin ? 'admin' : 'admin-login')}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer ${
                      isAdmin
                        ? 'bg-[#2A231E] text-[#FDFBF7]'
                        : 'bg-[#F7F3EC] text-[#2A231E] border border-[#E5DDD0] hover:bg-[#E5DDD0]'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-[#B5945B]" />
                    <span>{isAdmin ? 'Admin Console' : 'Admin Login'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E5DDD0] mt-6 space-y-3">
              {user ? (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                    <p className="text-xs text-[#70685E] truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => handleNav('dashboard')}
                    className="px-3 py-1.5 text-xs border border-[#E5DDD0] rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    Dashboard
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    void signInWithGoogle();
                  }}
                  className="w-full py-2.5 bg-[#2A231E] text-[#FDFBF7] text-sm font-medium rounded-lg cursor-pointer"
                >
                  Sign In / Create Account
                </button>
              )}
              <p className="text-xs text-[#70685E]">
                WhatsApp Atelier Concierge: +92 311 2537554
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
