import React, { createContext, useContext, useEffect, useState } from 'react';

const AdminAuthContext = createContext(null);

async function readResponse(response) {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return { error: `Admin API returned an invalid response (${response.status}).` };
  }
}

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    let response;
    try {
      response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) });
    } catch {
      throw new Error('Admin API is unavailable. Start the PostgreSQL server with npm run server.');
    }
    const result = await readResponse(response);
    if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
    setAdmin(result);
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAdmin(null);
  };

  const markPasswordChanged = () => setAdmin((current) => (current ? { ...current, mustChangePassword: false } : current));

  return <AdminAuthContext.Provider value={{ admin, loading, login, logout, markPasswordChanged }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
}