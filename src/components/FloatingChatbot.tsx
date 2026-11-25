import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Send,
  ShoppingBag,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatPkr } from '../lib/format.ts';
import { parseJsonResponse, toFriendlyNetworkError, tryParseJson } from '../lib/http.ts';
import { containsUrduScript, detectConversationLanguage, type TtsLang } from '../lib/language.ts';
import type { ChatMessage, PageId, Product, RobotState } from '../types/immerso.ts';
import { SmartImage } from './SmartImage.tsx';

const RobotAssistant3D = lazy(() =>
  import('./RobotAssistant3D.tsx').then((m) => ({ default: m.RobotAssistant3D }))
);

const QUICK_PROMPTS = [
  'Show me black dresses',
  'Mujhe party ke liye dress dikhao',
  'Suggest a handbag for the Noir dress',
  'Open my wardrobe',
];

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function RobotStageFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#16110E]">
      <div
        className={`rounded-full border border-[#B5945B]/50 flex items-center justify-center ${
          compact ? 'w-8 h-8' : 'w-16 h-16'
        }`}
      >
        <Sparkles className={`${compact ? 'w-3.5 h-3.5' : 'w-6 h-6'} text-[#DFC085] animate-pulse`} />
      </div>
    </div>
  );
}

function ChatProductCard({
  product,
  onAdd,
  onBuyNow,
  onInspect,
}: {
  product: Product;
  onAdd: (p: Product, size: string, color: string, qty: number) => void;
  onBuyNow: (p: Product, size: string, color: string, qty: number) => void;
  onInspect: (p: Product) => void;
}) {
  const [size, setSize] = useState(product.sizes[0] || 'One Size');
  const [color, setColor] = useState(product.colors[0] || 'Default');
  const [qty, setQty] = useState(1);

  return (
    <div className="bg-[#231D19] border border-[#B5945B]/30 rounded-xl p-2.5 space-y-2 text-[#FDFBF7] min-w-0">
      <div className="flex gap-2.5">
        <button
          onClick={() => onInspect(product)}
          className="w-14 h-18 rounded-lg overflow-hidden shrink-0 bg-[#16110E] border border-[#B5945B]/20 cursor-pointer"
        >
          <SmartImage src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onInspect(product)}
            className="text-left text-xs font-semibold text-[#FDFBF7] hover:text-[#E5C98E] line-clamp-2 cursor-pointer"
          >
            {product.name}
          </button>
          <p className="font-mono-num text-xs font-semibold text-[#DFC085] mt-0.5">
            {formatPkr(product.pricePkr)}
          </p>
          <p className="text-[11px] text-[#C8BEB0]">
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <select
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="text-[11px] px-1.5 py-1 bg-[#16110E] text-[#FDFBF7] border border-[#B5945B]/25 rounded min-w-0"
        >
          {product.sizes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="text-[11px] px-1.5 py-1 bg-[#16110E] text-[#FDFBF7] border border-[#B5945B]/25 rounded min-w-0"
        >
          {product.colors.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={Math.max(1, product.stock)}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="text-[11px] px-1.5 py-1 bg-[#16110E] text-[#FDFBF7] border border-[#B5945B]/25 rounded font-mono-num min-w-0"
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onAdd(product, size, color, qty)}
          disabled={product.stock <= 0}
          className="py-1.5 px-2 bg-[#FDFBF7] text-[#1A1411] text-[11px] font-semibold rounded-lg hover:bg-[#EFE7DA] disabled:opacity-40 cursor-pointer"
        >
          Add to Cart
        </button>
        <button
          onClick={() => onBuyNow(product, size, color, qty)}
          disabled={product.stock <= 0}
          className="py-1.5 px-2 bg-[#B5945B] text-[#16110E] text-[11px] font-semibold rounded-lg hover:bg-[#C9A76E] disabled:opacity-40 cursor-pointer"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}

export function FloatingChatbot() {
  const {
    isChatOpen,
    setChatOpen,
    chatPrefill,
    setChatPrefill,
    siteConfig,
    products,
    wardrobe,
    schedules,
    weather,
    user,
    userProfile,
    cart,
    addToCart,
    removeFromCart,
    updateCartQty,
    saveSchedule,
    navigate,
    setCartOpen,
    setCheckoutOpen,
    openProductModal,
    totalPkr,
    notify,
  } = useImmerso();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text:
        siteConfig.chatbotWelcome ||
        "Welcome to IMMERSO. I'm Aurora, your personal 3D fashion concierge. Speak or type in English, Urdu, or Roman Urdu.",
      timestamp: new Date().toISOString(),
    },
  ]);

  const [input, setInput] = useState('');
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [langMode, setLangMode] = useState<'auto' | 'en' | 'ur'>('auto');
  const [activeTtsLang, setActiveTtsLang] = useState<TtsLang>('en');
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [liveSubtitle, setLiveSubtitle] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');

  const speechAmplitudeRef = useRef<number>(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRafRef = useRef<number>(0);
  const synthIntervalRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sendMessageRef = useRef<(t: string) => Promise<void>>(async () => {});

  const cycleLangMode = () => {
    setLangMode((prev) => (prev === 'auto' ? 'en' : prev === 'en' ? 'ur' : 'auto'));
  };

  const stopAllSpeech = useCallback(() => {
    cancelAnimationFrame(analyserRafRef.current);
    clearInterval(synthIntervalRef.current);
    speechAmplitudeRef.current = 0;

    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      activeSourceRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setRobotState((prev) => (prev === 'speaking' ? 'idle' : prev));
  }, []);

  useEffect(() => {
    if (isMuted) {
      stopAllSpeech();
    }
  }, [isMuted, stopAllSpeech]);

  useEffect(() => {
    if (!isChatOpen) {
      stopAllSpeech();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    }
  }, [isChatOpen, stopAllSpeech]);

  useEffect(() => {
    return () => {
      stopAllSpeech();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopAllSpeech]);

  useEffect(() => {
    if (chatPrefill) {
      setInput(chatPrefill);
      setChatPrefill('');
    }
  }, [chatPrefill, setChatPrefill]);

  useEffect(() => {
    if (showTranscript) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, showTranscript, isChatOpen]);

  const speakWithWebSpeechFallback = useCallback(
    (text: string, lang: TtsLang) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setRobotState('idle');
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const resolvedLang: TtsLang = containsUrduScript(text) ? 'ur' : lang;
      utterance.lang = resolvedLang === 'ur' ? 'ur-PK' : 'en-US';
      utterance.rate = 0.98;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const targetPrefix = resolvedLang === 'ur' ? 'ur' : 'en';
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(targetPrefix) &&
            /natural|neural|google|samantha|aria|jenny|zira/i.test(v.name)
        ) || voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setRobotState('speaking');
        setLiveSubtitle(text);
        clearInterval(synthIntervalRef.current);
        let phase = 0;
        synthIntervalRef.current = window.setInterval(() => {
          phase += 0.38;
          speechAmplitudeRef.current = 0.35 + Math.abs(Math.sin(phase)) * 0.55;
        }, 45);
      };

      const finish = () => {
        clearInterval(synthIntervalRef.current);
        speechAmplitudeRef.current = 0;
        setRobotState('idle');
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const speakResponse = useCallback(
    async (text: string, lang: TtsLang) => {
      setLiveSubtitle(text);
      if (isMuted) {
        setRobotState('idle');
        return;
      }

      stopAllSpeech();
      setRobotState('speaking');

      const resolvedLang: TtsLang = containsUrduScript(text) ? 'ur' : lang;

      try {
        const resp = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: resolvedLang }),
        });

        if (!resp.ok) {
          throw new Error('TTS service unavailable');
        }

        const data = await tryParseJson<{ audioBase64?: string; mimeType?: string }>(resp);
        if (!data?.audioBase64) {
          throw new Error('No audio returned');
        }

        const binaryStr = atob(data.audioBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        source.connect(analyser);
        analyser.connect(ctx.destination);
        activeSourceRef.current = source;

        const trackAmplitude = () => {
          if (!activeSourceRef.current) return;
          analyser.getByteTimeDomainData(dataArray);
          let sumSq = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const norm = (dataArray[i] - 128) / 128;
            sumSq += norm * norm;
          }
          const rms = Math.sqrt(sumSq / dataArray.length);
          speechAmplitudeRef.current = Math.min(1, rms * 4.8);
          analyserRafRef.current = requestAnimationFrame(trackAmplitude);
        };

        source.onended = () => {
          cancelAnimationFrame(analyserRafRef.current);
          speechAmplitudeRef.current = 0;
          activeSourceRef.current = null;
          setRobotState('idle');
        };

        source.start(0);
        analyserRafRef.current = requestAnimationFrame(trackAmplitude);
      } catch {
        speakWithWebSpeechFallback(text, resolvedLang);
      }
    },
    [isMuted, speakWithWebSpeechFallback, stopAllSpeech]
  );

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || robotState === 'thinking') return;

      stopAllSpeech();

      const detected = detectConversationLanguage(trimmed);
      const effectiveLang: TtsLang = langMode === 'auto' ? detected.ttsLang : langMode;
      setActiveTtsLang(effectiveLang);

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
      };

      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setInput('');
      setInterimTranscript('');
      setLiveSubtitle(trimmed);
      setRobotState('thinking');

      try {
        const resp = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: nextHistory.slice(-10).map((m) => ({ role: m.role, text: m.text })),
            catalog: products,
            cart,
            wardrobe,
            schedules,
            weather,
            preferences: userProfile
              ? {
                  preferredStyle: userProfile.preferredStyle,
                  preferredColors: userProfile.preferredColors,
                  preferredSize: userProfile.preferredSize,
                }
              : undefined,
            language: langMode,
          }),
        });

        const data = await parseJsonResponse<{
          reply?: string;
          products?: Product[];
          detectedLanguage?: TtsLang;
          cartActions?: Array<{
            type: 'add' | 'update' | 'remove' | 'open_cart' | 'open_checkout' | 'navigate' | 'schedule_outfit';
            productId?: string;
            size?: string;
            color?: string;
            quantity?: number;
            page?: string;
            schedule?: {
              date: string;
              title: string;
              occasion: string;
              productIds: string[];
              accessoriesNote?: string;
            };
          }>;
          error?: string;
        }>(resp, 'Assistant unavailable.');

        if (!resp.ok) {
          throw new Error(data.error || 'Assistant unavailable.');
        }

        for (const action of data.cartActions || []) {
          if (action.type === 'add' && action.productId) {
            const prod = products.find((p) => p.id === action.productId);
            if (prod) addToCart(prod, action.size, action.color, action.quantity || 1);
          } else if (action.type === 'update' && action.productId) {
            const match = cart.find((c) => c.productId === action.productId);
            if (match) updateCartQty(match.id, action.quantity || 1);
          } else if (action.type === 'remove' && action.productId) {
            const match = cart.find((c) => c.productId === action.productId);
            if (match) removeFromCart(match.id);
          } else if (action.type === 'open_cart') {
            setCartOpen(true);
          } else if (action.type === 'open_checkout') {
            setCheckoutOpen(true);
          } else if (action.type === 'navigate' && action.page) {
            navigate(action.page as PageId);
          } else if (action.type === 'schedule_outfit' && action.schedule) {
            if (user) {
              void saveSchedule({
                date: action.schedule.date,
                title: action.schedule.title,
                occasion: action.schedule.occasion,
                productIds: action.schedule.productIds,
                accessoriesNote: action.schedule.accessoriesNote,
                reminderEnabled: true,
              });
            } else {
              notify('Sign in with Google to save this planned look to your Outfit Calendar.', 'info');
            }
          }
        }

        const replyText = data.reply || 'Here is what I curated for you from IMMERSO.';
        const replyTtsLang: TtsLang =
          data.detectedLanguage || (containsUrduScript(replyText) ? 'ur' : effectiveLang);
        setActiveTtsLang(replyTtsLang);

        const botMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: replyText,
          products: data.products || [],
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMsg]);
        void speakResponse(replyText, replyTtsLang);
      } catch (err) {
        const msg = toFriendlyNetworkError(err, 'Unable to reach IMMERSO concierge.');
        setRobotState('idle');
        setLiveSubtitle(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            text: `I encountered an issue: ${msg}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
    [
      addToCart,
      cart,
      langMode,
      messages,
      navigate,
      notify,
      products,
      removeFromCart,
      robotState,
      saveSchedule,
      schedules,
      setCartOpen,
      setCheckoutOpen,
      speakResponse,
      stopAllSpeech,
      updateCartQty,
      user,
      userProfile,
      wardrobe,
      weather,
    ]
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const toggleVoiceListening = async () => {
    if (robotState === 'listening' && recognitionRef.current) {
      recognitionRef.current.stop();
      setRobotState('idle');
      return;
    }

    stopAllSpeech();

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      notify('Speech recognition is not supported in this browser. Please type your request below.', 'info');
      return;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }

      const recognition = new SpeechRec();
      const micLang: TtsLang = langMode === 'ur' ? 'ur' : langMode === 'en' ? 'en' : activeTtsLang;
      recognition.lang = micLang === 'ur' ? 'ur-PK' : 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const latestIdx = event.results.length - 1;
        const resultItem = event.results[latestIdx] as ArrayLike<{ transcript: string }> & {
          isFinal?: boolean;
        };
        const transcript = resultItem?.[0]?.transcript || '';
        setInterimTranscript(transcript);
        setLiveSubtitle(transcript ? transcript : 'Listening...');

        if (resultItem?.isFinal && transcript.trim()) {
          setRobotState('idle');
          void sendMessageRef.current(transcript);
        }
      };

      recognition.onerror = (event) => {
        setRobotState('idle');
        setInterimTranscript('');
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          notify('Microphone permission was denied. Enable mic access or type below.', 'error');
        } else if (event.error !== 'aborted') {
          notify(`Voice capture stopped (${event.error}).`, 'info');
        }
      };

      recognition.onend = () => {
        setRobotState((prev) => (prev === 'listening' ? 'idle' : prev));
      };

      recognitionRef.current = recognition;
      setRobotState('listening');
      setLiveSubtitle(micLang === 'ur' ? 'Sun rahi hoon... (Listening in Urdu)' : 'Listening... Speak naturally');
      recognition.start();
    } catch {
      setRobotState('idle');
      notify('Could not access microphone. Please grant permission or use text input.', 'error');
    }
  };

  const latestAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const latestProducts = latestAssistantMsg?.products || [];
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const stateLabel =
    robotState === 'listening'
      ? 'Listening'
      : robotState === 'thinking'
      ? 'Styling & Searching'
      : robotState === 'speaking'
      ? 'Speaking'
      : 'Ready';

  const activeSubtitleText = interimTranscript || liveSubtitle || latestAssistantMsg?.text || '';
  const subtitleRtl = containsUrduScript(activeSubtitleText);

  const langBadgeLabel = langMode === 'auto' ? 'AUTO' : langMode.toUpperCase();
  const langSubtitle =
    langMode === 'auto'
      ? 'EN · Urdu · Roman Urdu'
      : langMode === 'ur'
      ? 'Urdu / Roman Urdu'
      : 'English';

  return (
    <>
      {/* Minimized Floating 3D Concierge Launcher */}
      {!isChatOpen && (
        <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 max-w-[calc(100vw-24px)] flex items-center gap-2 bg-[#16110E] text-[#FDFBF7] p-1.5 pr-3 sm:pr-3.5 rounded-2xl shadow-2xl border border-[#B5945B]/45 hover:border-[#DFC085] transition-all">
          <button
            onClick={() => setChatOpen(true)}
            aria-label="Open IMMERSO 3D AI Robot Concierge"
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer text-left min-w-0"
          >
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-[#B5945B]/40 bg-[#16110E] shrink-0">
              <Suspense fallback={<RobotStageFallback compact />}>
                <RobotAssistant3D
                  robotState="idle"
                  speechAmplitudeRef={speechAmplitudeRef}
                  compact
                />
              </Suspense>
            </div>
            <div className="pr-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#DFC085] shrink-0" />
                <span className="text-[10px] uppercase tracking-[0.16em] text-[#DFC085] font-semibold truncate">
                  Aurora 3D AI
                </span>
              </div>
              <p className="font-editorial text-sm sm:text-base font-medium leading-tight text-[#FDFBF7] truncate">
                IMMERSO Concierge
              </p>
              <p className="text-[10px] sm:text-[11px] text-[#B8AE9F] truncate">
                EN · Urdu · Roman Urdu
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Main Futuristic 3D Robot AI Assistant Stage */}
      {isChatOpen && (
        <div
          className={`fixed inset-0 h-[100dvh] sm:inset-auto sm:bottom-5 sm:right-5 z-50 flex flex-col bg-[#16110E] text-[#FDFBF7] sm:rounded-3xl shadow-[0_24px_80px_rgba(10,8,6,0.65)] border-0 sm:border sm:border-[#B5945B]/45 overflow-hidden transition-all duration-300 ${
            isExpanded
              ? 'sm:w-[min(740px,94vw)] sm:h-[min(860px,92dvh)]'
              : 'sm:w-[440px] lg:w-[500px] sm:h-[min(760px,92dvh)]'
          }`}
        >
          {/* Minimal Top Bar */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1E1713] border-b border-[#B5945B]/25 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-[#DFC085] shrink-0" />
              <div className="min-w-0">
                <p className="font-editorial text-base sm:text-lg font-medium leading-none truncate">
                  AURORA · IMMERSO AI
                </p>
                <p className="text-[10px] sm:text-[11px] text-[#DFC085] mt-1 font-medium truncate">
                  {stateLabel} · {langSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={cycleLangMode}
                title="Cycle language mode: Auto-Detect / English / Urdu"
                className="px-2 py-1 text-[10px] sm:text-[11px] font-semibold bg-[#2B221D] border border-[#B5945B]/30 rounded-lg hover:bg-[#3A2E27] text-[#DFC085] cursor-pointer"
              >
                {langBadgeLabel}
              </button>

              <button
                onClick={() => setIsMuted((m) => !m)}
                aria-label={isMuted ? 'Unmute AI voice' : 'Mute AI voice'}
                title={isMuted ? 'Unmute AI voice' : 'Mute AI voice'}
                className="p-1.5 rounded-lg bg-[#2B221D] border border-[#B5945B]/25 hover:bg-[#3A2E27] cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-[#9E9487]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#DFC085]" />
                )}
              </button>

              <button
                onClick={() => setCartOpen(true)}
                aria-label="Open Shopping Bag"
                className="relative p-1.5 rounded-lg bg-[#2B221D] border border-[#B5945B]/25 hover:bg-[#3A2E27] cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#FDFBF7]" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[9px] font-mono-num bg-[#B5945B] text-[#16110E] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsExpanded((e) => !e)}
                aria-label={isExpanded ? 'Compact stage' : 'Expand stage'}
                className="hidden sm:inline-flex p-1.5 rounded-lg bg-[#2B221D] border border-[#B5945B]/25 hover:bg-[#3A2E27] cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setChatOpen(false)}
                aria-label="Close AI Concierge"
                className="p-1.5 rounded-lg bg-[#2B221D] border border-[#B5945B]/25 hover:bg-[#3A2E27] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Primary 3D Robot Stage */}
          <div className="relative flex-1 min-h-[155px] sm:min-h-[260px] bg-[#16110E] overflow-hidden">
            <Suspense fallback={<RobotStageFallback />}>
              <RobotAssistant3D
                robotState={robotState}
                speechAmplitudeRef={speechAmplitudeRef}
              />
            </Suspense>

            {(robotState === 'listening' || robotState === 'speaking') && (
              <div className="pointer-events-none absolute top-2.5 left-2.5 sm:top-3 sm:left-3 px-2.5 py-1 rounded-lg bg-[#16110E]/85 border border-[#B5945B]/35 text-[11px] text-[#DFC085] flex items-center gap-2">
                <span className="font-medium">
                  {robotState === 'listening' ? 'Mic Active' : 'Audio Output'}
                </span>
                <span className="inline-flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-[#DFC085] h-1.5 animate-[bounce_0.7s_infinite]" />
                  <span className="w-0.5 bg-[#DFC085] h-3 animate-[bounce_0.55s_infinite_0.1s]" />
                  <span className="w-0.5 bg-[#DFC085] h-2 animate-[bounce_0.65s_infinite_0.2s]" />
                </span>
              </div>
            )}

            {/* Live Conversation Subtitles Strip */}
            {activeSubtitleText && (
              <div className="pointer-events-none absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-[#120E0C]/92 border border-[#B5945B]/35 shadow-lg">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#DFC085] mb-0.5">
                  {robotState === 'listening'
                    ? 'Live Voice Input'
                    : robotState === 'thinking'
                    ? 'Aurora · Processing'
                    : 'Aurora · Live Subtitle'}
                </p>
                <p
                  dir={subtitleRtl ? 'rtl' : 'ltr'}
                  className={`text-xs leading-relaxed text-[#FDFBF7] line-clamp-2 sm:line-clamp-3 ${
                    subtitleRtl ? 'text-right leading-loose' : ''
                  }`}
                >
                  {activeSubtitleText}
                </p>
              </div>
            )}
          </div>

          {/* Interactive Results, Matched Product Cards & Expandable History */}
          <div className="bg-[#1B1512] border-t border-[#B5945B]/25 flex flex-col max-h-[38dvh] sm:max-h-[42%] shrink-0">
            <div className="px-3 sm:px-3.5 py-2 flex items-center justify-between gap-2 border-b border-[#B5945B]/15">
              <button
                onClick={() => setShowTranscript((s) => !s)}
                className="inline-flex items-center gap-1.5 text-[11px] text-[#DFC085] hover:underline cursor-pointer truncate"
              >
                {showTranscript ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronUp className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">
                  {showTranscript ? 'Hide Conversation Log' : `Conversation Log (${messages.length})`}
                </span>
              </button>

              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                {latestAssistantMsg && !isMuted && (
                  <button
                    onClick={() =>
                      void speakResponse(
                        latestAssistantMsg.text,
                        containsUrduScript(latestAssistantMsg.text) ? 'ur' : activeTtsLang
                      )
                    }
                    className="text-[11px] text-[#C8BEB0] hover:text-[#FDFBF7] cursor-pointer"
                  >
                    Replay
                  </button>
                )}
                {cart.length > 0 && (
                  <button
                    onClick={() => setCheckoutOpen(true)}
                    className="text-[11px] font-semibold text-[#DFC085] hover:underline cursor-pointer"
                  >
                    Bag ({cartCount}) · {formatPkr(totalPkr)}
                  </button>
                )}
              </div>
            </div>

            <div
              ref={scrollRef}
              className="overflow-y-auto px-3 sm:px-3.5 py-2.5 space-y-2.5 max-h-[26dvh] sm:max-h-[220px]"
            >
              {showTranscript ? (
                messages.map((msg) => {
                  const rtl = containsUrduScript(msg.text);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        dir={rtl ? 'rtl' : 'ltr'}
                        className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed break-words ${
                          rtl ? 'text-right leading-loose' : ''
                        } ${
                          msg.role === 'user'
                            ? 'bg-[#B5945B] text-[#16110E] font-medium'
                            : 'bg-[#251E1A] border border-[#B5945B]/20 text-[#FDFBF7]'
                        }`}
                      >
                        {msg.text}
                      </div>
                      {msg.products && msg.products.length > 0 && (
                        <div className={`w-full grid grid-cols-1 gap-2 mt-2 ${isExpanded ? 'sm:grid-cols-2' : ''}`}>
                          {msg.products.map((prod) => (
                            <ChatProductCard
                              key={prod.id}
                              product={prod}
                              onAdd={(p, s, c, q) => addToCart(p, s, c, q)}
                              onBuyNow={(p, s, c, q) => {
                                addToCart(p, s, c, q);
                                setCheckoutOpen(true);
                              }}
                              onInspect={(p) => openProductModal(p)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : latestProducts.length > 0 ? (
                <div className={`grid gap-2 ${isExpanded ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                  {latestProducts.map((prod) => (
                    <ChatProductCard
                      key={prod.id}
                      product={prod}
                      onAdd={(p, s, c, q) => addToCart(p, s, c, q)}
                      onBuyNow={(p, s, c, q) => {
                        addToCart(p, s, c, q);
                        setCheckoutOpen(true);
                      }}
                      onInspect={(p) => openProductModal(p)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#B8AE9F] py-1">
                  <span className="min-w-0">
                    Ask in English, Urdu, or Roman Urdu about outfits, bags, or wardrobe.
                  </span>
                  <button
                    onClick={() => navigate('planner')}
                    className="inline-flex items-center gap-1 text-[#DFC085] hover:underline shrink-0 cursor-pointer"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>Planner</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Unified Command Dock */}
          <div className="bg-[#14100D] border-t border-[#B5945B]/25 p-2.5 sm:p-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] space-y-2 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => void sendMessage(q)}
                  className="px-2.5 py-1 bg-[#231D19] border border-[#B5945B]/25 rounded-lg text-[11px] text-[#E8DFD1] whitespace-nowrap shrink-0 hover:border-[#DFC085] cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(input);
              }}
              className="flex items-center gap-1.5 sm:gap-2 min-w-0"
            >
              <button
                type="button"
                onClick={() => void toggleVoiceListening()}
                aria-label={robotState === 'listening' ? 'Stop microphone' : 'Speak to Aurora'}
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                  robotState === 'listening'
                    ? 'bg-[#2E7D67] text-white border-[#7BE3C4]'
                    : 'bg-[#231D19] text-[#DFC085] border-[#B5945B]/35 hover:bg-[#312822]'
                }`}
              >
                {robotState === 'listening' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                dir={containsUrduScript(input) ? 'rtl' : 'ltr'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  robotState === 'listening'
                    ? 'Listening...'
                    : 'Type in English, Urdu or Roman Urdu...'
                }
                className="flex-1 min-w-0 text-xs bg-[#211B17] text-[#FDFBF7] placeholder-[#8E8579] border border-[#B5945B]/25 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#DFC085]"
              />

              <button
                type="submit"
                disabled={!input.trim() || robotState === 'thinking'}
                aria-label="Send message"
                className="p-2.5 bg-[#B5945B] text-[#16110E] rounded-xl font-semibold hover:bg-[#CCA86B] disabled:opacity-40 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
