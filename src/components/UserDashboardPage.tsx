import { useEffect, useState } from 'react';
import {
  Calendar,
  CloudSun,
  Crown,
  Heart,
  LogOut,
  Package,
  Save,
  Shirt,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatDateIso, formatPkr, formatTimestamp } from '../lib/format.ts';
import { SmartImage } from './SmartImage.tsx';

export function UserDashboardPage() {
  const {
    user,
    userProfile,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    weather,
    wardrobe,
    schedules,
    savedOutfits,
    deleteSavedOutfit,
    wishlistIds,
    toggleWishlist,
    products,
    orders,
    openProductModal,
    addToCart,
    navigate,
  } = useImmerso();

  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [preferredStyle, setPreferredStyle] = useState('Quiet Luxury');
  const [preferredSize, setPreferredSize] = useState('M');
  const [preferredColorsStr, setPreferredColorsStr] = useState('Beige, Ivory, Black');

  useEffect(() => {
    if (userProfile) {
      setPhone(userProfile.phone || '');
      setCity(userProfile.city || '');
      setAddress(userProfile.address || '');
      setPreferredStyle(userProfile.preferredStyle || 'Quiet Luxury');
      setPreferredSize(userProfile.preferredSize || 'M');
      setPreferredColorsStr((userProfile.preferredColors || ['Beige', 'Ivory', 'Black']).join(', '));
    }
  }, [userProfile]);

  if (!user) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-8 py-20 text-center">
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-10">
          <Sparkles className="w-10 h-10 text-[#B5945B] mx-auto mb-4" />
          <h1 className="font-editorial text-4xl font-medium mb-3">Your IMMERSO Atelier</h1>
          <p className="text-sm text-[#70685E] max-w-md mx-auto mb-6">
            Sign in with Google to access your personalized styling dashboard, saved outfits, digital wardrobe, wishlist, and order history.
          </p>
          <button
            onClick={() => void signInWithGoogle()}
            className="px-7 py-3 bg-[#2A231E] text-[#FDFBF7] text-sm font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
          >
            Sign In / Sign Up with Google
          </button>
        </div>
      </section>
    );
  }

  const todayIso = formatDateIso(new Date());
  const todaySchedule = schedules.find((s) => s.date === todayIso);
  const wishlistProducts = wishlistIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const colors = preferredColorsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await updateUserProfile({
      phone,
      city,
      address,
      preferredStyle,
      preferredSize,
      preferredColors: colors,
    });
  };

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5DDD0]">
        <div className="flex items-center gap-4">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover border border-[#E5DDD0]"
            />
          )}
          <div>
            <p className="text-xs text-[#70685E]">
              {userProfile?.plan === 'premium' ? 'Premium Atelier Member' : 'Free Membership'} · {user.email}
            </p>
            <h1 className="font-editorial text-3xl sm:text-4xl font-medium">
              Welcome back, {user.displayName?.split(' ')[0] || 'Client'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('subscriptions')}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#B5945B] text-xs font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 text-[#B5945B]" />
            <span>Membership</span>
          </button>
          <button
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#E5DDD0] text-xs font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#70685E] mb-2">
            <span>Today’s Outfit</span>
            <Calendar className="w-4 h-4 text-[#B5945B]" />
          </div>
          <p className="font-editorial text-xl font-medium">
            {todaySchedule ? todaySchedule.title : 'Not Scheduled Yet'}
          </p>
          <button
            onClick={() => navigate('planner')}
            className="mt-3 text-xs font-medium text-[#B5945B] hover:underline cursor-pointer"
          >
            Open Outfit Planner →
          </button>
        </div>

        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#70685E] mb-2">
            <span>Live Weather</span>
            <CloudSun className="w-4 h-4 text-[#B5945B]" />
          </div>
          <p className="font-editorial text-xl font-medium">
            {weather ? `${weather.city} · ${weather.temperatureC}°C` : 'Loading weather...'}
          </p>
          <p className="text-xs text-[#70685E] mt-1 line-clamp-2">
            {weather?.condition || 'Fetching forecast'}
          </p>
        </div>

        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#70685E] mb-2">
            <span>Virtual Wardrobe</span>
            <Shirt className="w-4 h-4 text-[#B5945B]" />
          </div>
          <p className="font-mono-num text-2xl font-semibold">{wardrobe.length} pieces</p>
          <button
            onClick={() => navigate('wardrobe')}
            className="mt-3 text-xs font-medium text-[#B5945B] hover:underline cursor-pointer"
          >
            Manage Wardrobe →
          </button>
        </div>

        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#70685E] mb-2">
            <span>Orders Placed</span>
            <Package className="w-4 h-4 text-[#B5945B]" />
          </div>
          <p className="font-mono-num text-2xl font-semibold">{orders.length}</p>
          <button
            onClick={() => navigate('order-tracking')}
            className="mt-3 text-xs font-medium text-[#B5945B] hover:underline cursor-pointer"
          >
            Track Orders →
          </button>
        </div>
      </div>

      {/* Main Grid: Profile Preferences + Wishlist / Saved Outfits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-5 bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-4 h-fit"
        >
          <h2 className="font-editorial text-2xl font-medium">Profile & Style Preferences</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#70685E] mb-1">Phone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300 1234567"
                className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-[#70685E] mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Karachi"
                className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#70685E] mb-1">Saved Delivery Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, Sector, House No."
              className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#70685E] mb-1">Aesthetic</label>
              <input
                type="text"
                value={preferredStyle}
                onChange={(e) => setPreferredStyle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-[#70685E] mb-1">Preferred Size</label>
              <input
                type="text"
                value={preferredSize}
                onChange={(e) => setPreferredSize(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#70685E] mb-1">Favorite Colors (comma separated)</label>
            <input
              type="text"
              value={preferredColorsStr}
              onChange={(e) => setPreferredColorsStr(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </form>

        <div className="lg:col-span-7 space-y-8">
          {/* Wishlist */}
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-editorial text-2xl font-medium">Saved Wishlist</h2>
              <Heart className="w-4 h-4 text-[#B5945B]" />
            </div>
            {wishlistProducts.length === 0 ? (
              <p className="text-xs text-[#70685E]">
                No saved wishlist pieces yet. Tap the heart on any item in the Shop.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {wishlistProducts.map((p) => (
                  <div key={p.id} className="flex gap-3 p-3 bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl">
                    <button
                      onClick={() => openProductModal(p)}
                      className="w-16 h-20 rounded-lg overflow-hidden shrink-0 cursor-pointer"
                    >
                      <SmartImage src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="font-mono-num text-xs text-[#70685E] mt-0.5">{formatPkr(p.pricePkr)}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => addToCart(p, p.sizes[0], p.colors[0], 1)}
                          className="px-2.5 py-1 bg-[#2A231E] text-[#FDFBF7] text-[11px] rounded cursor-pointer"
                        >
                          Add to Bag
                        </button>
                        <button
                          onClick={() => void toggleWishlist(p.id)}
                          className="text-[11px] text-[#70685E] hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved Outfits */}
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6">
            <h2 className="font-editorial text-2xl font-medium mb-4">Saved Outfits</h2>
            {savedOutfits.length === 0 ? (
              <p className="text-xs text-[#70685E]">
                Save generated outfits or inspiration looks to build your personal lookbook.
              </p>
            ) : (
              <div className="space-y-3">
                {savedOutfits.map((o) => (
                  <div
                    key={o.id}
                    className="p-4 bg-[#F7F3EC] border border-[#E5DDD0] rounded-xl flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{o.title}</p>
                      <p className="text-xs text-[#70685E] mt-0.5">{o.occasion}</p>
                      <p className="text-xs text-[#2A231E]/80 mt-1.5">{o.stylingExplanation}</p>
                    </div>
                    <button
                      onClick={() => void deleteSavedOutfit(o.id)}
                      className="p-1.5 text-[#70685E] hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6">
            <h2 className="font-editorial text-2xl font-medium mb-4">Recent Orders</h2>
            {orders.length === 0 ? (
              <p className="text-xs text-[#70685E]">You have not placed an order yet.</p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((ord) => (
                  <div
                    key={ord.orderId}
                    className="p-3.5 bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono-num text-xs font-semibold">{ord.orderId}</p>
                      <p className="text-xs text-[#70685E]">
                        {ord.status} · {formatTimestamp(ord.createdAt)}
                      </p>
                    </div>
                    <p className="font-mono-num text-sm font-semibold">{formatPkr(ord.totalPkr)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
