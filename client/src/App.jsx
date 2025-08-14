import React, { useEffect, useMemo, useState } from 'react';
import jwtDecode from 'jwt-decode';
import Login from './components/Login.jsx';
import Messenger from './components/Messenger.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const user = useMemo(() => {
    if (!token) return null;
    try { return jwtDecode(token); } catch { return null; }
  }, [token]);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, []);

  if (!token || !user) return <Login api={API_URL} onAuth={setToken} />;
  return <Messenger api={API_URL} token={token} user={user} onLogout={() => setToken(null)} />;
}
