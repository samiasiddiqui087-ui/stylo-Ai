import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, MessageCircle, ShoppingBag, X } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatPkr } from '../lib/format.ts';
import { BUSINESS_WHATSAPP_INTL } from '../lib/whatsapp.ts';
import { SmartImage } from './SmartImage.tsx';

export function CheckoutModal() {
  const {
    isCheckoutOpen,
    setCheckoutOpen,
    cart,
    products,
    user,
    userProfile,
    subtotalPkr,
    deliveryChargePkr,
    discountPkr,
    totalPkr,
    appliedDiscountCode,
    placeWhatsAppOrder,
    updateCartQty,
    updateCartVariant,
    navigate,
    notify,
  } = useImmerso();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('Karachi');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmation, setConfirmation] = useState<{
    orderId: string;
    message: string;
    waUrl: string;
  } | null>(null);

  useEffect(() => {
    if (isCheckoutOpen) {
      setCustomerName((prev) => prev || userProfile?.displayName || user?.displayName || '');
      setCustomerEmail((prev) => prev || userProfile?.email || user?.email || '');
      setCustomerPhone((prev) => prev || userProfile?.phone || '');
      setDeliveryAddress((prev) => prev || userProfile?.address || '');
      setCity((prev) => prev || userProfile?.city || 'Karachi');
      setFormError('');
    }
  }, [isCheckoutOpen, user, userProfile]);

  if (!isCheckoutOpen) return null;

  const handleClose = () => {
    setCheckoutOpen(false);
    setConfirmation(null);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (customerName.trim().length < 2) {
      setFormError('Please enter your full name.');
      return;
    }
    const digits = customerPhone.replace(/\D/g, '');
    if (digits.length < 7) {
      setFormError('Please enter a valid WhatsApp / mobile number.');
      return;
    }
    if (deliveryAddress.trim().length < 5) {
      setFormError('Please enter your complete delivery address.');
      return;
    }
    if (city.trim().length < 2) {
      setFormError('Please enter your delivery city.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await placeWhatsAppOrder({
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        city,
        postalCode,
        notes,
      });
      setConfirmation(result);

      // Launch official WhatsApp destination
      const link = document.createElement('a');
      link.href = result.waUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(confirmation.message);
      notify('Order message copied. Paste into WhatsApp (+923112537554).', 'success');
    } catch {
      notify('Could not copy automatically. Please select and copy the message.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#2A231E]/55 backdrop-blur-xs">
      <div className="bg-[#FDFBF7] border border-[#E5DDD0] rounded-2xl max-w-4xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#FDFBF7]/95 backdrop-blur-md px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E5DDD0] flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-[#70685E]">Direct Concierge Checkout</p>
            <h2 className="font-editorial text-2xl font-medium">
              {confirmation ? 'WhatsApp Order Ready' : 'Complete Your Order'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close checkout"
            className="p-2 hover:bg-[#F7F3EC] rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmation ? (
          <div className="p-4 sm:p-8 space-y-6">
            <div className="p-4 sm:p-6 bg-[#F7F3EC] border border-[#E5DDD0] rounded-2xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#B5945B] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-mono-num text-[#70685E]">
                    Order Reference: {confirmation.orderId} · Status: Pending WhatsApp Confirmation
                  </p>
                  <h3 className="font-editorial text-xl sm:text-2xl font-medium mt-1">
                    Your order message is ready! Please press SEND in WhatsApp to submit your order to IMMERSO.
                  </h3>
                  <p className="text-sm text-[#70685E] mt-2">
                    Your order has been saved securely in our system as{' '}
                    <span className="font-medium text-[#2A231E]">Pending WhatsApp Confirmation</span>.
                    Once you tap Send in WhatsApp ({BUSINESS_WHATSAPP_INTL}), our atelier team will confirm dispatch.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={confirmation.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#2A231E] text-[#FDFBF7] text-sm font-semibold rounded-lg hover:bg-[#3F352E]"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Open WhatsApp ({BUSINESS_WHATSAPP_INTL})</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>

              <button
                onClick={() => void handleCopyMessage()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#E5DDD0] bg-white text-sm font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
              >
                <Copy className="w-4 h-4 shrink-0" />
                <span>Copy Order Message (Fallback)</span>
              </button>

              <button
                onClick={() => {
                  handleClose();
                  navigate('order-tracking');
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#E5DDD0] bg-white text-sm font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
              >
                <span>Track Order {confirmation.orderId}</span>
              </button>
            </div>

            <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
              <p className="text-xs font-medium text-[#70685E] mb-2">Formatted WhatsApp Message Preview</p>
              <pre className="text-xs font-mono-num whitespace-pre-wrap break-words overflow-x-auto text-[#2A231E] leading-relaxed">
                {confirmation.message}
              </pre>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-[#B5945B] mx-auto mb-3" />
            <p className="font-editorial text-2xl mb-2">No items selected for checkout</p>
            <button
              onClick={() => {
                handleClose();
                navigate('shop');
              }}
              className="mt-3 px-6 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg cursor-pointer"
            >
              Browse Boutique
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 p-4 sm:p-6">
            {/* Checkout Form Left */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-editorial text-xl font-medium">Delivery & Contact Information</h3>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#70685E] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ayesha Khan"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD0] rounded-lg focus:outline-none focus:border-[#2A231E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#70685E] mb-1">
                    WhatsApp / Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0300 1234567"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD0] rounded-lg focus:outline-none focus:border-[#2A231E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#70685E] mb-1">
                  Complete Delivery Address *
                </label>
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House 14, Street 6, Clifton Block 4"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD0] rounded-lg focus:outline-none focus:border-[#2A231E]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#70685E] mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Karachi"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD0] rounded-lg focus:outline-none focus:border-[#2A231E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#70685E] mb-1">
                    Postal Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="75600"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD0] rounded-lg focus:outline-none focus:border-[#2A231E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#70685E] mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DDD0] rounded-lg focus:outline-none focus:border-[#2A231E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#70685E] mb-1">
                  Additional Order Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred delivery window, tailoring adjustments, gift wrapping..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg focus:outline-none focus:border-[#2A231E]"
                />
              </div>
            </div>

            {/* Order Summary Right */}
            <div className="lg:col-span-5 bg-white border border-[#E5DDD0] rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-editorial text-xl font-medium pb-3 border-b border-[#E5DDD0]">
                  Order Summary
                </h3>

                <div className="mt-4 space-y-3 max-h-64 overflow-y-auto pr-1">
                  {cart.map((item) => {
                    const catalogProduct = products.find((p) => p.id === item.productId);
                    return (
                      <div key={item.id} className="flex gap-3 pb-3 border-b border-[#E5DDD0]/60">
                        <div className="w-12 h-14 rounded-lg overflow-hidden bg-[#F7F3EC] shrink-0">
                          <SmartImage
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{item.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <select
                              value={item.size}
                              onChange={(e) => updateCartVariant(item.id, e.target.value, item.color)}
                              className="text-[11px] px-1.5 py-0.5 bg-[#F7F3EC] border border-[#E5DDD0] rounded"
                            >
                              {(catalogProduct?.sizes || [item.size]).map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <select
                              value={item.color}
                              onChange={(e) => updateCartVariant(item.id, item.size, e.target.value)}
                              className="text-[11px] px-1.5 py-0.5 bg-[#F7F3EC] border border-[#E5DDD0] rounded"
                            >
                              {(catalogProduct?.colors || [item.color]).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              max={catalogProduct?.stock || 20}
                              value={item.quantity}
                              onChange={(e) => updateCartQty(item.id, Number(e.target.value) || 1)}
                              className="w-12 text-[11px] px-1.5 py-0.5 bg-[#F7F3EC] border border-[#E5DDD0] rounded font-mono-num"
                            />
                          </div>
                        </div>
                        <span className="text-xs font-mono-num font-semibold shrink-0">
                          {formatPkr(item.pricePkr * item.quantity)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-[#70685E]">
                    <span>Subtotal</span>
                    <span className="font-mono-num">{formatPkr(subtotalPkr)}</span>
                  </div>
                  <div className="flex justify-between text-[#70685E]">
                    <span>Delivery Charges</span>
                    <span className="font-mono-num">
                      {deliveryChargePkr === 0 ? 'Rs. 0 (Free)' : formatPkr(deliveryChargePkr)}
                    </span>
                  </div>
                  {discountPkr > 0 && (
                    <div className="flex justify-between text-[#B5945B]">
                      <span>Discount ({appliedDiscountCode})</span>
                      <span className="font-mono-num">-{formatPkr(discountPkr)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold text-[#2A231E] pt-3 border-t border-[#E5DDD0]">
                    <span>Final Total</span>
                    <span className="font-mono-num">{formatPkr(totalPkr)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-[#2A231E] text-[#FDFBF7] text-xs tracking-[0.1em] font-semibold uppercase rounded-lg hover:bg-[#3F352E] disabled:opacity-50 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-[#B5945B]" />
                  <span>{submitting ? 'Preparing Order...' : 'PLACE ORDER ON WHATSAPP'}</span>
                </button>
                <p className="text-[11px] text-center text-[#70685E]">
                  Official WhatsApp Destination: {BUSINESS_WHATSAPP_INTL} · Cash on Delivery / Bank Transfer
                </p>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
