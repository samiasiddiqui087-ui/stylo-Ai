import { useMemo, useState } from 'react';
import { ArrowLeftRight, Heart, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatPkr } from '../lib/format.ts';
import { SmartImage } from './SmartImage.tsx';
import type { Product } from '../types/immerso.ts';

const CATEGORIES = [
  'All',
  "Women's Clothing",
  "Men's Clothing",
  'Dresses',
  'Formal Wear',
  'Luxury Collections',
  'Shoes',
  'Handbags',
  'Jewellery',
  'Seasonal Collections',
];

export function ShopSection({ previewOnly = false }: { previewOnly?: boolean }) {
  const {
    products,
    searchQuery,
    setSearchQuery,
    openProductModal,
    addToCart,
    wishlistIds,
    toggleWishlist,
    recentlyViewedIds,
    compareIds,
    toggleCompare,
    navigate,
    userProfile,
  } = useImmerso();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedColor, setSelectedColor] = useState('All');
  const [selectedSize, setSelectedSize] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'newest'>('featured');
  const [showFilters, setShowFilters] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const allColors = useMemo(
    () => ['All', ...Array.from(new Set(products.flatMap((p) => p.colors)))],
    [products]
  );
  const allSizes = useMemo(
    () => ['All', ...Array.from(new Set(products.flatMap((p) => p.sizes)))],
    [products]
  );
  const allBrands = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.brand)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (selectedColor !== 'All' && !p.colors.includes(selectedColor)) return false;
      if (selectedSize !== 'All' && !p.sizes.includes(selectedSize)) return false;
      if (selectedBrand !== 'All' && p.brand !== selectedBrand) return false;
      if (q) {
        const hay = `${p.name} ${p.description} ${p.category} ${p.brand} ${p.colors.join(' ')} ${p.occasion || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') return [...list].sort((a, b) => a.pricePkr - b.pricePkr);
    if (sortBy === 'price-desc') return [...list].sort((a, b) => b.pricePkr - a.pricePkr);
    if (sortBy === 'newest') return [...list].sort((a, b) => Number(b.isNewArrival) - Number(a.isNewArrival));
    return [...list].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }, [products, selectedCategory, selectedColor, selectedSize, selectedBrand, searchQuery, sortBy]);

  const displayedProducts = previewOnly ? filteredProducts.slice(0, 6) : filteredProducts;

  const recommendedProducts = useMemo(() => {
    const prefColors = userProfile?.preferredColors || [];
    const scored = products
      .filter((p) => p.stock > 0)
      .map((p) => {
        let score = p.isBestSeller ? 2 : 0;
        if (prefColors.some((c) => p.colors.includes(c))) score += 3;
        if (wishlistIds.includes(p.id)) score += 1;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
    return scored.slice(0, 3);
  }, [products, userProfile, wishlistIds]);

  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewedIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p))
        .slice(0, 3),
    [recentlyViewedIds, products]
  );

  const compareProducts = useMemo(
    () =>
      compareIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p)),
    [compareIds, products]
  );

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E5DDD0]">
        <div>
          <p className="text-xs text-[#70685E] mb-1">Curated Boutique</p>
          <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#2A231E]">
            {previewOnly ? 'Featured Collection' : 'The IMMERSO Collection'}
          </h2>
        </div>

        <div className="w-full md:w-auto flex flex-wrap items-center gap-2 sm:gap-3">
          {!previewOnly && (
            <div className="relative w-full sm:w-auto flex-1 sm:flex-initial min-w-0">
              <Search className="w-4 h-4 text-[#70685E] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pieces..."
                className="w-full sm:w-52 pl-9 pr-4 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg focus:outline-none focus:border-[#2A231E]"
              />
            </div>
          )}

          {!previewOnly && (
            <button
              onClick={() => setShowFilters((f) => !f)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium border border-[#E5DDD0] bg-white rounded-lg hover:bg-[#F7F3EC] transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
          )}

          {!previewOnly && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 text-xs font-medium bg-white border border-[#E5DDD0] rounded-lg focus:outline-none cursor-pointer"
            >
              <option value="featured">Sort: Featured</option>
              <option value="newest">Sort: New Arrivals</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          )}

          {previewOnly && (
            <button
              onClick={() => navigate('shop')}
              className="px-5 py-2 text-xs font-semibold bg-[#2A231E] text-[#FDFBF7] rounded-lg hover:bg-[#3F352E] transition-colors cursor-pointer"
            >
              View Full Catalog
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Strip */}
      {!previewOnly && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 border-b border-[#E5DDD0]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
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

      {/* Advanced Filters Drawer */}
      {!previewOnly && showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 mt-4 bg-[#F7F3EC] rounded-xl border border-[#E5DDD0]">
          <div>
            <label className="block text-xs font-medium text-[#70685E] mb-1.5">Color</label>
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
            >
              {allColors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#70685E] mb-1.5">Size</label>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
            >
              {allSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#70685E] mb-1.5">Brand</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
            >
              {allBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Compare Bar */}
      {compareProducts.length > 0 && !previewOnly && (
        <div className="mt-4 p-3.5 bg-[#F7F3EC] border border-[#E5DDD0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 text-xs min-w-0">
            <ArrowLeftRight className="w-4 h-4 text-[#B5945B] shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">
              Comparing {compareProducts.length} {compareProducts.length === 1 ? 'piece' : 'pieces'}:{' '}
              {compareProducts.map((p) => p.name).join(' · ')}
            </span>
          </div>
          <button
            onClick={() => setShowCompareModal(true)}
            className="w-full sm:w-auto px-4 py-1.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg shrink-0 cursor-pointer"
          >
            Compare Specs
          </button>
        </div>
      )}

      {/* 3-Column Product Grid */}
      {displayedProducts.length === 0 ? (
        <div className="py-16 text-center bg-[#F7F3EC] rounded-2xl mt-8 border border-[#E5DDD0]">
          <p className="font-editorial text-2xl mb-2">No pieces match your current filter</p>
          <p className="text-sm text-[#70685E] mb-4">
            Try clearing a filter or ask the IMMERSO AI Assistant to locate something specific.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('All');
              setSelectedColor('All');
              setSelectedSize('All');
              setSelectedBrand('All');
              setSearchQuery('');
            }}
            className="px-5 py-2 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 mt-8">
          {displayedProducts.map((product) => {
            const wished = wishlistIds.includes(product.id);
            const compared = compareIds.includes(product.id);
            return (
              <article
                key={product.id}
                className="group bg-white border border-[#E5DDD0] rounded-2xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[3/4] bg-[#F7F3EC] overflow-hidden">
                  <button
                    onClick={() => openProductModal(product)}
                    className="w-full h-full block cursor-pointer"
                  >
                    <SmartImage
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </button>

                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    <button
                      onClick={() => void toggleWishlist(product.id)}
                      aria-label="Toggle wishlist"
                      className={`p-2 rounded-full backdrop-blur-md border transition-colors cursor-pointer ${
                        wished
                          ? 'bg-[#2A231E] text-white border-[#2A231E]'
                          : 'bg-white/85 text-[#2A231E] border-[#E5DDD0] hover:bg-white'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${wished ? 'fill-current' : ''}`} />
                    </button>
                    {!previewOnly && (
                      <button
                        onClick={() => toggleCompare(product.id)}
                        aria-label="Compare product"
                        className={`p-2 rounded-full backdrop-blur-md border transition-colors cursor-pointer ${
                          compared
                            ? 'bg-[#B5945B] text-white border-[#B5945B]'
                            : 'bg-white/85 text-[#2A231E] border-[#E5DDD0] hover:bg-white'
                        }`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#70685E] mb-1.5">
                      <span>{product.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{product.brand}</span>
                      {product.isNewArrival && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#B5945B] font-medium">New</span>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => openProductModal(product)}
                      className="text-left font-semibold text-base text-[#2A231E] hover:underline cursor-pointer line-clamp-1"
                    >
                      {product.name}
                    </button>

                    <p className="text-xs text-[#70685E] mt-1">
                      Sizes: {product.sizes.join(', ')} · {product.stock > 0 ? 'In Stock' : 'Sold Out'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E5DDD0] flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-mono-num text-sm font-semibold text-[#2A231E]">
                        {formatPkr(product.pricePkr)}
                      </span>
                      {product.originalPricePkr && product.originalPricePkr > product.pricePkr && (
                        <span className="font-mono-num text-xs text-[#70685E] line-through">
                          {formatPkr(product.originalPricePkr)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => addToCart(product, product.sizes[0], product.colors[0], 1)}
                      disabled={product.stock <= 0}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#2A231E] text-[#FDFBF7] rounded-lg hover:bg-[#3F352E] disabled:opacity-40 shrink-0 transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Add to Bag</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Recommended For You & Recently Viewed on Shop Page */}
      {!previewOnly && recommendedProducts.length > 0 && (
        <div className="mt-16 pt-10 border-t border-[#E5DDD0]">
          <p className="text-xs text-[#70685E] mb-1">Personalized Curation</p>
          <h3 className="font-editorial text-2xl font-medium mb-6">Recommended For You</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {recommendedProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => openProductModal(p)}
                className="flex items-center gap-4 p-3 bg-white border border-[#E5DDD0] rounded-xl text-left hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0 bg-[#F7F3EC]">
                  <SmartImage src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#70685E]">{p.category}</p>
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs font-mono-num mt-1">{formatPkr(p.pricePkr)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!previewOnly && recentlyViewedProducts.length > 0 && (
        <div className="mt-12 pt-8 border-t border-[#E5DDD0]">
          <h3 className="font-editorial text-2xl font-medium mb-5">Recently Viewed</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {recentlyViewedProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => openProductModal(p)}
                className="flex items-center gap-4 p-3 bg-[#F7F3EC] border border-[#E5DDD0] rounded-xl text-left cursor-pointer"
              >
                <div className="w-14 h-16 rounded-lg overflow-hidden shrink-0">
                  <SmartImage src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs font-mono-num text-[#70685E]">{formatPkr(p.pricePkr)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && compareProducts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2A231E]/50 backdrop-blur-xs">
          <div className="bg-[#FDFBF7] border border-[#E5DDD0] rounded-2xl max-w-3xl w-full p-4 sm:p-6 max-h-[88dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DDD0]">
              <h3 className="font-editorial text-2xl font-medium">Piece Comparison</h3>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-2 hover:bg-[#F7F3EC] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              {compareProducts.map((p) => (
                <div key={p.id} className="bg-white border border-[#E5DDD0] rounded-xl p-4 space-y-2">
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[#F7F3EC]">
                    <SmartImage src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="font-mono-num text-sm text-[#B5945B]">{formatPkr(p.pricePkr)}</p>
                  <p className="text-xs text-[#70685E]">Brand: {p.brand}</p>
                  <p className="text-xs text-[#70685E]">Colors: {p.colors.join(', ')}</p>
                  <p className="text-xs text-[#70685E]">Sizes: {p.sizes.join(', ')}</p>
                  <p className="text-xs text-[#70685E]">Occasion: {p.occasion || 'Versatile'}</p>
                  <button
                    onClick={() => {
                      addToCart(p, p.sizes[0], p.colors[0], 1);
                      setShowCompareModal(false);
                    }}
                    className="w-full py-2 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg cursor-pointer"
                  >
                    Add to Bag
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
