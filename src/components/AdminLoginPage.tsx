import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';

export function AdminLoginPage() {
  const { adminAuthReady, loginAdmin, navigate } = useImmerso();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Invalid email or password. Access Denied.');
      return;
    }

    setSubmitting(true);
    try {
      await loginAdmin(trimmedEmail, password);
      setPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password. Access Denied.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!adminAuthReady) {
    return (
      <section className="max-w-lg mx-auto px-4 sm:px-8 py-24 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#B5945B] mb-3" />
        <p className="text-xs tracking-[0.18em] uppercase text-[#70685E]">
          Verifying Admin Security Session
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
      <button
        type="button"
        onClick={() => navigate('home')}
        className="inline-flex items-center gap-2 text-xs font-medium text-[#70685E] hover:text-[#2A231E] mb-6 cursor-pointer transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to IMMERSO Boutique</span>
      </button>

      <div className="bg-white border border-[#E5DDD0] rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-[#2A231E] text-[#FDFBF7] px-5 sm:px-10 py-6 sm:py-7 border-b border-[#B5945B]/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#B5945B] font-semibold mb-1.5">
                IMMERSO Private Atelier
              </p>
              <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight">
                Admin Portal Login
              </h1>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#FDFBF7]/10 border border-[#B5945B]/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#B5945B]" />
            </div>
          </div>
          <p className="text-xs text-[#E5DDD0]/80 mt-2.5 leading-relaxed">
            Authorized administrator access only. Sign in with your registered email and password to manage products, orders, customers, analytics, and website settings.
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} className="p-5 sm:p-10 space-y-5" noValidate>
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-medium uppercase tracking-[0.14em] text-[#70685E] mb-2"
            >
              Administrator Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#70685E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter registered admin email"
                className="w-full pl-10 pr-4 py-3 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl text-[#2A231E] placeholder-[#70685E]/60 focus:outline-none focus:border-[#B5945B] transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium uppercase tracking-[0.14em] text-[#70685E] mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#70685E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-11 py-3 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-xl text-[#2A231E] placeholder-[#70685E]/60 focus:outline-none focus:border-[#B5945B] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#70685E] hover:text-[#2A231E] cursor-pointer transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold uppercase tracking-[0.18em] rounded-xl hover:bg-[#3F352E] disabled:opacity-65 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#B5945B]" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-[#B5945B]" />
                <span>Secure Login</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-[#70685E] pt-1">
            Visitors and retail customers should use the standard boutique storefront.
          </p>
        </form>
      </div>
    </section>
  );
}
