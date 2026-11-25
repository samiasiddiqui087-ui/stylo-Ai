import { MessageCircle } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { getWhatsAppSupportUrl } from '../lib/whatsapp.ts';

export function Footer() {
  const { navigate, isAdmin } = useImmerso();

  return (
    <footer className="bg-[#2A231E] text-[#FDFBF7] mt-14 sm:mt-20">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
        <div>
          <p className="font-editorial text-2xl tracking-[0.2em] font-semibold mb-3">IMMERSO</p>
          <p className="text-sm text-[#E5DDD0]/80 leading-relaxed mb-4">
            Smart Shopping. Sharp Styling. Virtually Yours. Luxury fashion curation powered by conversational intelligence and private wardrobe architecture.
          </p>
          <a
            href={getWhatsAppSupportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-wrap items-center gap-2 max-w-full px-4 py-2 bg-[#B5945B] text-white text-xs font-semibold rounded-lg hover:opacity-95 transition-opacity"
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span>WhatsApp Concierge · +92 311 2537554</span>
          </a>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.15em] text-[#B5945B] font-semibold mb-4">
            Boutique
          </h4>
          <ul className="space-y-2.5 text-sm text-[#E5DDD0]/85">
            <li><button onClick={() => navigate('shop')} className="hover:text-white cursor-pointer">Shop All</button></li>
            <li><button onClick={() => navigate('collections')} className="hover:text-white cursor-pointer">Collections</button></li>
            <li><button onClick={() => navigate('inspiration')} className="hover:text-white cursor-pointer">Style Inspiration</button></li>
            <li><button onClick={() => navigate('ai-stylist')} className="hover:text-white cursor-pointer">AI Personal Stylist</button></li>
            <li><button onClick={() => navigate('wardrobe')} className="hover:text-white cursor-pointer">Virtual Wardrobe</button></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.15em] text-[#B5945B] font-semibold mb-4">
            Customer Care
          </h4>
          <ul className="space-y-2.5 text-sm text-[#E5DDD0]/85">
            <li><button onClick={() => navigate('order-tracking')} className="hover:text-white cursor-pointer">Order Tracking</button></li>
            <li><button onClick={() => navigate('contact')} className="hover:text-white cursor-pointer">Contact Us</button></li>
            <li><button onClick={() => navigate('faq')} className="hover:text-white cursor-pointer">FAQ</button></li>
            <li><button onClick={() => navigate('shipping')} className="hover:text-white cursor-pointer">Shipping Policy</button></li>
            <li><button onClick={() => navigate('returns')} className="hover:text-white cursor-pointer">Return & Refund Policy</button></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.15em] text-[#B5945B] font-semibold mb-4">
            House & Legal
          </h4>
          <ul className="space-y-2.5 text-sm text-[#E5DDD0]/85">
            <li><button onClick={() => navigate('about')} className="hover:text-white cursor-pointer">About IMMERSO</button></li>
            <li><button onClick={() => navigate('subscriptions')} className="hover:text-white cursor-pointer">Memberships</button></li>
            <li><button onClick={() => navigate('privacy')} className="hover:text-white cursor-pointer">Privacy Policy</button></li>
            <li><button onClick={() => navigate('terms')} className="hover:text-white cursor-pointer">Terms & Conditions</button></li>
            <li>
              <button
                onClick={() => navigate(isAdmin ? 'admin' : 'admin-login')}
                className="hover:text-white text-[#E5DDD0]/75 cursor-pointer"
              >
                {isAdmin ? 'Admin Console' : 'Admin Portal'}
              </button>
            </li>
            <li className="pt-2 flex items-center gap-4 text-xs text-[#E5DDD0]/70">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">Instagram</a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">Facebook</a>
              <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">Pinterest</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#E5DDD0]/15 py-5 px-4 sm:px-8 text-center text-xs text-[#E5DDD0]/60">
        © {new Date().getFullYear()} IMMERSO Luxury Fashion Atelier. All rights reserved.
      </div>
    </footer>
  );
}
