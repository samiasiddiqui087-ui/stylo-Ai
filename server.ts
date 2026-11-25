import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import type { CartItem, OutfitSchedule, Product, WardrobeItem, WeatherInfo } from './src/types/immerso.ts';
import { containsUrduScript, detectConversationLanguage } from './src/lib/language.ts';
import {
  AuthenticatedAdminRequest,
  getAdminAuditLogs,
  handleAdminChangePassword,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminSessionStatus,
  recordAdminAudit,
  requireAdminAuth,
} from './server/adminAuth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use((req: Request, _res: Response, next: NextFunction) => {
  const anyReq = req as Request & { _body?: boolean; readableEnded?: boolean };
  if (anyReq.readableEnded && anyReq.body !== undefined && !anyReq._body) {
    anyReq._body = true;
  }
  next();
});
app.use(express.json({ limit: '12mb' }));

const PORT = Number(process.env.PORT) || 3000;

// Shared server-side Gemini client (API key stays strictly on server)
function getAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      timeout: apiVersion ? 22_000 : 15_000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getErrorStatus(error: unknown): number {
  const errObj = error as { status?: number; name?: string; message?: string };
  if (typeof errObj?.status === 'number' && errObj.status >= 400 && errObj.status < 600) {
    return errObj.status;
  }
  if (errObj?.name === 'AbortError') return 504;
  const msg = String(errObj?.message || '');
  if (msg.includes('429') || /quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  if (msg.includes('503') || /UNAVAILABLE|high demand/i.test(msg)) return 503;
  if (msg.includes('504') || /DEADLINE_EXCEEDED|timed?\s*out|abort/i.test(msg)) return 504;
  return 500;
}

function formatAiError(error: unknown, fallback: string): string {
  const status = getErrorStatus(error);
  if (status === 429) {
    return 'AI service is temporarily busy due to rate limits. Please try again in a moment.';
  }
  if (status === 503) {
    return 'AI styling model is experiencing brief high demand. Please try again in a few seconds.';
  }
  if (status === 504) {
    return 'The AI request timed out. Please try a shorter message or try again.';
  }
  const raw = error instanceof Error ? error.message : '';
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // not JSON
  }
  return raw || fallback;
}

const PRIMARY_TEXT_MODEL = 'gemini-4-hydrogen';
const FALLBACK_TEXT_MODEL = 'gemini-3.1-flash-lite';
let primaryCooldownUntil = 0;

function isRetryableQuotaOrTransient(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === 429 || status === 503 || status === 504;
}

async function generateWithFallback(
  ai: GoogleGenAI,
  request: {
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
    config?: Record<string, unknown>;
  },
  preferredModel?: string
) {
  const now = Date.now();
  const baseOrder =
    now < primaryCooldownUntil
      ? [FALLBACK_TEXT_MODEL, FALLBACK_TEXT_MODEL]
      : [PRIMARY_TEXT_MODEL, FALLBACK_TEXT_MODEL];
  let modelsToTry = preferredModel
    ? preferredModel === FALLBACK_TEXT_MODEL
      ? [FALLBACK_TEXT_MODEL, FALLBACK_TEXT_MODEL]
      : Array.from(new Set([preferredModel, FALLBACK_TEXT_MODEL, PRIMARY_TEXT_MODEL]))
    : baseOrder;

  if (now < primaryCooldownUntil) {
    const filtered = modelsToTry.filter((m) => m !== PRIMARY_TEXT_MODEL);
    if (filtered.length > 0) modelsToTry = filtered;
  }

  let lastError: unknown;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const hasNextFallback = i < modelsToTry.length - 1;
    const attemptAbort = hasNextFallback ? new AbortController() : null;
    const attemptTimer = attemptAbort ? setTimeout(() => attemptAbort.abort(), 8_500) : null;

    try {
      const cfg = { ...(request.config || {}) };
      if (model === FALLBACK_TEXT_MODEL && 'thinkingConfig' in cfg) {
        delete cfg.thinkingConfig;
      }
      if (attemptAbort && !('abortSignal' in cfg)) {
        cfg.abortSignal = attemptAbort.signal;
      }
      const response = await ai.models.generateContent({
        model,
        contents: request.contents,
        config: cfg,
      });
      return { response, usedModel: model };
    } catch (err) {
      lastError = err;
      const errStatus = getErrorStatus(err);
      const isAborted = err instanceof Error && /abort/i.test(err.name + ' ' + err.message);
      if (model === PRIMARY_TEXT_MODEL) {
        if (errStatus === 429) {
          primaryCooldownUntil = Date.now() + 5 * 60_000;
        } else if (errStatus === 503 || errStatus === 504 || isAborted) {
          primaryCooldownUntil = Date.now() + 2 * 60_000;
        }
      }
      if (!isRetryableQuotaOrTransient(err) && !isAborted) {
        throw err;
      }
      if (hasNextFallback) {
        await new Promise((r) => setTimeout(r, 250));
      }
    } finally {
      if (attemptTimer) clearTimeout(attemptTimer);
    }
  }
  throw lastError;
}

// Simple in-memory rate limiting per IP for AI endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxRequests = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'IMMERSO Backend', timestamp: new Date().toISOString() });
});

