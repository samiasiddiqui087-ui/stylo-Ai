import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CloudSun,
  ExternalLink,
  Flame,
  ImagePlus,
  RefreshCw,
  Send,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { db } from '../lib/firebase.ts';
import { compressImageFileToDataUrl, formatPkr } from '../lib/format.ts';
import { parseJsonResponse, toFriendlyNetworkError } from '../lib/http.ts';
import { containsUrduScript } from '../lib/language.ts';
import type { ChatMessage, Product, TrendingAnalysisResult } from '../types/immerso.ts';
import { SmartImage } from './SmartImage.tsx';

const STYLIST_PROMPTS = [
  'What should I wear today?',
  'Suggest an outfit for a party.',
  'Create an elegant office look.',
  'Which colors match this dress?',
  'Suggest outfits for winter.',
  'Help me style my existing wardrobe.',
  'Find an outfit under Rs. 5,000.',
];

const TREND_FOCUSES = [
  'All Luxury Trends',
  'Evening & Gala',
  'Tailored Office',
  'Festive & Wedding',
  'Minimalist Capsule',
];

export function AiStylistPage() {
  const {
    user,
    userProfile,
    products,
    wardrobe,
    weather,
    addToCart,
    openProductModal,
    notify,
  } = useImmerso();

  const [activeTab, setActiveTab] = useState<'stylist' | 'trending'>('stylist');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'stylist_welcome',
      role: 'assistant',
      text: "Hello! Welcome to IMMERSO. Let's create your perfect look today. Tell me about your occasion, budget, or upload a garment photo for tailored color and styling advice.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [uploadedPhoto, setUploadedPhoto] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Trending Now state
  const [trendFocus, setTrendFocus] = useState<string>('All Luxury Trends');
  const [trendingData, setTrendingData] = useState<TrendingAnalysisResult | null>(null);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState('');

  // Load saved stylist session if signed in
  useEffect(() => {
    if (!user) return;
    void getDoc(doc(db, 'users', user.uid, 'chatSessions', 'stylist'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as { messages?: ChatMessage[] };
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
      })
      .catch(() => {});
  }, [user]);

  const fetchTrendingAnalysis = useCallback(
    async (focusArea: string, forceRefresh = false) => {
      if (products.length === 0) return;
      setTrendingLoading(true);
      setTrendingError('');
      try {
        const resp = await fetch('/api/ai/trending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            focus: focusArea,
            catalog: products,
            weather,
            forceRefresh,
          }),
        });
        const data = await parseJsonResponse<TrendingAnalysisResult & { error?: string }>(
          resp,
          'Unable to analyze live fashion trends.'
        );
        if (!resp.ok) {
          throw new Error(data.error || 'Unable to analyze live fashion trends.');
        }
        setTrendingData(data);
      } catch (err) {
        const msg = toFriendlyNetworkError(err, 'Trend analysis failed.');
        setTrendingError(msg);
        notify(msg, 'error');
      } finally {
        setTrendingLoading(false);
      }
    },
    [products, weather, notify]
  );

  // Auto-load Trending Now once when opening the Trending Now tab (stops automatically on error until user retries)
  useEffect(() => {
    if (activeTab === 'trending' && !trendingData && !trendingLoading && !trendingError && products.length > 0) {
      void fetchTrendingAnalysis(trendFocus);
    }
  }, [activeTab, trendingData, trendingLoading, trendingError, products.length, trendFocus, fetchTrendingAnalysis]);

  const persistSession = async (nextMsgs: ChatMessage[]) => {
    if (!user) return;
    try {
      const compact = nextMsgs.slice(-24).map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        timestamp: m.timestamp,
      }));
      await setDoc(doc(db, 'users', user.uid, 'chatSessions', 'stylist'), {
        userId: user.uid,
        mode: 'stylist',
        messages: compact,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // ignore background persistence failure
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 700, 0.78);
      setUploadedPhoto(dataUrl);
      notify('Garment image attached for AI color & style analysis.', 'success');
    } catch {
      notify('Could not process the selected image.', 'error');
    }
  };

  const handleSend = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch('/api/ai/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextMsgs.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          catalog: products,
          wardrobe,
          weather,
          imageBase64: uploadedPhoto || undefined,
          imageMimeType: uploadedPhoto ? 'image/jpeg' : undefined,
          preferences: userProfile
            ? {
                preferredStyle: userProfile.preferredStyle,
                preferredColors: userProfile.preferredColors,
                preferredSize: userProfile.preferredSize,
              }
            : undefined,
        }),
      });

      const data = await parseJsonResponse<{
        reply?: string;
        products?: Product[];
        error?: string;
      }>(resp, 'Stylist request failed.');

      if (!resp.ok) throw new Error(data.error || 'Stylist request failed.');

      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'Here is your personalized styling consultation.',
        products: data.products || [],
        timestamp: new Date().toISOString(),
      };

      const finalMsgs = [...nextMsgs, assistantMsg];
      setMessages(finalMsgs);
      setUploadedPhoto('');
      void persistSession(finalMsgs);
    } catch (err) {
      const msg = toFriendlyNetworkError(err, 'Unable to reach AI Stylist.');
      notify(msg, 'error');
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: `Styling service notice: ${msg}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E5DDD0]">
        <div>
          <p className="text-xs text-[#70685E] mb-1">Personal Styling Studio</p>
          <h1 className="font-editorial text-4xl font-medium">AI Personal Stylist</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex max-w-full overflow-x-auto no-scrollbar p-1 bg-[#F7F3EC] border border-[#E5DDD0] rounded-xl">
            <button
              onClick={() => setActiveTab('stylist')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'stylist'
                  ? 'bg-[#2A231E] text-[#FDFBF7]'
                  : 'text-[#70685E] hover:text-[#2A231E]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stylist Consultation</span>
            </button>
            <button
              onClick={() => setActiveTab('trending')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'trending'
                  ? 'bg-[#2A231E] text-[#FDFBF7]'
                  : 'text-[#70685E] hover:text-[#2A231E]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#B5945B]" />
              <span>Trending Now</span>
            </button>
          </div>

          {weather && (
            <div className="flex items-center gap-2 text-xs text-[#70685E] bg-[#F7F3EC] px-4 py-2 rounded-xl border border-[#E5DDD0]">
              <CloudSun className="w-4 h-4 text-[#B5945B]" />
              <span>
                {weather.city} · <strong className="font-mono-num text-[#2A231E]">{weather.temperatureC}°C</strong> · {weather.condition}
              </span>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'trending' ? (
        <div className="mt-8 space-y-6">
          {/* Controls Header */}
          <div className="bg-[#F7F3EC] border border-[#E5DDD0] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#B5945B] mb-1">
                <Flame className="w-4 h-4" />
                <span>Live Gemini Fashion Trend Intelligence</span>
              </div>
              <h2 className="font-editorial text-2xl font-medium text-[#2A231E]">
                {trendingData?.seasonHeadline || 'Trending Now · Curated for IMMERSO'}
              </h2>
              <p className="text-xs text-[#70685E] mt-1">
                Analyzes current fashion movements via Google Search grounding and pairs them directly with in-stock pieces from our boutique.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {TREND_FOCUSES.map((focus) => (
                <button
                  key={focus}
                  onClick={() => {
                    setTrendFocus(focus);
                    void fetchTrendingAnalysis(focus);
                  }}
                  disabled={trendingLoading}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                    trendFocus === focus
                      ? 'bg-[#2A231E] text-[#FDFBF7] border-[#2A231E]'
                      : 'bg-white text-[#2A231E] border-[#E5DDD0] hover:bg-[#FDFBF7]'
                  }`}
                >
                  {focus}
                </button>
              ))}
              <button
                onClick={() => void fetchTrendingAnalysis(trendFocus, true)}
                disabled={trendingLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#B5945B] text-white text-xs font-semibold rounded-lg hover:opacity-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${trendingLoading ? 'animate-spin' : ''}`} />
                <span>{trendingLoading ? 'Analyzing...' : 'Refresh Trends'}</span>
              </button>
            </div>
          </div>

          {trendingLoading && !trendingData && (
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-10 text-center space-y-2">
              <TrendingUp className="w-6 h-6 text-[#B5945B] mx-auto animate-pulse" />
              <p className="font-editorial text-xl text-[#2A231E]">
                Analyzing Live Global & Regional Runway Trends...
              </p>
              <p className="text-xs text-[#70685E]">
                Matching current aesthetics against IMMERSO’s available boutique pieces.
              </p>
            </div>
          )}

          {trendingError && (
            <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 sm:p-5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>{trendingError}</span>
              <button
                onClick={() => void fetchTrendingAnalysis(trendFocus, true)}
                className="w-full sm:w-auto px-3 py-1.5 bg-red-900 text-white rounded-lg font-medium cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {trendingData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {trendingData.trends.map((trend, idx) => (
                  <article
                    key={`${trend.trendTitle}-${idx}`}
                    className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-5"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 max-w-2xl">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B5945B]">
                          Trend {idx + 1} · Trending Now
                        </span>
                        <h3 className="font-editorial text-2xl font-medium text-[#2A231E]">
                          {trend.trendTitle}
                        </h3>
                        <p className="text-sm text-[#4A4139] leading-relaxed">
                          {trend.trendSummary}
                        </p>
                        <p className="text-xs text-[#70685E] bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl px-3.5 py-2.5">
                          <strong className="text-[#2A231E]">Styling Cue:</strong> {trend.stylingCue}
                        </p>
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                        <div className="flex flex-wrap gap-1.5">
                          {trend.palette.map((color) => (
                            <span
                              key={color}
                              className="px-2.5 py-1 bg-[#F7F3EC] border border-[#E5DDD0] rounded-lg text-[11px] text-[#2A231E]"
                            >
                              {color}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab('stylist');
                            void handleSend(
                              `Style the "${trend.trendTitle}" trend for me using matching IMMERSO pieces.`
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
                          <span>Ask Stylist About This Trend</span>
                        </button>
                      </div>
                    </div>

                    {trend.matchedProducts.length > 0 && (
                      <div className="pt-4 border-t border-[#E5DDD0]">
                        <p className="text-xs font-semibold text-[#70685E] mb-3">
                          Matching Boutique Pieces ({trend.matchedProducts.length})
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {trend.matchedProducts.map((prod) => (
                            <div
                              key={prod.id}
                              className="flex gap-3 p-3 bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl"
                            >
                              <button
                                onClick={() => openProductModal(prod)}
                                className="w-18 h-24 rounded-lg overflow-hidden shrink-0 bg-[#F7F3EC] cursor-pointer"
                              >
                                <SmartImage
                                  src={prod.images[0]}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              <div className="min-w-0 flex-1 flex flex-col justify-between">
                                <div>
                                  <button
                                    onClick={() => openProductModal(prod)}
                                    className="text-left text-xs font-semibold text-[#2A231E] hover:underline line-clamp-2 cursor-pointer"
                                  >
                                    {prod.name}
                                  </button>
                                  <p className="font-mono-num text-xs text-[#B5945B] mt-0.5">
                                    {formatPkr(prod.pricePkr)}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    addToCart(prod, prod.sizes[0], prod.colors[0], 1)
                                  }
                                  className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-[#2A231E] text-[#FDFBF7] text-[11px] font-medium rounded-md w-fit cursor-pointer"
                                >
                                  <ShoppingBag className="w-3 h-3" />
                                  <span>Add to Bag</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {trendingData.sources.length > 0 && (
                <div className="bg-[#F7F3EC] border border-[#E5DDD0] rounded-2xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#70685E] mb-2">
                    Live Trend Editorial Sources
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {trendingData.sources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#2A231E] hover:text-[#B5945B] underline"
                      >
                        <span>{src.title}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          {/* Left Sidebar: Quick Prompts, Trending Now Callout & Wardrobe Sync */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="bg-[#2A231E] text-[#FDFBF7] rounded-2xl p-5 space-y-2.5 border border-[#B5945B]/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#DFC085]">
                <TrendingUp className="w-4 h-4" />
                <span>New · Live Trend Radar</span>
              </div>
              <p className="font-editorial text-xl font-medium">Trending Now Edit</p>
              <p className="text-xs text-[#E5DDD0]/85 leading-relaxed">
                Analyze live global fashion trends via Gemini and see matching in-stock pieces from IMMERSO.
              </p>
              <button
                onClick={() => setActiveTab('trending')}
                className="w-full py-2 px-3 bg-[#B5945B] text-[#16110E] text-xs font-semibold rounded-lg hover:bg-[#CCA86B] transition-colors cursor-pointer"
              >
                Explore Trending Now →
              </button>
            </div>

            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5">
              <h2 className="font-editorial text-xl font-medium mb-3">Ask Your Stylist</h2>
              <div className="space-y-2">
                {STYLIST_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void handleSend(q)}
                    className="w-full text-left px-3.5 py-2.5 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl hover:bg-[#F7F3EC] transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#F7F3EC] border border-[#E5DDD0] rounded-2xl p-5 space-y-2">
              <p className="text-xs font-semibold text-[#2A231E]">Active Styling Context</p>
              <p className="text-xs text-[#70685E]">
                Catalog synced: <span className="font-mono-num text-[#2A231E]">{products.length} pieces</span>
              </p>
              <p className="text-xs text-[#70685E]">
                Your Virtual Wardrobe: <span className="font-mono-num text-[#2A231E]">{wardrobe.length} items</span>
              </p>
              <p className="text-xs text-[#70685E]">
                Style profile: <span className="text-[#2A231E]">{userProfile?.preferredStyle || 'Quiet Luxury'}</span>
              </p>
            </div>
          </aside>

          {/* Right Conversation Canvas */}
          <div className="lg:col-span-8 bg-white border border-[#E5DDD0] rounded-2xl flex flex-col h-[70dvh] min-h-[420px] max-h-[620px] lg:h-[620px] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-5 bg-[#FDFBF7]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    dir={containsUrduScript(m.text) ? 'rtl' : 'ltr'}
                    className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3.5 sm:px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                      m.role === 'user'
                        ? 'bg-[#2A231E] text-[#FDFBF7]'
                        : 'bg-white border border-[#E5DDD0] text-[#2A231E]'
                    }`}
                  >
                    {m.text}
                  </div>

                  {m.products && m.products.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 w-full max-w-[92%]">
                      {m.products.map((prod) => (
                        <div
                          key={prod.id}
                          className="flex gap-3 p-3 bg-white border border-[#E5DDD0] rounded-xl"
                        >
                          <button
                            onClick={() => openProductModal(prod)}
                            className="w-16 h-20 rounded-lg overflow-hidden shrink-0 bg-[#F7F3EC] cursor-pointer"
                          >
                            <SmartImage
                              src={prod.images[0]}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <div className="min-w-0 flex-1 flex flex-col justify-between">
                            <div>
                              <button
                                onClick={() => openProductModal(prod)}
                                className="text-left text-xs font-semibold hover:underline line-clamp-2 cursor-pointer"
                              >
                                {prod.name}
                              </button>
                              <p className="font-mono-num text-xs text-[#B5945B] mt-0.5">
                                {formatPkr(prod.pricePkr)}
                              </p>
                            </div>
                            <button
                              onClick={() => addToCart(prod, prod.sizes[0], prod.colors[0], 1)}
                              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-[#2A231E] text-[#FDFBF7] text-[11px] font-medium rounded-md w-fit cursor-pointer"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>Add to Bag</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#70685E] bg-white border border-[#E5DDD0] px-4 py-2.5 rounded-xl w-fit">
                  <Sparkles className="w-4 h-4 text-[#B5945B] animate-pulse" />
                  <span>Composing your styling recommendation...</span>
                </div>
              )}
            </div>

            {/* Attached Garment Preview */}
            {uploadedPhoto && (
              <div className="px-4 py-2 bg-[#F7F3EC] border-t border-[#E5DDD0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={uploadedPhoto}
                    alt="Uploaded garment"
                    className="w-10 h-10 rounded-lg object-cover border border-[#E5DDD0]"
                  />
                  <span className="text-xs text-[#2A231E]">Garment attached for AI color & style matching</span>
                </div>
                <button
                  onClick={() => setUploadedPhoto('')}
                  className="p-1 text-[#70685E] hover:text-[#2A231E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend(input);
              }}
              className="p-3 sm:p-4 bg-white border-t border-[#E5DDD0] flex items-center gap-2 sm:gap-2.5"
            >
              <label
                title="Upload garment photo for AI analysis"
                className="p-2.5 bg-[#F7F3EC] border border-[#E5DDD0] rounded-lg hover:bg-[#E5DDD0] transition-colors shrink-0 cursor-pointer"
              >
                <ImagePlus className="w-4 h-4 text-[#2A231E]" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              <input
                type="text"
                dir={containsUrduScript(input) ? 'rtl' : 'ltr'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask in English, Roman Urdu, or اردو..."
                className="flex-1 min-w-0 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg px-3 sm:px-3.5 py-2.5 focus:outline-none focus:border-[#2A231E]"
              />

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="inline-flex items-center gap-1.5 px-3 sm:px-5 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] disabled:opacity-40 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Consult</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
