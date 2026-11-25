import { useState } from 'react';
import { Bookmark, Share2, ShoppingBag, Sparkles } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatPkr } from '../lib/format.ts';
import { parseJsonResponse, toFriendlyNetworkError } from '../lib/http.ts';
import type { Product } from '../types/immerso.ts';
import { SmartImage } from './SmartImage.tsx';

interface GeneratedOutfit {
  title: string;
  productIds: string[];
  accessoriesNote: string;
  footwearNote: string;
  colorPalette: string[];
  stylingExplanation: string;
  items: Product[];
  totalEstimatedPkr: number;
}

export function OutfitGeneratorPage() {
  const { products, weather, addToCart, saveOutfit, openProductModal, notify } = useImmerso();

  const [categoryPreference, setCategoryPreference] = useState("Women's Luxury");
  const [occasion, setOccasion] = useState('Party Wear');
  const [weatherInput, setWeatherInput] = useState(
    weather ? `${weather.temperatureC}°C, ${weather.condition}` : 'Mild Evening'
  );
  const [budgetPkr, setBudgetPkr] = useState(25000);
  const [preferredColors, setPreferredColors] = useState('Black, Champagne, Gold');
  const [clothingType, setClothingType] = useState('Dresses & Tailored Separates');
  const [aesthetic, setAesthetic] = useState('Old Money Luxury');
  const [season, setSeason] = useState('All Season');

  const [generating, setGenerating] = useState(false);
  const [outfits, setOutfits] = useState<GeneratedOutfit[]>([]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const resp = await fetch('/api/ai/outfit-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryPreference,
          occasion,
          weather: weatherInput,
          budgetPkr,
          preferredColors,
          clothingType,
          aesthetic,
          season,
          catalog: products,
        }),
      });
      const data = await parseJsonResponse<{ outfits?: GeneratedOutfit[]; error?: string }>(
        resp,
        'Could not generate outfits.'
      );
      if (!resp.ok) throw new Error(data.error || 'Could not generate outfits.');
      setOutfits(data.outfits || []);
    } catch (err) {
      notify(toFriendlyNetworkError(err, 'Outfit generation failed.'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddAllToCart = (outfit: GeneratedOutfit) => {
    outfit.items.forEach((p) => addToCart(p, p.sizes[0], p.colors[0], 1));
  };

  const handleShare = async (outfit: GeneratedOutfit) => {
    const shareText = `IMMERSO AI Look: ${outfit.title}\n${outfit.stylingExplanation}\nEstimated Total: ${formatPkr(outfit.totalEstimatedPkr)}`;
    try {
      await navigator.clipboard.writeText(shareText);
      notify('Outfit styling summary copied to clipboard.', 'success');
    } catch {
      notify('Unable to copy automatically.', 'info');
    }
  };

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12">
      <div className="border-b border-[#E5DDD0] pb-6">
        <p className="text-xs text-[#70685E] mb-1">Curated Capsule Builder</p>
        <h1 className="font-editorial text-4xl font-medium">AI Outfit Generator</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-4 bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-4 h-fit"
        >
          <h2 className="font-editorial text-2xl font-medium">Styling Parameters</h2>

          <div>
            <label className="block text-xs text-[#70685E] mb-1">Fashion Category</label>
            <select
              value={categoryPreference}
              onChange={(e) => setCategoryPreference(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            >
              <option>Women's Luxury</option>
              <option>Men's Tailoring</option>
              <option>Couture & Festive</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#70685E] mb-1">Occasion</label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              >
                <option>Party Wear</option>
                <option>Office Wear</option>
                <option>Formal Wear</option>
                <option>Wedding Wear</option>
                <option>Casual Chic</option>
                <option>Travel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#70685E] mb-1">Season</label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
              >
                <option>All Season</option>
                <option>Winter</option>
                <option>Summer</option>
                <option>Autumn</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#70685E] mb-1">
              Budget (PKR): <span className="font-mono-num text-[#2A231E]">{formatPkr(budgetPkr)}</span>
            </label>
            <input
              type="range"
              min={4000}
              max={45000}
              step={500}
              value={budgetPkr}
              onChange={(e) => setBudgetPkr(Number(e.target.value))}
              className="w-full accent-[#2A231E]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#70685E] mb-1">Preferred Colors</label>
            <input
              type="text"
              value={preferredColors}
              onChange={(e) => setPreferredColors(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-[#70685E] mb-1">Aesthetic</label>
            <input
              type="text"
              value={aesthetic}
              onChange={(e) => setAesthetic(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-[#70685E] mb-1">Clothing Type</label>
            <input
              type="text"
              value={clothingType}
              onChange={(e) => setClothingType(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-[#70685E] mb-1">Weather Context</label>
            <input
              type="text"
              value={weatherInput}
              onChange={(e) => setWeatherInput(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-[#3F352E] disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#B5945B]" />
            <span>{generating ? 'Composing Outfits...' : 'Generate Complete Looks'}</span>
          </button>
        </form>

        <div className="lg:col-span-8 space-y-6">
          {outfits.length === 0 ? (
            <div className="bg-[#F7F3EC] border border-[#E5DDD0] rounded-2xl p-12 text-center">
              <Sparkles className="w-9 h-9 text-[#B5945B] mx-auto mb-3" />
              <h3 className="font-editorial text-2xl font-medium mb-2">
                Tailored Multi-Piece Combinations
              </h3>
              <p className="text-sm text-[#70685E] max-w-md mx-auto">
                Select your occasion, budget in PKR, and color mood to generate complete shoppable outfits from the live IMMERSO catalog.
              </p>
            </div>
          ) : (
            outfits.map((outfit, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E5DDD0]">
                  <div>
                    <p className="text-xs text-[#70685E]">
                      {occasion} · {outfit.colorPalette.join(' / ')}
                    </p>
                    <h3 className="font-editorial text-2xl font-medium mt-0.5">{outfit.title}</h3>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs text-[#70685E]">Estimated Complete Look</p>
                    <p className="font-mono-num text-lg font-semibold text-[#2A231E]">
                      {formatPkr(outfit.totalEstimatedPkr)}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[#2A231E]/85 leading-relaxed">
                  {outfit.stylingExplanation}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {outfit.items.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => openProductModal(prod)}
                      className="text-left bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl overflow-hidden hover:shadow-sm cursor-pointer"
                    >
                      <div className="aspect-[4/3] bg-[#F7F3EC]">
                        <SmartImage
                          src={prod.images[0]}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-semibold truncate">{prod.name}</p>
                        <p className="text-[11px] font-mono-num text-[#70685E] mt-0.5">
                          {formatPkr(prod.pricePkr)} · {prod.stock > 0 ? 'In Stock' : 'Sold Out'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="text-xs text-[#70685E] space-y-1 bg-[#F7F3EC] p-3.5 rounded-xl">
                  <p>
                    <strong className="text-[#2A231E]">Accessories:</strong> {outfit.accessoriesNote}
                  </p>
                  <p>
                    <strong className="text-[#2A231E]">Footwear:</strong> {outfit.footwearNote}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => handleAddAllToCart(outfit)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add All to Cart</span>
                  </button>
                  <button
                    onClick={() =>
                      void saveOutfit({
                        title: outfit.title,
                        occasion,
                        season,
                        aesthetic,
                        stylingExplanation: outfit.stylingExplanation,
                        colorPalette: outfit.colorPalette,
                        productIds: outfit.items.map((p) => p.id),
                        totalEstimatedPkr: outfit.totalEstimatedPkr,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#E5DDD0] text-xs font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save Look</span>
                  </button>
                  <button
                    onClick={() => void handleShare(outfit)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#E5DDD0] text-xs font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