// SEO: robots.txt & sitemap.xml
app.get('/robots.txt', (_req: Request, res: Response) => {
  const baseUrl = process.env.APP_URL || 'https://immerso.fashion';
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (_req: Request, res: Response) => {
  const baseUrl = process.env.APP_URL || 'https://immerso.fashion';
  const routes = ['', '/?page=shop', '/?page=collections', '/?page=ai-stylist', '/?page=wardrobe', '/?page=planner', '/?page=outfit-generator', '/?page=inspiration', '/?page=order-tracking', '/?page=about', '/?page=contact'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map((r) => `  <url><loc>${baseUrl}${r}</loc><changefreq>daily</changefreq></url>`)
    .join('\n')}\n</urlset>`;
  res.type('application/xml').send(xml);
});

// Real Weather API via Open-Meteo (no fabricated weather)
function mapWeatherCode(code: number): { condition: string; isRainy: boolean } {
  if (code === 0) return { condition: 'Clear Sky', isRainy: false };
  if (code <= 3) return { condition: 'Partly Cloudy', isRainy: false };
  if (code <= 48) return { condition: 'Misty / Foggy', isRainy: false };
  if (code <= 67 || (code >= 80 && code <= 82)) return { condition: 'Rain Showers', isRainy: true };
  if (code <= 77) return { condition: 'Snow / Cold Crisp', isRainy: false };
  if (code >= 95) return { condition: 'Thunderstorm', isRainy: true };
  return { condition: 'Mild Breeze', isRainy: false };
}

function getWeatherStylingTip(tempC: number, isRainy: boolean): string {
  if (isRainy) {
    return 'Opt for water-resistant trench outerwear, darker silk tones, and closed-toe leather or suede footwear.';
  }
  if (tempC >= 28) {
    return 'Breathable Belgian linen tailoring, fluid silk midis, and light ivory palettes keep your silhouette crisp.';
  }
  if (tempC >= 18) {
    return 'Ideal transitional weather for structured blazers layered over fine silk or knitwear separates.';
  }
  return 'Rich wool-cashmere coats, tonal knitwear layering, and structured leather accessories add warmth with polish.';
}

app.get('/api/weather', async (req: Request, res: Response) => {
  try {
    const cityParam = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const latParam = req.query.lat ? Number(req.query.lat) : NaN;
    const lonParam = req.query.lon ? Number(req.query.lon) : NaN;

    let lat = 24.8607;
    let lon = 67.0011;
    let resolvedCity = 'Karachi';

    if (!Number.isNaN(latParam) && !Number.isNaN(lonParam)) {
      lat = latParam;
      lon = lonParam;
      resolvedCity = cityParam || 'Current Location';
    } else {
      const targetCity = cityParam || 'Karachi';
      const geoResp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(targetCity)}&count=1&language=en&format=json`
      );
      if (geoResp.ok) {
        const geoJson = (await geoResp.json()) as {
          results?: Array<{ latitude: number; longitude: number; name: string; country?: string }>;
        };
        if (geoJson.results && geoJson.results.length > 0) {
          lat = geoJson.results[0].latitude;
          lon = geoJson.results[0].longitude;
          resolvedCity = geoJson.results[0].name;
        }
      }
    }

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
    const weatherResp = await fetch(forecastUrl);
    if (!weatherResp.ok) {
      return res.status(502).json({ error: 'Weather service temporarily unavailable.' });
    }

    const wData = (await weatherResp.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
      };
    };

    const currentTemp = Math.round(wData.current?.temperature_2m ?? 24);
    const currentMapped = mapWeatherCode(wData.current?.weather_code ?? 0);

    const payload: WeatherInfo = {
      city: resolvedCity,
      temperatureC: currentTemp,
      condition: currentMapped.condition,
      isRainy: currentMapped.isRainy,
      humidity: wData.current?.relative_humidity_2m,
      windKmh: wData.current?.wind_speed_10m,
      stylingTip: getWeatherStylingTip(currentTemp, currentMapped.isRainy),
      dailyForecast: (wData.daily?.time || []).map((date, idx) => ({
        date,
        maxC: Math.round(wData.daily?.temperature_2m_max[idx] ?? currentTemp),
        minC: Math.round(wData.daily?.temperature_2m_min[idx] ?? currentTemp - 5),
        condition: mapWeatherCode(wData.daily?.weather_code[idx] ?? 0).condition,
      })),
    };

    res.json(payload);
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ error: 'Unable to retrieve live weather data.' });
  }
});

