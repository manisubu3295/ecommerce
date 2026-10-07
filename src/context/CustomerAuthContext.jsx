import React, { createContext, useContext, useEffect, useState } from 'react';

const CustomerAuthContext = createContext(null);

async function readResponse(response) {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return { error: `Customer API returned an invalid response (${response.status}).` };
  }
}

// Entirely separate session from AdminAuthContext (different cookie, different
// table) — a shopper's login never touches the admin session, and vice versa.
export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  // Sign-in needs an emailed code, so it stays off until the store's email
  // (SMTP) is set up. Until then everyone checks out as a guest.
  const [accountsEnabled, setAccountsEnabled] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/customer/session', { credentials: 'include' })
        .then((response) => response.ok ? response.json() : null)
        .then(setCustomer)
        .catch(() => setCustomer(null)),
      fetch('/api/customer/auth-config')
        .then((response) => response.ok ? response.json() : null)
        .then((config) => setAccountsEnabled(Boolean(config?.accountsEnabled)))
        .catch(() => setAccountsEnabled(false)),
    ]).finally(() => setLoading(false));
  }, []);

  const post = async (path, payload, fallbackError) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
    const result = await readResponse(response);
    if (!response.ok) throw new Error(result.error || fallbackError);
    return result;
  };

  // signup and login return { otpRequired, challengeId, sentTo }; the session
  // only starts once verifyOtp succeeds with the emailed code.
  const signup = (payload) => post('/api/customer/signup', payload, 'Unable to create your account.');
  const login = (email, password) => post('/api/customer/login', { email, password }, 'Unable to sign in.');
  const resendOtp = (challengeId) => post('/api/customer/resend-otp', { challengeId }, 'Unable to send a new code.');
  const verifyOtp = async (challengeId, code) => {
    const result = await post('/api/customer/verify-otp', { challengeId, code }, 'Unable to verify the code.');
    setCustomer(result);
    return result;
  };

  const logout = async () => {
    await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
    setCustomer(null);
  };

  // Also replaces a temporary password; clears the "must change" state.
  const changePassword = async (currentPassword, newPassword) => {
    const response = await fetch('/api/customer/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ currentPassword, newPassword }) });
    const result = await readResponse(response);
    if (!response.ok) throw new Error(result.error || 'Your password could not be changed.');
    setCustomer((current) => (current ? { ...current, mustChangePassword: false } : current));
  };

  return <CustomerAuthContext.Provider value={{ customer, loading, accountsEnabled, signup, login, verifyOtp, resendOtp, logout, changePassword }}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return context;
}
