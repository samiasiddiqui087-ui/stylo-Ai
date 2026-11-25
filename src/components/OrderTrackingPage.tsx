import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, Clock, Package, Search, Truck, XCircle } from 'lucide-react';
import { db } from '../lib/firebase.ts';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatPkr, formatTimestamp } from '../lib/format.ts';
import { ORDER_STATUS_STEPS, type OrderTrackingRecord } from '../types/immerso.ts';

export function OrderTrackingPage() {
  const { orders, user } = useImmerso();
  const [orderIdInput, setOrderIdInput] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [trackedRecord, setTrackedRecord] = useState<OrderTrackingRecord | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setTrackedRecord(null);

    const cleanId = orderIdInput.trim().toUpperCase();
    const cleanLast4 = phoneLast4.replace(/\D/g, '').slice(-4);
    if (!cleanId || cleanLast4.length !== 4) {
      setLookupError('Enter your Order ID (e.g. IMM-XXXXXX) and the last 4 digits of your phone number.');
      return;
    }

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'orderTracking', cleanId));
      if (!snap.exists()) {
        setLookupError('No order found with that reference ID.');
        return;
      }
      const data = snap.data() as OrderTrackingRecord;
      if (data.phoneLast4 !== cleanLast4) {
        setLookupError('Phone verification digits do not match this order.');
        return;
      }
      setTrackedRecord(data);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Unable to retrieve tracking status.');
    } finally {
      setLoading(false);
    }
  };

  const renderTimeline = (status: string) => {
    if (status === 'Cancelled') {
      return (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <XCircle className="w-5 h-5" />
          <span>Order Cancelled. Contact +92 311 2537554 for support.</span>
        </div>
      );
    }

    const currentIdx = ORDER_STATUS_STEPS.indexOf(status as (typeof ORDER_STATUS_STEPS)[number]);
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-4">
        {ORDER_STATUS_STEPS.map((step, idx) => {
          const completed = idx <= currentIdx;
          return (
            <div
              key={step}
              className={`p-3 rounded-xl border text-center transition-colors ${
                completed
                  ? 'bg-[#2A231E] text-[#FDFBF7] border-[#2A231E]'
                  : 'bg-[#F7F3EC] text-[#70685E] border-[#E5DDD0]'
              }`}
            >
              <div className="flex justify-center mb-1.5">
                {idx === 0 && <Clock className="w-4 h-4" />}
                {idx > 0 && idx < 4 && <Package className="w-4 h-4" />}
                {idx >= 4 && idx < 6 && <Truck className="w-4 h-4" />}
                {idx === 6 && <CheckCircle2 className="w-4 h-4" />}
              </div>
              <p className="text-[11px] font-medium leading-tight">{step}</p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12 space-y-10">
      <div className="border-b border-[#E5DDD0] pb-6">
        <p className="text-xs text-[#70685E] mb-1">Concierge Dispatch</p>
        <h1 className="font-editorial text-4xl font-medium">Order Tracking</h1>
        <p className="text-sm text-[#70685E] mt-2">
          Verify your Order ID with the last 4 digits of your WhatsApp/mobile number to inspect live fulfillment status.
        </p>
      </div>

      {/* Lookup Form */}
      <form
        onSubmit={handleTrack}
        className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-medium text-[#70685E] mb-1">Order ID</label>
          <input
            type="text"
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="IMM-AB12CD"
            className="w-full px-3.5 py-2.5 text-sm font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#70685E] mb-1">
            Last 4 Digits of Phone
          </label>
          <input
            type="text"
            maxLength={4}
            value={phoneLast4}
            onChange={(e) => setPhoneLast4(e.target.value)}
            placeholder="7554"
            className="w-full px-3.5 py-2.5 text-sm font-mono-num bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 py-2.5 px-5 bg-[#2A231E] text-[#FDFBF7] text-sm font-medium rounded-lg hover:bg-[#3F352E] cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>{loading ? 'Checking...' : 'Track Order'}</span>
        </button>
      </form>

      {lookupError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl">
          {lookupError}
        </div>
      )}

      {trackedRecord && (
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DDD0]">
            <div>
              <p className="text-xs font-mono-num text-[#70685E]">
                {trackedRecord.orderId} · {formatTimestamp(trackedRecord.createdAt)}
              </p>
              <h2 className="font-editorial text-2xl font-medium mt-0.5">
                Status: {trackedRecord.status}
              </h2>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-[#70685E]">Destination: {trackedRecord.city}</p>
              <p className="font-mono-num text-lg font-semibold">
                {formatPkr(trackedRecord.totalPkr)}
              </p>
            </div>
          </div>
          <p className="text-sm text-[#70685E]">
            Items ({trackedRecord.itemCount}): {trackedRecord.itemSummary}
          </p>
          {renderTimeline(trackedRecord.status)}
        </div>
      )}

      {/* Authenticated Account Order History */}
      {user && orders.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-editorial text-2xl font-medium">Your Account Orders</h2>
          {orders.map((ord) => (
            <div
              key={ord.orderId}
              className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono-num text-[#70685E]">
                    {ord.orderId} · {formatTimestamp(ord.createdAt)}
                  </p>
                  <p className="font-semibold text-base mt-0.5">{ord.status}</p>
                  <p className="text-xs text-[#70685E] mt-1">
                    {ord.deliveryAddress}, {ord.city}
                  </p>
                </div>
                <p className="font-mono-num text-base font-semibold">{formatPkr(ord.totalPkr)}</p>
              </div>
              <div className="text-xs text-[#70685E]">
                {ord.items.map((i) => `${i.name} (${i.size}, ${i.color}) × ${i.quantity}`).join(' · ')}
              </div>
              {renderTimeline(ord.status)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