// AI Personal Stylist Endpoint (Gemini 4 Hydrogen + Multimodal Image Support)
app.post('/api/ai/stylist', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many styling requests. Please wait a moment.' });
  }

  try {
    const {
      message,
      history = [],
      catalog = [],
      wardrobe = [],
      weather = null,
      imageBase64,
      imageMimeType,
      preferences,
    } = req.body as {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
      catalog?: Product[];
      wardrobe?: WardrobeItem[];
      weather?: WeatherInfo | null;
      imageBase64?: string;
      imageMimeType?: string;
      preferences?: { preferredStyle?: string; preferredColors?: string[]; preferredSize?: string };
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Prompt message is required.' });
    }

    const safeCatalog = Array.isArray(catalog) ? catalog : [];
    const safeWardrobe = Array.isArray(wardrobe) ? wardrobe : [];
    const safeHistory = Array.isArray(history) ? history : [];
    const detectedLang = detectConversationLanguage(message);

    const ai = getAiClient();

    const catalogSummary = safeCatalog.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      brand: p.brand,
      pricePkr: p.pricePkr,
      colors: p.colors,
      sizes: p.sizes,
      stock: p.stock,
      occasion: p.occasion,
      season: p.season,
    }));

    const wardrobeSummary = safeWardrobe.map((w) => ({
      name: w.name,
      category: w.category,
      color: w.color,
      season: w.season,
      size: w.size,
      brand: w.brand,
    }));

    const stylistLangDirective =
      detectedLang.scriptMode === 'urdu-script'
        ? 'The client wrote in Urdu script (اردو). Reply naturally in eloquent, fluent Urdu script while keeping exact product names and Rs. prices clearly readable.'
        : detectedLang.scriptMode === 'roman-urdu'
          ? 'The client wrote in Roman Urdu (Urdu written in Latin letters). Reply warmly in natural Roman Urdu while keeping exact product names and Rs. prices clear.'
          : 'Respond in crisp, refined luxury editorial English.';

    const systemInstruction = `You are the IMMERSO Personal AI Fashion Stylist — refined, knowledgeable, warm, and luxury-editorial in tone.
Always ground product recommendations ONLY in the real IMMERSO catalog provided below. NEVER invent products, prices, discounts, or stock counts.
If the user owns items in their Virtual Wardrobe, weave those pieces harmoniously with IMMERSO pieces.
Respect PKR budgets strictly. Mention specific PKR prices, colors, sizes, and styling reasoning.
If an image of clothing is uploaded, analyze its silhouette, color, fabric feel, and suggest matching colors, occasions, and complementary IMMERSO pieces.
Keep responses well-structured, concise, and practical (under 220 words unless a full wardrobe audit is asked).
Language matching rule: ${stylistLangDirective}

LIVE CONTEXT:
- Weather: ${weather ? `${weather.city}, ${weather.temperatureC}°C, ${weather.condition}. Tip: ${weather.stylingTip}` : 'Not provided'}
- User Preferences: ${preferences ? JSON.stringify(preferences) : 'Not set'}
- User Virtual Wardrobe (${wardrobeSummary.length} items): ${JSON.stringify(wardrobeSummary.slice(0, 25))}
- Real IMMERSO Product Catalog (${catalogSummary.length} items): ${JSON.stringify(catalogSummary)}

Also return JSON in the exact schema requested so the UI can display matching product cards alongside your reply.`;

    const recentTurns = safeHistory
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'Client' : 'IMMERSO Stylist'}: ${m.text}`)
      .join('\n');

    const promptText = recentTurns
      ? `Previous conversation:\n${recentTurns}\n\nClient: ${message}`
      : message;

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
    if (imageBase64 && imageMimeType) {
      const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          data: cleaned,
          mimeType: imageMimeType,
        },
      });
    }
    parts.push({ text: promptText });

    const { response } = await generateWithFallback(ai, {
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'Editorial styling response to the client.',
            },
            recommendedProductIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'IDs of real IMMERSO catalog products recommended in the reply.',
            },
            colorPalette: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Suggested matching color names.',
            },
          },
          required: ['reply', 'recommendedProductIds'],
        },
      },
    });

    const rawText = (response.text ?? '{}')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    let parsed: {
      reply?: string;
      recommendedProductIds?: string[];
      colorPalette?: string[];
    } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { reply: rawText || "Here is my tailored styling recommendation from IMMERSO's collection." };
    }

    const validIds = new Set(safeCatalog.map((p) => p.id));
    const matchedProducts = (parsed.recommendedProductIds || [])
      .filter((id) => validIds.has(id))
      .map((id) => safeCatalog.find((p) => p.id === id)!)
      .slice(0, 4);

    res.json({
      reply: parsed.reply || "Here is my tailored styling recommendation from IMMERSO's collection.",
      products: matchedProducts,
      colorPalette: parsed.colorPalette || [],
    });
  } catch (error) {
    console.error('AI Stylist error:', error);
    res.status(getErrorStatus(error)).json({ error: formatAiError(error, 'AI Stylist request failed.') });
  }
});

// IMMERSO 3D AI Concierge & Shopping Assistant (Gemini 4 Hydrogen + Catalog, Wardrobe, Planner & Cart Tools)
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many assistant requests. Please pause briefly.' });
  }

  try {
    const {
      message,
      history = [],
      catalog = [],
      cart = [],
      wardrobe = [],
      schedules = [],
      weather = null,
      preferences,
      language = 'auto',
    } = req.body as {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
      catalog?: Product[];
      cart?: CartItem[];
      wardrobe?: WardrobeItem[];
      schedules?: OutfitSchedule[];
      weather?: WeatherInfo | null;
      preferences?: { preferredStyle?: string; preferredColors?: string[]; preferredSize?: string };
      language?: 'auto' | 'en' | 'ur';
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const safeCatalog = Array.isArray(catalog) ? catalog : [];
    const safeHistory = Array.isArray(history) ? history : [];
    const safeCart = Array.isArray(cart) ? cart : [];
    const safeWardrobe = Array.isArray(wardrobe) ? wardrobe : [];
    const safeSchedules = Array.isArray(schedules) ? schedules : [];

    const detected = detectConversationLanguage(message);
    const effectiveTtsLang: 'en' | 'ur' =
      language === 'en' ? 'en' : language === 'ur' ? 'ur' : detected.ttsLang;
    const effectiveScriptMode =
      language === 'en'
        ? 'english'
        : language === 'ur' && detected.scriptMode === 'english'
          ? 'roman-urdu'
          : detected.scriptMode;

    const ai = getAiClient();

    const catalogSnapshot = safeCatalog.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      pricePkr: p.pricePkr,
      colors: p.colors,
      sizes: p.sizes,
      stock: p.stock,
      occasion: p.occasion,
      season: p.season,
      isNewArrival: p.isNewArrival,
      isBestSeller: p.isBestSeller,
    }));

    const wardrobeSummary = safeWardrobe.slice(0, 25).map((w) => ({
      name: w.name,
      category: w.category,
      color: w.color,
      season: w.season,
      size: w.size,
      brand: w.brand,
    }));

    const scheduleSummary = safeSchedules.slice(0, 12).map((s) => ({
      date: s.date,
      title: s.title,
      occasion: s.occasion,
    }));

    const todayIso = new Date().toISOString().slice(0, 10);

    const languageDirective =
      effectiveScriptMode === 'urdu-script'
        ? 'CRITICAL LANGUAGE RULE: The client wrote in Urdu script (اردو). Write "reply" naturally, warmly, and politely in fluent Urdu script (اردو). Keep exact product names and PKR prices (e.g., Rs. 36,500) clear and accurate.'
        : effectiveScriptMode === 'roman-urdu'
          ? 'CRITICAL LANGUAGE RULE: The client wrote in Roman Urdu (Urdu written with Latin/English letters, e.g., "mujhe black dress dikhao"). Write "reply" naturally and warmly in conversational Roman Urdu using Latin letters! Do NOT switch to Urdu Arabic script and do NOT reply in pure English. Keep exact product names and Rs. prices clear.'
          : 'CRITICAL LANGUAGE RULE: The client wrote in English. Write "reply" in crisp, warm, editorial English.';

    const systemInstruction = `You are AURORA, the luxury 3D AI fashion concierge and shopping assistant for IMMERSO.
