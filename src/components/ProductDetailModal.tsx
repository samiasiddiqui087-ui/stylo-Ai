import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Minus, Plus, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatPkr } from '../lib/format.ts';
import { SmartImage } from './SmartImage.tsx';

export function ProductDetailModal() {
  const {
    selectedProduct,
    closeProductModal,
    products,
    addToCart,
    setCheckoutOpen,
    wishlistIds,
    toggleWishlist,
    openProductModal,
    navigate,
  } = useImmerso();

  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (selectedProduct) {
      setSize(selectedProduct.sizes[0] || 'One Size');
      setColor(selectedProduct.colors[0] || 'Default');
      setQty(1);
    }
  }, [selectedProduct]);

  const relatedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    return products
      .filter((p) => p.id !== selectedProduct.id && p.stock > 0)
      .slice(0, 3);
  }, [products, selectedProduct]);

  if (!selectedProduct) return null;

  const wished = wishlistIds.includes(selectedProduct.id);

  const handleBuyNow = () => {
    addToCart(selectedProduct, size, color, qty);
    closeProductModal();
    setCheckoutOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#2A231E]/55 backdrop-blur-xs">
      <div className="bg-[#FDFBF7] border border-[#E5DDD0] rounded-2xl max-w-4xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#FDFBF7]/95 backdrop-blur-md px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E5DDD0] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-[#70685E] min-w-0">
            <span className="truncate">{selectedProduct.brand}</span>
            <span aria-hidden="true">/</span>
            <span className="font-mono-num shrink-0">{selectedProduct.sku}</span>
          </div>
          <button
            onClick={closeProductModal}
            aria-label="Close details"
            className="p-2 hover:bg-[#F7F3EC] rounded-lg shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 p-4 sm:p-6">
          {/* Sticky Gallery Left */}
          <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-[#F7F3EC] border border-[#E5DDD0]">
            <SmartImage
              src={selectedProduct.images[0]}
              alt={selectedProduct.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Contiguous Purchase Module Right */}
          <div className="flex flex-col justify-between">
            <div>
              <p className="text-xs text-[#70685E] mb-1">
                {selectedProduct.category} · {selectedProduct.occasion || 'Signature'}
              </p>
              <h2 className="font-editorial text-3xl font-medium text-[#2A231E] leading-tight">
                {selectedProduct.name}
              </h2>

              <div className="flex items-baseline gap-3 mt-3">
                <span className="font-mono-num text-xl font-semibold">
                  {formatPkr(selectedProduct.pricePkr)}
                </span>
                {selectedProduct.originalPricePkr &&
                  selectedProduct.originalPricePkr > selectedProduct.pricePkr && (
                    <span className="font-mono-num text-sm text-[#70685E] line-through">
                      {formatPkr(selectedProduct.originalPricePkr)}
                    </span>
                  )}
                <span className="text-xs text-[#70685E] ml-auto">
                  {selectedProduct.stock > 0 ? `${selectedProduct.stock} available` : 'Out of stock'}
                </span>
              </div>

              <p className="text-sm text-[#2A231E]/85 leading-relaxed mt-4">
                {selectedProduct.description}
              </p>

              {selectedProduct.details && (
                <p className="text-xs text-[#70685E] mt-3 pt-3 border-t border-[#E5DDD0]">
                  {selectedProduct.details}
                </p>
              )}

              {/* Size Selector */}
              <div className="mt-5">
                <label className="block text-xs font-medium text-[#70685E] mb-2">
                  Select Size: <span className="text-[#2A231E]">{size}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        size === s
                          ? 'bg-[#2A231E] text-[#FDFBF7] border-[#2A231E]'
                          : 'bg-white text-[#2A231E] border-[#E5DDD0] hover:border-[#2A231E]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div className="mt-4">
                <label className="block text-xs font-medium text-[#70685E] mb-2">
                  Select Color: <span className="text-[#2A231E]">{color}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        color === c
                          ? 'bg-[#2A231E] text-[#FDFBF7] border-[#2A231E]'
                          : 'bg-white text-[#2A231E] border-[#E5DDD0] hover:border-[#2A231E]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="mt-4 flex items-center gap-4">
                <span className="text-xs font-medium text-[#70685E]">Quantity</span>
                <div className="inline-flex items-center border border-[#E5DDD0] bg-white rounded-lg">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="p-2 hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-4 text-sm font-mono-num">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(selectedProduct.stock || 1, q + 1))}
                    className="p-2 hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2.5 pt-4 border-t border-[#E5DDD0]">
              <div className="flex gap-2.5">
                <button
                  onClick={() => addToCart(selectedProduct, size, color, qty)}
                  disabled={selectedProduct.stock <= 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#2A231E] text-[#FDFBF7] text-sm font-medium rounded-lg hover:bg-[#3F352E] disabled:opacity-40 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Bag</span>
                </button>
                <button
                  onClick={() => void toggleWishlist(selectedProduct.id)}
                  aria-label="Save to wishlist"
                  className={`px-4 py-3 rounded-lg border transition-colors cursor-pointer ${
                    wished
                      ? 'bg-[#2A231E] text-white border-[#2A231E]'
                      : 'bg-white text-[#2A231E] border-[#E5DDD0]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${wished ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={handleBuyNow}
                  disabled={selectedProduct.stock <= 0}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#B5945B] text-white text-xs font-semibold rounded-lg hover:opacity-95 disabled:opacity-40 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Order via WhatsApp</span>
                </button>
                <button
                  onClick={() => {
                    closeProductModal();
                    navigate('virtual-tryon');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 border border-[#E5DDD0] bg-white text-[#2A231E] text-xs font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
                  <span>Virtual Try-On</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Complete Your Look */}
        {relatedProducts.length > 0 && (
          <div className="px-4 sm:px-6 pb-6 pt-4 border-t border-[#E5DDD0]">
            <h3 className="font-editorial text-xl font-medium mb-4">Complete Your Look</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedProducts.map((rel) => (
                <button
                  key={rel.id}
                  onClick={() => openProductModal(rel)}
                  className="flex items-center gap-3 p-2.5 bg-white border border-[#E5DDD0] rounded-xl text-left hover:shadow-sm cursor-pointer"
                >
                  <div className="w-14 h-16 rounded-lg overflow-hidden shrink-0 bg-[#F7F3EC]">
                    <SmartImage src={rel.images[0]} alt={rel.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{rel.name}</p>
                    <p className="text-xs font-mono-num text-[#70685E] mt-0.5">
                      {formatPkr(rel.pricePkr)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
