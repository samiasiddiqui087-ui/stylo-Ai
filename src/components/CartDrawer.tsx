import { useState } from 'react';
import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatPkr } from '../lib/format.ts';
import { SmartImage } from './SmartImage.tsx';

export function CartDrawer() {
  const {
    isCartOpen,
    setCartOpen,
    setCheckoutOpen,
    cart,
    products,
    removeFromCart,
    updateCartQty,
    updateCartVariant,
    subtotalPkr,
    deliveryChargePkr,
    discountPkr,
    totalPkr,
    appliedDiscountCode,
    applyDiscountCode,
    siteConfig,
    navigate,
  } = useImmerso();

  const [promoInput, setPromoInput] = useState('');

  if (!isCartOpen) return null;

  const remainingForFreeShipping = Math.max(0, siteConfig.freeShippingThresholdPkr - subtotalPkr);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#2A231E]/45 backdrop-blur-xs"
        onClick={() => setCartOpen(false)}
      />

      <aside className="relative z-10 w-full max-w-md bg-[#FDFBF7] h-full border-l border-[#E5DDD0] flex flex-col justify-between shadow-2xl">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E5DDD0] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShoppingBag className="w-5 h-5 text-[#2A231E] shrink-0" />
            <h2 className="font-editorial text-xl sm:text-2xl font-medium truncate">Your Shopping Bag</h2>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="Close bag"
            className="p-2 hover:bg-[#F7F3EC] rounded-lg shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {cart.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="w-10 h-10 text-[#B5945B] mx-auto mb-3 opacity-70" />
              <p className="font-editorial text-2xl mb-2">Your bag is empty</p>
              <p className="text-sm text-[#70685E] mb-6">
                Explore curated silhouettes or ask our AI assistant to locate pieces for your occasion.
              </p>
              <button
                onClick={() => {
                  setCartOpen(false);
                  navigate('shop');
                }}
                className="px-6 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 bg-[#F7F3EC] rounded-xl text-xs text-[#70685E]">
                {remainingForFreeShipping === 0
                  ? 'Complimentary express delivery unlocked on your order.'
                  : `Add ${formatPkr(remainingForFreeShipping)} more for complimentary delivery.`}
              </div>

              {cart.map((item) => {
                const catalogProduct = products.find((p) => p.id === item.productId);
                const sizes = catalogProduct?.sizes || [item.size];
                const colors = catalogProduct?.colors || [item.color];

                return (
                  <div
                    key={item.id}
                    className="flex gap-3.5 p-3 bg-white border border-[#E5DDD0] rounded-xl"
                  >
                    <div className="w-20 h-24 rounded-lg overflow-hidden shrink-0 bg-[#F7F3EC]">
                      <SmartImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{item.name}</p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label="Remove item"
                          className="text-[#70685E] hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="font-mono-num text-xs font-medium text-[#2A231E] mt-0.5">
                        {formatPkr(item.pricePkr)}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <select
                          value={item.size}
                          onChange={(e) => updateCartVariant(item.id, e.target.value, item.color)}
                          className="text-xs px-2 py-1 bg-[#F7F3EC] border border-[#E5DDD0] rounded-md"
                        >
                          {sizes.map((s) => (
                            <option key={s} value={s}>
                              Size: {s}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.color}
                          onChange={(e) => updateCartVariant(item.id, item.size, e.target.value)}
                          className="text-xs px-2 py-1 bg-[#F7F3EC] border border-[#E5DDD0] rounded-md"
                        >
                          {colors.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between mt-2.5">
                        <div className="inline-flex items-center border border-[#E5DDD0] rounded-lg">
                          <button
                            onClick={() => updateCartQty(item.id, item.quantity - 1)}
                            className="p-1.5 hover:bg-[#F7F3EC] cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 text-xs font-mono-num">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(item.id, item.quantity + 1)}
                            className="p-1.5 hover:bg-[#F7F3EC] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-mono-num text-xs font-semibold">
                          {formatPkr(item.pricePkr * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Summary & Checkout Footer */}
        {cart.length > 0 && (
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-[#E5DDD0] bg-white space-y-4">
            {/* Discount Code */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (promoInput.trim()) applyDiscountCode(promoInput);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1 min-w-0">
                <Tag className="w-3.5 h-3.5 text-[#70685E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder={`Promo code (try ${siteConfig.activeDiscountCode || 'IMMERSO10'})`}
                  className="w-full min-w-0 pl-8 pr-3 py-2 text-xs bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-medium border border-[#E5DDD0] rounded-lg hover:bg-[#F7F3EC] shrink-0 cursor-pointer"
              >
                Apply
              </button>
            </form>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#70685E]">
                <span>Subtotal</span>
                <span className="font-mono-num">{formatPkr(subtotalPkr)}</span>
              </div>
              <div className="flex justify-between text-[#70685E]">
                <span>Delivery Charges</span>
                <span className="font-mono-num">
                  {deliveryChargePkr === 0 ? 'Complimentary' : formatPkr(deliveryChargePkr)}
                </span>
              </div>
              {discountPkr > 0 && (
                <div className="flex justify-between text-[#B5945B] font-medium">
                  <span>Discount ({appliedDiscountCode})</span>
                  <span className="font-mono-num">-{formatPkr(discountPkr)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-[#2A231E] pt-2 border-t border-[#E5DDD0]">
                <span>Total</span>
                <span className="font-mono-num">{formatPkr(totalPkr)}</span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => setCartOpen(false)}
                className="py-2.5 px-3 border border-[#E5DDD0] text-xs font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
              >
                Continue Shopping
              </button>
              <button
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
                className="py-2.5 px-3 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
              >
                Checkout
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