You communicate naturally via both voice and text in a warm, intelligent, editorial luxury tone across English, Urdu script, and Roman Urdu.

CAPABILITIES & STRICT RULES:
1. NEVER invent products, prices, discounts, or stock counts. Recommend ONLY real product IDs from the Real IMMERSO Catalog below.
2. Put matching catalog product IDs (up to 4) into "recommendedProductIds" whenever the user asks to find, compare, pair, or view outfits, dresses, handbags, accessories, jewellery, shoes, kaftans, or blazers (whether asked in English, Urdu, or Roman Urdu).
3. Respect PKR budgets strictly: if no catalog item fits the requested budget or filters, leave "recommendedProductIds" empty and honestly explain in the user's language without inventing fake items.
4. For accessory/handbag/shoes pairing questions, pick real complementary handbags/jewellery/heels from the catalog in "recommendedProductIds" and explain why they pair well.
5. For wardrobe organization or outfit planning questions, reference the customer's actual Virtual Wardrobe (${wardrobeSummary.length} items), upcoming scheduled outfits (${scheduleSummary.length}), and live weather. If they ask to schedule a look, populate "scheduleOutfit". If they ask to open a page, set "navigatePage" to one of: wardrobe, planner, shop, collections, ai-stylist, outfit-generator, virtual-tryon, inspiration, order-tracking.
6. Only include items in "cartActions" when the user explicitly asks to add/update/remove cart items or open cart/checkout.
7. Remember conversation context seamlessly across turns even if the client switches between English, Roman Urdu, and Urdu script mid-conversation — preserve budget, color, occasion, and discussed pieces without generic repeated greetings.
8. ${languageDirective}
9. Keep "reply" concise and voice-friendly (2 to 4 natural sentences, NO markdown syntax like ** or ### since it is spoken aloud and displayed as live subtitles).

LIVE CONTEXT (Today: ${todayIso}):
- Weather: ${weather ? `${weather.city}, ${weather.temperatureC}°C, ${weather.condition}` : 'Not provided'}
- User Preferences: ${preferences ? JSON.stringify(preferences) : 'Not set'}
- Current Cart (${safeCart.length} items): ${JSON.stringify(safeCart)}
- Virtual Wardrobe (${wardrobeSummary.length} items): ${JSON.stringify(wardrobeSummary)}
- Upcoming Schedules: ${JSON.stringify(scheduleSummary)}
- Real IMMERSO Catalog (${catalogSnapshot.length} items): ${JSON.stringify(catalogSnapshot)}`;

    const historyText = safeHistory
      .slice(-10)
      .map((m) => `${m.role === 'user' ? 'Client' : 'AURORA'}: ${m.text}`)
      .join('\n');

    const userContent = historyText ? `${historyText}\nClient: ${message}` : message;

    const { response } = await generateWithFallback(
      ai,
      {
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Concise 2-4 sentence spoken-ready response in the exact matching language/script, with no markdown symbols.',
              },
              recommendedProductIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Real catalog product IDs matching the user query (empty array if none match).',
              },
              cartAdditions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    size: { type: Type.STRING },
                    color: { type: Type.STRING },
                    quantity: { type: Type.INTEGER },
                  },
                  required: ['productId', 'quantity'],
                },
              },
              cartUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    quantity: { type: Type.INTEGER },
                  },
                  required: ['productId', 'quantity'],
                },
              },
              openTarget: {
                type: Type.STRING,
                description: 'Optional: "cart" or "checkout" if user asked to view bag or checkout.',
              },
              navigatePage: {
                type: Type.STRING,
                description: 'Optional target page slug if user asked to navigate.',
              },
              scheduleOutfit: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  title: { type: Type.STRING },
                  occasion: { type: Type.STRING },
                  productIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  accessoriesNote: { type: Type.STRING },
                },
                required: ['date', 'title', 'occasion', 'productIds'],
              },
            },
            required: ['reply', 'recommendedProductIds'],
          },
        },
      },
      FALLBACK_TEXT_MODEL
    );

    const rawText = (response.text ?? '{}')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    let parsed: {
      reply?: string;
      recommendedProductIds?: string[];
      cartAdditions?: Array<{ productId: string; size?: string; color?: string; quantity?: number }>;
      cartUpdates?: Array<{ productId: string; quantity: number }>;
      openTarget?: string;
      navigatePage?: string;
      scheduleOutfit?: {
        date: string;
        title: string;
        occasion: string;
        productIds: string[];
        accessoriesNote?: string;
      };
    } = {};

    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { reply: rawText || 'How may I curate your wardrobe or assist your shopping today?' };
    }

    const validCatalogMap = new Map(safeCatalog.map((p) => [p.id, p]));
    const matchedProducts: Product[] = [];
    const seenIds = new Set<string>();
    for (const id of parsed.recommendedProductIds || []) {
      const prod = validCatalogMap.get(String(id));
      if (prod && !seenIds.has(prod.id) && matchedProducts.length < 6) {
        matchedProducts.push(prod);
        seenIds.add(prod.id);
      }
    }

    const cartActions: Array<{
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
    }> = [];

    for (const item of parsed.cartAdditions || []) {
      const product = validCatalogMap.get(String(item.productId || ''));
      if (product && product.stock > 0) {
        const size = item.size && product.sizes.includes(item.size) ? item.size : product.sizes[0] || 'One Size';
        const color = item.color && product.colors.includes(item.color) ? item.color : product.colors[0] || 'Default';
        const quantity = Math.max(1, Math.min(product.stock, Number(item.quantity || 1)));
        cartActions.push({ type: 'add', productId: product.id, size, color, quantity });
        if (!seenIds.has(product.id)) {
          matchedProducts.unshift(product);
          seenIds.add(product.id);
        }
      }
    }

    for (const upd of parsed.cartUpdates || []) {
      const pid = String(upd.productId || '');
      if (pid) {
        const q = Number(upd.quantity ?? 0);
        cartActions.push(q <= 0 ? { type: 'remove', productId: pid } : { type: 'update', productId: pid, quantity: q });
      }
    }

    if (parsed.openTarget === 'cart' || parsed.openTarget === 'checkout') {
      cartActions.push({ type: parsed.openTarget === 'cart' ? 'open_cart' : 'open_checkout' });
    }

    const allowedPages = new Set([
      'wardrobe',
      'planner',
      'shop',
      'collections',
      'ai-stylist',
      'outfit-generator',
      'virtual-tryon',
      'inspiration',
      'order-tracking',
    ]);
    if (parsed.navigatePage && allowedPages.has(parsed.navigatePage)) {
      cartActions.push({ type: 'navigate', page: parsed.navigatePage });
    }

    if (parsed.scheduleOutfit && parsed.scheduleOutfit.title) {
      const reqIds = (parsed.scheduleOutfit.productIds || [])
        .map((id) => String(id))
        .filter((id) => validCatalogMap.has(id));
      cartActions.push({
        type: 'schedule_outfit',
        schedule: {
          date: String(parsed.scheduleOutfit.date || todayIso),
          title: String(parsed.scheduleOutfit.title),
          occasion: String(parsed.scheduleOutfit.occasion || 'Formal'),
          productIds: reqIds,
          accessoriesNote: parsed.scheduleOutfit.accessoriesNote
            ? String(parsed.scheduleOutfit.accessoriesNote)
            : undefined,
        },
      });
    }

    const finalReply =
      (parsed.reply || '').trim() ||
      (effectiveScriptMode === 'urdu-script'
        ? 'جی ضرور، میں آپ کی اسٹائلنگ اور خریداری میں مدد کے لیے حاضر ہوں۔'
        : effectiveScriptMode === 'roman-urdu'
          ? 'Ji bilkul, main aapki styling aur shopping mein madad karne ke liye hazir hoon.'
          : 'How may I curate your wardrobe or assist your shopping today?');

    res.json({
      reply: finalReply,
      products: matchedProducts,
      cartActions,
      detectedLanguage: containsUrduScript(finalReply) ? 'ur' : effectiveTtsLang,
      detectedScript: containsUrduScript(finalReply) ? 'urdu-script' : effectiveScriptMode,
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(getErrorStatus(error)).json({ error: formatAiError(error, 'Assistant service temporarily unavailable.') });
  }
});

// Server-side cache & cooldown for Trending Now (prevents redundant quota burn & deadline timeouts)
const TRENDING_CACHE_TTL_MS = 15 * 60_000;
const trendingCache = new Map<string, { expiresAt: number; payload: unknown }>();
const trendingInFlight = new Map<string, Promise<unknown>>();
let searchGroundingCooldownUntil = 0;

// Trending Now AI Fashion Trend Analyzer (Gemini + Google Search Grounding -> Matched Boutique Items)
app.post('/api/ai/trending', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip, 20, 60_000)) {
    return res.status(429).json({ error: 'Too many trend analysis requests. Please wait a moment.' });
  }

  try {
    const {
      focus = 'All Luxury Trends',
      catalog = [],
      weather = null,
      forceRefresh = false,
    } = req.body as {
      focus?: string;
      catalog?: Product[];
      weather?: WeatherInfo | null;
      forceRefresh?: boolean;
    };

    if (!Array.isArray(catalog) || catalog.length === 0) {
      return res.status(400).json({ error: 'Boutique catalog is required to match fashion trends.' });
    }

    const inStockCatalog = catalog.filter((p) => p.stock > 0);
    const activeCatalog = inStockCatalog.length > 0 ? inStockCatalog : catalog;
    const cacheKey = `${focus}|${activeCatalog.map((p) => p.id).join(',')}|${weather?.condition || 'all'}`;

    if (!forceRefresh) {
      const cached = trendingCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.payload);
      }
    }

    const existingJob = trendingInFlight.get(cacheKey);
    if (existingJob) {
      const sharedPayload = await existingJob;
      return res.json(sharedPayload);
    }

    const jobPromise = (async () => {
      const ai = getAiClient();
      const currentDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      // Step 1: Attempt real-time fashion trend research via Google Search Grounding
      // Uses cooldown when Search Grounding quota is temporarily exhausted to avoid 429/504 cascades
      let trendReport = '';
      let sources: Array<{ title: string; uri: string }> = [];

      if (Date.now() >= searchGroundingCooldownUntil) {
        const searchAbort = new AbortController();
        const searchTimer = setTimeout(() => searchAbort.abort(), 4500);
        try {
          const searchModel = Date.now() < primaryCooldownUntil ? FALLBACK_TEXT_MODEL : PRIMARY_TEXT_MODEL;
          const searchResp = await ai.models.generateContent({
            model: searchModel,
            contents: `Summarize the top 3 luxury & contemporary fashion trends in ${currentDate} for "${focus}" in 4 concise bullet points (silhouettes, palettes, textiles, handbags/footwear).`,
            config: {
              tools: [{ googleSearch: {} }],
              abortSignal: searchAbort.signal,
            },
          });
          trendReport = (searchResp.text || '').trim();
          const rawChunks = (searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks || []) as Array<{
            web?: { uri?: string; title?: string };
          }>;
          sources = rawChunks
            .map((c) => ({
              title: c.web?.title || 'Fashion Editorial Source',
              uri: c.web?.uri || '',
            }))
            .filter((s) => Boolean(s.uri))
            .slice(0, 5);
        } catch (searchErr) {
          const searchStatus = getErrorStatus(searchErr);
          const msg = searchErr instanceof Error ? searchErr.message : String(searchErr);
          if (
            searchStatus === 429 ||
            searchStatus === 503 ||
            searchStatus === 504 ||
            /abort|timed out|504|503|DEADLINE_EXCEEDED/i.test(msg)
          ) {
            searchGroundingCooldownUntil = Date.now() + 15 * 60_000;
          }
          console.info(`Trending Now grounding skipped (status ${searchStatus}); continuing with direct Gemini trend synthesis.`);
        } finally {
          clearTimeout(searchTimer);
        }
      }

      const catalogSummary = activeCatalog.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        pricePkr: p.pricePkr,
        colors: p.colors,
        occasion: p.occasion,
        season: p.season,
      }));

      // Step 2: Structured synthesis matching current fashion trends to our real boutique catalog
      const { response: structuredResp } = await generateWithFallback(
        ai,
        {
          contents: `Analyze 3 distinct, authoritative luxury fashion trends for ${currentDate} (Focus: ${focus}).
${trendReport ? `Live trend briefing:\n---\n${trendReport}\n---\n` : ''}
Weather context: ${weather ? `${weather.city}, ${weather.temperatureC}°C (${weather.condition})` : 'All season'}
IMMERSO Boutique Catalog (${catalogSummary.length} in-stock items):
${JSON.stringify(catalogSummary)}

Return a structured editorial Trending Now analysis with 3 distinct trends (silhouettes, palettes, textiles, quiet luxury / modern festive direction). For each trend, recommend 1 to 3 REAL product IDs from the IMMERSO Boutique Catalog above.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                seasonHeadline: { type: Type.STRING },
                trends: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      trendTitle: { type: Type.STRING },
                      trendSummary: { type: Type.STRING },
                      palette: { type: Type.ARRAY, items: { type: Type.STRING } },
                      stylingCue: { type: Type.STRING },
                      matchedProductIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['trendTitle', 'trendSummary', 'palette', 'stylingCue', 'matchedProductIds'],
                  },
                },
              },
              required: ['seasonHeadline', 'trends'],
            },
          },
        },
        FALLBACK_TEXT_MODEL
      );

      const rawJson = (structuredResp.text ?? '{}')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      const parsed = JSON.parse(rawJson) as {
        seasonHeadline?: string;
        trends?: Array<{
          trendTitle: string;
          trendSummary: string;
          palette: string[];
          stylingCue: string;
          matchedProductIds: string[];
        }>;
      };

      const catalogMap = new Map(catalog.map((p) => [p.id, p]));
      const trends = (parsed.trends || []).map((t) => ({
        trendTitle: t.trendTitle,
        trendSummary: t.trendSummary,
        palette: t.palette || [],
        stylingCue: t.stylingCue,
        matchedProducts: (t.matchedProductIds || [])
          .map((id) => catalogMap.get(id))
          .filter((p): p is Product => Boolean(p))
          .slice(0, 3),
      }));

      const payload = {
        seasonHeadline: parsed.seasonHeadline || `Current Luxury Edit · ${currentDate}`,
        analyzedAt: new Date().toISOString(),
        trends,
        sources,
      };

      trendingCache.set(cacheKey, {
        expiresAt: Date.now() + TRENDING_CACHE_TTL_MS,
        payload,
      });

      return payload;
    })();

    trendingInFlight.set(cacheKey, jobPromise);
    try {
      const payload = await jobPromise;
      return res.json(payload);
    } finally {
      trendingInFlight.delete(cacheKey);
    }
  } catch (error) {
    const status = getErrorStatus(error);
    console.error(`Trending Now AI error (HTTP ${status}):`, error instanceof Error ? error.message : error);
    const friendlyMessage =
      status === 429
        ? 'Trend intelligence reached temporary API quota limits. Please wait a moment and click Retry.'
        : status === 504 || status === 503
          ? 'The trend analysis service took longer than expected. Please click Retry.'
          : 'Unable to analyze live fashion trends right now. Please try again.';
    return res.status(status).json({ error: friendlyMessage });
  }
});

