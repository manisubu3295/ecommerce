import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Seo from '../components/Seo.jsx';
import OtpStep from '../components/OtpStep.jsx';
import AccountsUnavailable from '../components/AccountsUnavailable.jsx';

export default function Signup() {
  const { theme } = useTheme();
  const { signup, accountsEnabled, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { handleCheckout } = useCart();
  const fromCheckout = searchParams.get('next') === 'checkout';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState('');
  const disabled = !loading && !accountsEnabled;
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // The account is created, then confirmed with the emailed code.
      setChallenge(await signup(form));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const verified = () => {
    if (fromCheckout) {
      // Back to where checkout was opened, with checkout open again.
      navigate(location.state?.from || '/shop', { replace: true });
      handleCheckout();
    } else navigate('/account');
  };

  return (
    <>
      <Seo path="/signup" title="Create Account" noindex />
      <main className="max-w-md mx-auto px-4 py-24 w-full">
        <div className="border border-current/10 p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.25em] opacity-50 mb-3">Your account</p>
          <h1 className={`text-3xl font-bold tracking-tight ${theme.fontHeading}`}>{challenge ? 'Verify your email' : 'Create an account'}</h1>
          <p className="opacity-60 mt-3 mb-8">Save addresses and see your order history in one place.</p>
          {disabled && <AccountsUnavailable />}
          {challenge
            ? <OtpStep challenge={challenge} onVerified={verified} onBack={() => setChallenge(null)} accentColor={theme.accentColor} />
            : <form onSubmit={submit}>
            <fieldset disabled={disabled} className={`space-y-5 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <label className="block"><span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Full name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full bg-transparent border border-current/20 px-4 py-3 outline-none" /></label>
            <label className="block"><span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Email</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="username" className="w-full bg-transparent border border-current/20 px-4 py-3 outline-none" /></label>
            <label className="block"><span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Mobile number <span className="normal-case tracking-normal opacity-60">(optional)</span></span><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full bg-transparent border border-current/20 px-4 py-3 outline-none" /></label>
            <label className="block"><span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Password</span><input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" className="w-full bg-transparent border border-current/20 px-4 py-3 outline-none" /></label>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button className="w-full py-4 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50" style={{ backgroundColor: theme.accentColor }}>{submitting ? 'Sending code…' : 'Create account'}</button>
            </fieldset>
          </form>}
          {!challenge && !disabled && <p className="text-sm opacity-60 mt-6">Already have an account? <Link to={{ pathname: '/login', search: location.search }} state={location.state} className="underline underline-offset-4 font-semibold">Sign in</Link></p>}
        </div>
      </main>
    </>
  );
}
