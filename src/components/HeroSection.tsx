import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  MessageSquare,
  Plus,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { HERO_WARDROBE_IMAGE } from '../data/seedCatalog.ts';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatDateIso, formatPkr, formatReadableDate } from '../lib/format.ts';
import { SmartImage } from './SmartImage.tsx';

export function HeroSection() {
  const {
    navigate,
    siteConfig,
    user,
    weather,
    products,
    schedules,
    setChatOpen,
    setChatPrefill,
    openProductModal,
  } = useImmerso();

  const [dayOffset, setDayOffset] = useState(0);

  const selectedDateObj = new Date();
  selectedDateObj.setDate(selectedDateObj.getDate() + dayOffset);
  const selectedIso = formatDateIso(selectedDateObj);

  const scheduledForDate = schedules.find((s) => s.date === selectedIso);

  const primaryLook = products[1] || products[0];
  const secondaryItem = products[3] || products[4] || products[0];
  const accessoryItem = products[4] || products[5] || products[0];

  const scheduledProducts = scheduledForDate
    ? scheduledForDate.productIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
    : [primaryLook, secondaryItem].filter(Boolean);

  const handleQuickStylistChat = () => {
    setChatPrefill("What should I wear today based on the weather and my style?");
    setChatOpen(true);
  };

  return (
    <section className="relative overflow-hidden bg-[#EFE8DC]">
      {/* Editorial Hero Canvas */}
      <div className="relative min-h-[600px] sm:min-h-[680px] lg:min-h-[760px] max-w-[1440px] mx-auto">
        {/* Background Realistic Walk-in Wardrobe Photography */}
        <SmartImage
          src={HERO_WARDROBE_IMAGE}
          alt="IMMERSO model standing in luxury walk-in wardrobe"
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Subtle Measured Scrims for WCAG Contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1E1814]/55 via-[#1E1814]/20 to-[#1E1814]/70" />

        {/* Foreground Content Grid */}
        <div className="relative z-10 h-full min-h-[600px] sm:min-h-[680px] lg:min-h-[760px] px-4 sm:px-8 py-8 sm:py-10 lg:py-14 flex flex-col justify-between">
          {/* Top Editorial Headline Block */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl mx-auto text-center text-[#FDFBF7]"
          >
            <p className="text-[11px] sm:text-xs tracking-[0.18em] sm:tracking-[0.22em] uppercase text-[#E5DDD0] mb-2">
              Smart Shopping · Sharp Styling · Virtually Yours
            </p>
            <h1
              className="font-editorial text-3xl sm:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.08] mb-3"
              style={{ textWrap: 'balance' }}
            >
              {siteConfig.heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-[#FDFBF7]/90 max-w-xl mx-auto leading-relaxed mb-6">
              {siteConfig.heroSubtitle}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate('ai-stylist')}
                className="px-6 py-2.5 bg-[#FDFBF7] text-[#2A231E] text-sm font-semibold rounded-lg hover:bg-[#F7F3EC] transition-colors shadow-sm cursor-pointer"
              >
                Discover Your Style
              </button>
              <button
                onClick={() => navigate('wardrobe')}
                className="px-6 py-2.5 bg-[#2A231E]/75 backdrop-blur-md text-[#FDFBF7] border border-[#FDFBF7]/35 text-sm font-medium rounded-lg hover:bg-[#2A231E]/90 transition-colors cursor-pointer"
              >
                Explore My Wardrobe
              </button>
            </div>
          </motion.div>

          {/* Bottom Floating Frosted-Glass Panels flanking the Model */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end mt-8 lg:mt-16">
            {/* LEFT PANEL – AI PERSONAL STYLIST */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-4 glass-panel rounded-2xl p-4 sm:p-5 shadow-lg text-[#2A231E]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD0]">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Profile'}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-[#E5DDD0]"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#E5DDD0] flex items-center justify-center text-[#2A231E]">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#70685E]">IMMERSO AI Stylist</p>
                    <p className="text-sm font-semibold truncate">
                      Good day, {user?.displayName?.split(' ')[0] || 'Guest'}
                    </p>
                  </div>
                </div>

                {weather && (
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-xs font-medium">
                      <CloudSun className="w-3.5 h-3.5 text-[#B5945B]" />
                      <span className="font-mono-num">{weather.temperatureC}°C</span>
                    </div>
                    <p className="text-[11px] text-[#70685E]">{weather.city}</p>
                  </div>
                )}
              </div>

              {primaryLook && (
                <div className="mt-3.5 flex gap-3.5 items-center">
                  <button
                    onClick={() => openProductModal(primaryLook)}
                    className="w-16 h-20 rounded-xl overflow-hidden shrink-0 border border-[#E5DDD0] cursor-pointer"
                  >
                    <SmartImage
                      src={primaryLook.images[0]}
                      alt={primaryLook.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[#70685E] mb-0.5">Today’s Recommendation</p>
                    <h3 className="font-editorial text-base font-semibold leading-snug truncate">
                      {primaryLook.name}
                    </h3>
                    <p className="text-xs text-[#70685E] line-clamp-2 mt-0.5">
                      {weather?.stylingTip ||
                        'Refined champagne tones paired with structured leather for effortless polish.'}
                    </p>
                    <p className="text-xs font-mono-num font-medium mt-1">
                      {formatPkr(primaryLook.pricePkr)}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleQuickStylistChat}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg hover:bg-[#3F352E] transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Quick AI Stylist Chat</span>
                </button>
                <button
                  onClick={() => navigate('ai-stylist')}
                  className="py-2 px-3 border border-[#E5DDD0] bg-white/70 text-[#2A231E] text-xs font-medium rounded-lg hover:bg-white transition-colors cursor-pointer"
                >
                  Studio
                </button>
              </div>
            </motion.div>

            {/* Center Spacer allowing full view of the Model */}
            <div className="hidden lg:block lg:col-span-4" />

            {/* RIGHT PANEL – OUTFIT PLANNER */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="lg:col-span-4 glass-panel rounded-2xl p-4 sm:p-5 shadow-lg text-[#2A231E]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD0]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#B5945B]" />
                  <div>
                    <p className="text-[11px] text-[#70685E]">Outfit Planner</p>
                    <p className="text-sm font-semibold">{formatReadableDate(selectedIso)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDayOffset((d) => d - 1)}
                    aria-label="Previous date"
                    className="p-1.5 rounded-lg hover:bg-[#E5DDD0]/60 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDayOffset(0)}
                    className="px-2 py-1 text-[11px] font-medium hover:bg-[#E5DDD0]/60 rounded-md cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setDayOffset((d) => d + 1)}
                    aria-label="Next date"
                    className="p-1.5 rounded-lg hover:bg-[#E5DDD0]/60 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs mb-2">
                  <span className="font-medium text-[#2A231E] truncate max-w-full">
                    {scheduledForDate?.title ||
                      (dayOffset === 0
                        ? 'Office Chic · Champagne Tailoring'
                        : 'Curated Capsule Preview')}
                  </span>
                  <span className="text-[#70685E] shrink-0">
                    {scheduledForDate?.occasion || 'Formal / Day'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {scheduledProducts.slice(0, 2).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openProductModal(item)}
                      className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-[#E5DDD0] bg-white cursor-pointer"
                    >
                      <SmartImage
                        src={item.images[0]}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </button>
                  ))}
                  {accessoryItem && (
                    <button
                      onClick={() => openProductModal(accessoryItem)}
                      className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-[#E5DDD0] bg-white cursor-pointer"
                    >
                      <SmartImage
                        src={accessoryItem.images[0]}
                        alt={accessoryItem.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </button>
                  )}
                </div>

                <p className="text-xs text-[#70685E] mt-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
                  <span className="truncate">
                    {scheduledForDate?.accessoriesNote ||
                      'Accessory suggestion: Baroque Pearl Drops & Taupe Top-Handle'}
                  </span>
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => navigate('planner')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg hover:bg-[#3F352E] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule Look</span>
                </button>
                <button
                  onClick={() => navigate('outfit-generator')}
                  className="py-2 px-3 border border-[#E5DDD0] bg-white/70 text-[#2A231E] text-xs font-medium rounded-lg hover:bg-white transition-colors cursor-pointer"
                >
                  AI Generate
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