// Natural Human-Like AI Voice Synthesis (Gemini 3.8 Flash Lite TTS via Interactions API)
app.post('/api/ai/tts', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip, 35, 60_000)) {
    return res.status(429).json({ error: 'Voice synthesis rate limit reached.' });
  }

  try {
    const { text, language = 'en' } = req.body as { text: string; language?: 'en' | 'ur' };
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    // Strip markdown formatting for clean natural spoken prosody
    const cleanSpeechText = text
      .replace(/[*_`#>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 900);

    if (!cleanSpeechText) {
      return res.status(400).json({ error: 'No speakable content provided.' });
    }

    const resolvedLang =
      containsUrduScript(cleanSpeechText) || language === 'ur' ? 'ur' : 'en';

    const ai = getAiClient('v1beta');
    const interaction = await ai.interactions.create({
      model: 'gemini-3.8-flash-lite-tts',
      input: [
        {
          type: 'text',
          text: cleanSpeechText,
          annotations: [
            {
              type: 'speech_metadata',
              style:
                resolvedLang === 'ur'
                  ? 'Warm, poised, articulate luxury boutique fashion stylist speaking clearly in Urdu and English'
                  : 'Warm, poised, intelligent luxury fashion atelier concierge with calm editorial phrasing',
            },
          ],
        },
      ],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [
          {
            language: resolvedLang === 'ur' ? 'ur-PK' : 'en-US',
            voice: 'Kore',
          },
        ],
      },
    });

    const audio = interaction.output_audio;
    if (!audio?.data) {
      return res.status(502).json({ error: 'Audio synthesis returned empty payload.' });
    }

    res.json({ audioBase64: audio.data, mimeType: audio.mime_type || 'audio/wav' });
  } catch (error) {
    console.error('AI TTS error:', error);
    const errMsg = error instanceof Error ? error.message : 'TTS generation failed.';
    res.status(getErrorStatus(error)).json({ error: errMsg });
  }
});

// AI Outfit Generator Endpoint
app.post('/api/ai/outfit-generator', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit reached. Please wait a moment.' });
  }

  try {
    const {
      categoryPreference,
      occasion,
      weather,
      budgetPkr,
      preferredColors,
      clothingType,
      aesthetic,
      season,
      catalog = [],
    } = req.body as {
      categoryPreference: string;
      occasion: string;
      weather: string;
      budgetPkr: number;
      preferredColors: string;
      clothingType: string;
      aesthetic: string;
      season: string;
      catalog: Product[];
    };

    const ai = getAiClient();
    const catalogData = catalog.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      pricePkr: p.pricePkr,
      colors: p.colors,
      stock: p.stock,
      occasion: p.occasion,
      season: p.season,
    }));

    const { response } = await generateWithFallback(ai, {
      contents: `Generate 2 complete luxury outfit combinations from the IMMERSO catalog matching:
Category/Gender: ${categoryPreference}
Occasion: ${occasion}
Weather: ${weather}
Budget: Rs. ${budgetPkr}
Preferred Colors: ${preferredColors}
Clothing Type: ${clothingType}
Aesthetic: ${aesthetic}
Season: ${season}

Catalog: ${JSON.stringify(catalogData)}

Select ONLY real product IDs from the catalog above where stock > 0. Aim to include primary garment + matching bag/shoes/jewellery when budget allows.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              productIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              accessoriesNote: { type: Type.STRING },
              footwearNote: { type: Type.STRING },
              colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
              stylingExplanation: { type: Type.STRING },
            },
            required: ['title', 'productIds', 'accessoriesNote', 'footwearNote', 'colorPalette', 'stylingExplanation'],
          },
        },
      },
    });

    const rawOutfitJson = (response.text ?? '[]')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    const parsed = JSON.parse(rawOutfitJson) as Array<{
      title: string;
      productIds: string[];
      accessoriesNote: string;
      footwearNote: string;
      colorPalette: string[];
      stylingExplanation: string;
    }>;

    const validMap = new Map(catalog.map((p) => [p.id, p]));
    const outfits = parsed.map((o) => {
      const items = (o.productIds || [])
        .map((id) => validMap.get(id))
        .filter((p): p is Product => Boolean(p));
      const totalEstimatedPkr = items.reduce((sum, p) => sum + p.pricePkr, 0);
      return {
        ...o,
        items,
        totalEstimatedPkr,
      };
    });

    res.json({ outfits });
  } catch (error) {
    console.error('Outfit Generator error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to generate outfits.';
    res.status(getErrorStatus(error)).json({ error: errMsg });
  }
});

