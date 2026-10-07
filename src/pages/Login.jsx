import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Seo from '../components/Seo.jsx';
import OtpStep from '../components/OtpStep.jsx';
import AccountsUnavailable from '../components/AccountsUnavailable.jsx';

export default function Login() {
  const { theme } = useTheme();
  const { login, accountsEnabled, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { handleCheckout } = useCart();
  const fromCheckout = searchParams.get('next') === 'checkout';
  const [form, setForm] = useState({ email: '', password: '' });
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const disabled = !loading && !accountsEnabled;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // Right password → a code is emailed; the session starts after it.
      setChallenge(await login(form.email, form.password));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const verified = (account) => {
    if (account.mustChangePassword) navigate('/account');
    else if (fromCheckout) {
      // Back to where checkout was opened, with checkout open again.
      navigate(location.state?.from || '/shop', { replace: true });
      handleCheckout();
    } else navigate('/account');
  };

  return (
    <>
      <Seo path="/login" title="Sign In" noindex />
      <main className="max-w-md mx-auto px-4 py-24 w-full">
        <div className="border border-current/10 p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.25em] opacity-50 mb-3">Your account</p>
          <h1 className={`text-3xl font-bold tracking-tight ${theme.fontHeading}`}>{challenge ? 'Check your email' : 'Sign in'}</h1>
          <p className="opacity-60 mt-3 mb-8">Track orders, save addresses, and check out faster.</p>
          {disabled && <AccountsUnavailable />}
          {challenge
            ? <OtpStep challenge={challenge} onVerified={verified} onBack={() => setChallenge(null)} accentColor={theme.accentColor} />
            : <form onSubmit={submit}>
              <fieldset disabled={disabled} className={`space-y-5 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <label className="block"><span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Email</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="username" className="w-full bg-transparent border border-current/20 px-4 py-3 outline-none" /></label>
                <label className="block"><span className="flex items-center justify-between text-xs font-bold uppercase tracking-widest mb-2"><span className="opacity-60">Password</span>{!disabled && <Link to={{ pathname: '/forgot-password', search: location.search }} state={location.state} className="normal-case tracking-normal font-semibold underline underline-offset-4 opacity-80">Forgot password?</Link>}</span><input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" className="w-full bg-transparent border border-current/20 px-4 py-3 outline-none" /></label>
                {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
                <button className="w-full py-4 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50" style={{ backgroundColor: theme.accentColor }}>{submitting ? 'Sending code…' : 'Sign in'}</button>
              </fieldset>
            </form>}
          {!challenge && !disabled && <p className="text-sm opacity-60 mt-6">New here? <Link to={{ pathname: '/signup', search: location.search }} state={location.state} className="underline underline-offset-4 font-semibold">Create an account</Link></p>}
        </div>
      </main>
    </>
  );
}
