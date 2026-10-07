import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';

// Second step of sign-in / sign-up: the 6-digit code emailed to the shopper.
export default function OtpStep({ challenge, onVerified, onBack, accentColor }) {
  const { verifyOtp, resendOtp } = useCustomerAuth();
  const [current, setCurrent] = useState(challenge);
  const [code, setCode] = useState('');
  const [state, setState] = useState({ sending: false, error: '', notice: '' });

  const submit = async (event) => {
    event.preventDefault();
    setState({ sending: true, error: '', notice: '' });
    try {
      onVerified(await verifyOtp(current.challengeId, code));
    } catch (error) {
      setState({ sending: false, error: error.message, notice: '' });
    }
  };

  const resend = async () => {
    setState({ sending: true, error: '', notice: '' });
    try {
      const next = await resendOtp(current.challengeId);
      setCurrent(next);
      setCode('');
      setState({ sending: false, error: '', notice: `A new code was sent to ${next.sentTo}.` });
    } catch (error) {
      setState({ sending: false, error: error.message, notice: '' });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="flex gap-3 opacity-80"><MailCheck size={20} className="shrink-0 mt-0.5" /> <span>We emailed a 6-digit code to <strong>{current.sentTo}</strong>. It expires in 10 minutes.</span></p>
      <label className="block">
        <span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Verification code</span>
        <input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full bg-transparent border border-current/20 px-4 py-3 outline-none focus:border-current text-2xl tracking-[0.5em] font-mono" />
      </label>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state.notice && <p className="text-sm opacity-70" role="status">{state.notice}</p>}
      <button disabled={state.sending || code.length !== 6} className="w-full py-4 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50" style={{ backgroundColor: accentColor }}>{state.sending ? 'Checking…' : 'Verify and continue'}</button>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" onClick={resend} disabled={state.sending} className="underline underline-offset-4 font-semibold disabled:opacity-50">Send a new code</button>
        <button type="button" onClick={onBack} className="underline underline-offset-4 opacity-70">Use a different email</button>
      </div>
    </form>
  );
}