// AI Virtual Try-On Endpoint (Gemini Image Editing)
app.post('/api/ai/virtual-tryon', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip, 12, 60_000)) {
    return res.status(429).json({ error: 'Try-on rate limit reached. Please wait a minute.' });
  }

  try {
    const { userPhotoBase64, userPhotoMimeType, product } = req.body as {
      userPhotoBase64: string;
      userPhotoMimeType: string;
      product: Product;
    };

    if (!userPhotoBase64 || !product?.name) {
      return res.status(400).json({ error: 'Both a personal photo and a selected product are required.' });
    }

    const ai = getAiClient();
    const cleaned = userPhotoBase64.replace(/^data:[^;]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleaned,
              mimeType: userPhotoMimeType || 'image/jpeg',
            },
          },
          {
            text: `Create a tasteful, realistic luxury fashion virtual try-on preview where the person in this photo is wearing the "${product.name}" (${product.category} in ${product.colors[0] || 'signature tone'}, ${product.description}). Preserve the person's identity, face, pose, and natural lighting in a warm upscale boutique setting.`,
          },
        ],
      },
    });

    let generatedDataUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        generatedDataUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedDataUrl) {
      return res.status(502).json({
        error: 'The image model did not return a preview image. Please try another portrait photo.',
      });
    }

    res.json({
      previewDataUrl: generatedDataUrl,
      disclaimer:
        'Illustrative AI preview only. Actual garment drape, fabric sheen, and fit may vary by body measurements.',
    });
  } catch (error) {
    console.error('Virtual Try-On error:', error);
    const message = error instanceof Error ? error.message : 'Virtual try-on failed.';
    const status = message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('429')
      ? 402
      : 500;
    res.status(status).json({
      error:
        status === 402
          ? 'Virtual Try-On image generation requires a billing-enabled Gemini API key in Settings > Secrets.'
          : message,
    });
  }
});

