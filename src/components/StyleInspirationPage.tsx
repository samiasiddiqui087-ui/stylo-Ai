import { useMemo, useState } from 'react';
import { Bookmark, Share2, ShoppingBag } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatPkr } from '../lib/format.ts';
import { SmartImage } from './SmartImage.tsx';

const INSPIRATION_CATEGORIES = [
  'All',
  'Minimalist Fashion',
  'Old Money Aesthetic',
  'Streetwear',
  'Luxury Fashion',
  'Casual Chic',
  'Office Fashion',
  'Party Wear',
  'Seasonal Trends',
  'Wedding Fashion',
];

export function StyleInspirationPage({ previewOnly = false }: { previewOnly?: boolean }) {
  const { inspirations, products, addToCart, saveOutfit, openProductModal, navigate, notify } =
    useImmerso();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return inspirations;
    return inspirations.filter((i) => i.category === selectedCategory);
  }, [inspirations, selectedCategory]);

  const list = previewOnly ? filtered.slice(0, 3) : filtered;

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E5DDD0]">
        <div>
          <p className="text-xs text-[#70685E] mb-1">Editorial Lookbook</p>
          <h2 className="font-editorial text-3xl sm:text-4xl font-medium">Style Inspiration</h2>
        </div>

        {previewOnly && (
          <button
            onClick={() => navigate('inspiration')}
            className="px-5 py-2 border border-[#E5DDD0] bg-white text-xs font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
          >
            Explore All Aesthetics
          </button>
        )}
      </div>

      {!previewOnly && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 border-b border-[#E5DDD0]">
          {INSPIRATION_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#2A231E] text-[#FDFBF7]'
                  : 'bg-[#F7F3EC] text-[#70685E] hover:text-[#2A231E]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="py-12 text-center bg-[#F7F3EC] rounded-2xl mt-8 border border-[#E5DDD0]">
          <p className="font-editorial text-2xl mb-2">More looks arriving soon</p>
          <p className="text-sm text-[#70685E]">
            Ask the AI Outfit Generator to compose custom looks in {selectedCategory}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 mt-8">
          {list.map((look) => {
            const linkedProducts = look.productIds
              .map((id) => products.find((p) => p.id === id))
              .filter((p): p is NonNullable<typeof p> => Boolean(p));

            return (
              <article
                key={look.id}
                className="bg-white border border-[#E5DDD0] rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[3/4] bg-[#F7F3EC] overflow-hidden">
                    <SmartImage
                      src={look.imageUrl}
                      alt={look.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 sm:p-5">
                    <p className="text-xs text-[#B5945B] font-medium mb-1">{look.category}</p>
                    <h3 className="font-editorial text-2xl font-medium">{look.title}</h3>
                    <p className="text-xs text-[#70685E] mt-2 leading-relaxed">{look.stylingNote}</p>

                    {linkedProducts.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#E5DDD0] space-y-2">
                        <p className="text-[11px] font-medium text-[#70685E]">Featured Pieces</p>
                        {linkedProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => openProductModal(p)}
                            className="w-full flex items-center justify-between text-xs hover:underline cursor-pointer"
                          >
                            <span className="truncate">{p.name}</span>
                            <span className="font-mono-num shrink-0 ml-2">{formatPkr(p.pricePkr)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 flex items-center gap-2">
                  <button
                    onClick={() => {
                      linkedProducts.forEach((p) => addToCart(p, p.sizes[0], p.colors[0], 1));
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Shop This Look</span>
                  </button>
                  <button
                    onClick={() =>
                      void saveOutfit({
                        title: look.title,
                        occasion: look.category,
                        stylingExplanation: look.stylingNote,
                        productIds: look.productIds,
                        totalEstimatedPkr: linkedProducts.reduce((s, p) => s + p.pricePkr, 0),
                      })
                    }
                    aria-label="Save look"
                    className="p-2.5 border border-[#E5DDD0] rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(`${look.title} — ${look.stylingNote}`);
                      notify('Look copied to share.', 'success');
                    }}
                    aria-label="Share look"
                    className="p-2.5 border border-[#E5DDD0] rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
