import { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Check, Crown, MessageCircle, Send } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { db } from '../lib/firebase.ts';
import { formatPkr } from '../lib/format.ts';
import { BUSINESS_WHATSAPP_INTL, getWhatsAppSupportUrl } from '../lib/whatsapp.ts';
import { HERO_WARDROBE_IMAGE } from '../data/seedCatalog.ts';
import { SmartImage } from './SmartImage.tsx';

export function SubscriptionsPage() {
  const { siteConfig, userProfile } = useImmerso();
  const currentPlan = userProfile?.plan || 'free';

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-8 py-14 space-y-10">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs text-[#70685E] mb-1">Atelier Memberships</p>
        <h1 className="font-editorial text-4xl font-medium">Elevate Your Styling Studio</h1>
        <p className="text-sm text-[#70685E] mt-2">
          Begin with complimentary wardrobe organization or request an IMMERSO Premium upgrade via concierge verification.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs text-[#70685E]">Complimentary Tier</p>
            <h2 className="font-editorial text-3xl font-medium mt-1">IMMERSO Essential</h2>
            <p className="font-mono-num text-2xl font-semibold mt-4">Rs. 0 / month</p>
            <ul className="mt-6 space-y-3 text-sm text-[#2A231E]/85">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B5945B] shrink-0" /> {siteConfig.freePlanAiLimit} AI Stylist sessions / month</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B5945B] shrink-0" /> Private Digital Wardrobe</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B5945B] shrink-0" /> Monthly & Weekly Outfit Planner</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B5945B] shrink-0" /> Direct WhatsApp Concierge Checkout</li>
            </ul>
          </div>
          <div className="mt-8 pt-4 border-t border-[#E5DDD0] text-xs font-medium text-[#70685E]">
            {currentPlan === 'free' ? 'Current Active Plan' : 'Included Base Tier'}
          </div>
        </div>

        <div className="bg-[#2A231E] text-[#FDFBF7] border border-[#B5945B] rounded-2xl p-5 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#B5945B] text-xs font-medium">
              <Crown className="w-4 h-4" />
              <span>Atelier Priority</span>
            </div>
            <h2 className="font-editorial text-3xl font-medium mt-1">IMMERSO Privé</h2>
            <p className="font-mono-num text-2xl font-semibold mt-4">
              {formatPkr(siteConfig.premiumPlanPricePkr)} / month
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[#E5DDD0]">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B5945B]" /> {siteConfig.premiumPlanAiLimit} AI Stylist & Outfit Generator requests</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B5945B]" /> Priority AI Virtual Try-On rendering</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B5945B]" /> Deep wardrobe pairing & bespoke capsule edits</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B5945B]" /> Early access to Luxury & Couture capsules</li>
            </ul>
          </div>
          <div className="mt-8">
            {currentPlan === 'premium' ? (
              <p className="text-xs font-semibold text-[#B5945B]">Current Active Plan</p>
            ) : (
              <a
                href={getWhatsAppSupportUrl('Hello IMMERSO! I would like to activate the IMMERSO Privé Premium membership.')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#B5945B] text-white text-xs font-semibold rounded-lg hover:opacity-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Request Upgrade via WhatsApp Concierge</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutPage() {
  const { navigate } = useImmerso();
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 py-14 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-4">
          <p className="text-xs text-[#70685E]">Our House</p>
          <h1 className="font-editorial text-4xl sm:text-5xl font-medium leading-tight">
            Smart Shopping. Sharp Styling. Virtually Yours.
          </h1>
          <p className="text-sm text-[#2A231E]/85 leading-relaxed">
            IMMERSO merges timeless boutique craftsmanship with personal styling intelligence. Built around a calm editorial aesthetic of champagne silk, warm travertine, and tailored silhouettes, our platform transforms how you organize your closet, plan daily outfits, and shop curated luxury collections.
          </p>
          <p className="text-sm text-[#70685E] leading-relaxed">
            Whether consulting our conversational AI stylist, building a capsule wardrobe, or ordering directly through our WhatsApp atelier concierge ({BUSINESS_WHATSAPP_INTL}), every detail is designed for effortless confidence.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('shop')}
              className="px-6 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg cursor-pointer"
            >
              Explore Boutique
            </button>
            <button
              onClick={() => navigate('ai-stylist')}
              className="px-6 py-2.5 border border-[#E5DDD0] text-xs font-medium rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
            >
              Meet Your AI Stylist
            </button>
          </div>
        </div>

        <div className="aspect-[16/10] rounded-2xl overflow-hidden border border-[#E5DDD0]">
          <SmartImage src={HERO_WARDROBE_IMAGE} alt="IMMERSO Walk-in Wardrobe" className="w-full h-full object-cover" />
        </div>
      </div>
    </section>
  );
}

export function ContactPage() {
  const { notify } = useImmerso();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const id = `inq_${Date.now()}`;
    try {
      await setDoc(doc(db, 'inquiries', id), {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: subject.trim(),
        message: message.trim(),
        status: 'New',
        createdAt: serverTimestamp(),
      });
      notify('Your inquiry has been received by the IMMERSO concierge team.', 'success');
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to send inquiry.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-8 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
      <div className="md:col-span-5 space-y-4">
        <p className="text-xs text-[#70685E]">Atelier Concierge</p>
        <h1 className="font-editorial text-4xl font-medium">Contact IMMERSO</h1>
        <p className="text-sm text-[#70685E] leading-relaxed">
          Need sizing guidance, private bridal styling, or an update on your order? Connect directly via WhatsApp or send our team a note.
        </p>
        <a
          href={getWhatsAppSupportUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-wrap items-center justify-center gap-2 max-w-full px-5 py-3 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg text-center"
        >
          <MessageCircle className="w-4 h-4 text-[#B5945B] shrink-0" />
          <span>Chat on WhatsApp ({BUSINESS_WHATSAPP_INTL})</span>
        </a>
      </div>

      <form
        onSubmit={handleSubmit}
        className="md:col-span-7 bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#70685E] mb-1">Full Name *</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-[#70685E] mb-1">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#70685E] mb-1">Phone / WhatsApp</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-[#70685E] mb-1">Subject *</label>
            <input
              type="text"
              required
              minLength={2}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#70685E] mb-1">Message *</label>
          <textarea
            rows={4}
            required
            minLength={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{sending ? 'Sending...' : 'Send Message'}</span>
        </button>
      </form>
    </section>
  );
}

export function FaqPage() {
  const faqs = [
    {
      q: 'How does direct WhatsApp ordering work?',
      a: `Add your pieces to the bag, fill out your delivery details in Checkout, and tap "PLACE ORDER ON WHATSAPP". Your order is saved as Pending WhatsApp Confirmation and a pre-filled summary opens directly to ${BUSINESS_WHATSAPP_INTL}. Tap Send in WhatsApp to confirm.`,
    },
    {
      q: 'Is my Virtual Wardrobe private?',
      a: 'Yes. Your wardrobe items, saved outfits, schedules, and uploaded photos are protected by strict Firebase Authentication and Firestore Security Rules so only your account can access them.',
    },
    {
      q: 'Does the AI Shopping Assistant use real inventory?',
      a: 'Yes. Every product card, PKR price, size, and stock count displayed by the AI Stylist and Chatbot comes directly from the live IMMERSO catalog.',
    },
    {
      q: 'How long does delivery take across Pakistan?',
      a: 'Standard atelier dispatch takes 2–4 business days in major cities (Karachi, Lahore, Islamabad) and 4–6 business days nationwide.',
    },
  ];
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-8 py-14 space-y-6">
      <h1 className="font-editorial text-4xl font-medium">Frequently Asked Questions</h1>
      <div className="space-y-4">
        {faqs.map((item) => (
          <div key={item.q} className="bg-white border border-[#E5DDD0] rounded-2xl p-6">
            <h2 className="font-semibold text-base mb-2">{item.q}</h2>
            <p className="text-sm text-[#70685E] leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PolicyPage({ type }: { type: 'privacy' | 'terms' | 'shipping' | 'returns' }) {
  const copy = {
    privacy: {
      title: 'Privacy Policy',
      body: 'IMMERSO respects your personal style data and privacy. Uploaded wardrobe photos, personal measurements, and virtual try-on previews remain strictly scoped to your authenticated profile and can be deleted by you at any time. Order delivery details are used exclusively to fulfill your shipments.',
    },
    terms: {
      title: 'Terms & Conditions',
      body: 'All prices are listed in Pakistani Rupees (PKR). Submitting a WhatsApp order creates a pending order reference subject to stock verification and confirmation by the IMMERSO concierge team on +923112537554.',
    },
    shipping: {
      title: 'Shipping Policy',
      body: 'Orders confirmed before 3:00 PM PKT dispatch within 24 hours. Complimentary express shipping applies automatically above the boutique threshold; otherwise standard flat-rate courier charges apply.',
    },
    returns: {
      title: 'Return & Refund Policy',
      body: 'Unworn garments with original IMMERSO tags attached may be exchanged or returned within 7 days of delivery. Contact our WhatsApp concierge (+923112537554) with your Order ID to initiate a pickup.',
    },
  }[type];

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-8 py-14 space-y-4">
      <h1 className="font-editorial text-4xl font-medium">{copy.title}</h1>
      <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 sm:p-8 text-sm text-[#70685E] leading-relaxed">
        {copy.body}
      </div>
    </section>
  );
}