// Optional Meta WhatsApp Cloud API Admin Notification (+923112537554)
app.post('/api/whatsapp/notify-order', async (req: Request, res: Response) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !phoneNumberId || !businessAccountId) {
    return res.json({
      sent: false,
      configured: false,
      message: 'Meta WhatsApp Cloud API credentials not configured; customer wa.me flow active.',
    });
  }

  try {
    const { orderId, customerName, customerPhone, totalPkr, itemsSummary } = req.body as {
      orderId: string;
      customerName: string;
      customerPhone: string;
      totalPkr: number;
      itemsSummary: string;
    };

    const appUrl = process.env.APP_URL || '';
    const adminLink = appUrl ? `${appUrl}/?page=admin` : 'IMMERSO Admin Dashboard';

    const metaResp = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '923112537554',
          type: 'text',
          text: {
            body: `New IMMERSO Order ${orderId}\nCustomer: ${customerName} (${customerPhone})\nItems: ${itemsSummary}\nTotal: Rs. ${totalPkr}\nManage: ${adminLink}`,
          },
        }),
      }
    );

    const data = await metaResp.json();
    if (!metaResp.ok) {
      return res.status(metaResp.status).json({ sent: false, configured: true, error: data });
    }
    res.json({ sent: true, configured: true, data });
  } catch (error) {
    console.error('Meta WhatsApp Cloud API error:', error);
    res.status(500).json({ sent: false, configured: true, error: 'Notification failed.' });
  }
});

