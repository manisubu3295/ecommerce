import React, { useState } from 'react';

// Customer password change, also used right after signing in with a
// temporary password from the shop.
export default function ChangePasswordForm({ changePassword, theme, temporary = false, onDone }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    if (form.next.length < 8) { setError('Your new password must have at least 8 characters.'); return; }
    if (form.next !== form.confirm) { setError('The two new passwords don’t match.'); return; }
    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setSaved(true);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, autoComplete) => <label className="block"><span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2">{label}</span><input required type="password" autoComplete={autoComplete} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="w-full border border-current/20 bg-transparent px-4 py-3 outline-none focus:border-current" /></label>;

  return <form onSubmit={submit} className="space-y-4 max-w-md">
    {field('current', temporary ? 'Temporary password we gave you' : 'Current password', 'current-password')}
    {field('next', 'New password (at least 8 characters)', 'new-password')}
    {field('confirm', 'Type the new password again', 'new-password')}
    {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    {saved && <p className="text-sm text-green-700" role="status">Password changed.</p>}
    <button disabled={saving} className="px-6 py-3 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50" style={{ backgroundColor: theme.accentColor }}>{saving ? 'Saving…' : temporary ? 'Set my new password' : 'Change password'}</button>
  </form>;
}