// ============================================================
// Secure Admin Authentication & Server-Protected Admin Routes
// ============================================================
app.post('/api/admin/auth/login', handleAdminLogin);

app.get('/api/admin/auth/session', requireAdminAuth(), handleAdminSessionStatus);

app.post('/api/admin/auth/change-password', requireAdminAuth(), handleAdminChangePassword);

app.post('/api/admin/auth/logout', requireAdminAuth(), handleAdminLogout);

// All operational admin routes require a verified server-side admin session
app.get('/api/admin/overview', requireAdminAuth(), (req: AuthenticatedAdminRequest, res: Response) => {
  res.json({
    authorized: true,
    adminEmail: req.adminAuth?.email,
    mustChangePassword: Boolean(req.adminAuth?.mustChangePassword),
    securityMode: 'bcrypt-12 + HMAC-SHA256 HttpOnly Partitioned Session',
    auditLogs: getAdminAuditLogs(),
    serverTimestamp: new Date().toISOString(),
  });
});

app.get('/api/admin/analytics', requireAdminAuth(), (req: AuthenticatedAdminRequest, res: Response) => {
  res.json({ authorized: true, section: 'analytics', adminEmail: req.adminAuth?.email });
});

app.get('/api/admin/products', requireAdminAuth(), (req: AuthenticatedAdminRequest, res: Response) => {
  res.json({ authorized: true, section: 'products', adminEmail: req.adminAuth?.email });
});

app.get('/api/admin/orders', requireAdminAuth(), (req: AuthenticatedAdminRequest, res: Response) => {
  res.json({ authorized: true, section: 'orders', adminEmail: req.adminAuth?.email });
});

app.get('/api/admin/customers', requireAdminAuth(), (req: AuthenticatedAdminRequest, res: Response) => {
  res.json({ authorized: true, section: 'customers', adminEmail: req.adminAuth?.email });
});

app.get('/api/admin/settings', requireAdminAuth(), (req: AuthenticatedAdminRequest, res: Response) => {
  res.json({ authorized: true, section: 'settings', adminEmail: req.adminAuth?.email });
});

app.post('/api/admin/audit', requireAdminAuth(), (req: AuthenticatedAdminRequest, res: Response) => {
  const action = typeof req.body?.action === 'string' ? req.body.action.trim().slice(0, 60) : '';
  const detail = typeof req.body?.detail === 'string' ? req.body.detail.trim().slice(0, 240) : '';
  if (!action) {
    return res.status(400).json({ error: 'Action name is required.' });
  }
  recordAdminAudit(req.adminAuth?.email || 'admin', action, detail);
  res.json({ authorized: true, auditLogs: getAdminAuditLogs() });
});

app.all('/api/admin/*', requireAdminAuth(), (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Admin API endpoint not found.' });
});

app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const errObj = err as { status?: number; statusCode?: number; type?: string; message?: string };
  if (errObj?.type === 'entity.too.large' || errObj?.status === 413) {
    return res.status(413).json({ error: 'Request payload is too large. Please upload a smaller image.' });
  }
  if (err instanceof SyntaxError || errObj?.type === 'entity.parse.failed' || errObj?.status === 400) {
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }
  const status =
    typeof errObj?.status === 'number' && errObj.status >= 400 && errObj.status < 600
      ? errObj.status
      : typeof errObj?.statusCode === 'number' && errObj.statusCode >= 400 && errObj.statusCode < 600
        ? errObj.statusCode
        : 500;
  console.error('API middleware error:', errObj?.message || err);
  return res.status(status).json({
    error: errObj?.message || 'Unexpected server error.',
  });
});

// Vite / Static Asset Mounting (runs in local/standalone server, skipped on Vercel serverless)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IMMERSO server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  void startServer();
}

export { app };
export default app;
