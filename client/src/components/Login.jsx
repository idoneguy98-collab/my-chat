import React, { useState } from 'react';

export default function Login({ api, onAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${api}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');
      onAuth(data.token);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="mx-auto max-w-sm p-6 mt-24 bg-white dark:bg-gray-800 rounded-2xl shadow">
      <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">{mode === 'login' ? 'Login' : 'Sign Up'}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="w-full border rounded-xl p-3 dark:bg-gray-700 dark:text-white" placeholder="Username"
          value={username} onChange={e => setUsername(e.target.value)} />
        <input className="w-full border rounded-xl p-3 dark:bg-gray-700 dark:text-white" type="password" placeholder="Password"
          value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <button className="w-full p-3 rounded-xl bg-blue-600 text-white font-semibold">Continue</button>
      </form>
      <div className="text-center mt-3 text-sm">
        {mode === 'login' ? (
          <button className="underline" onClick={() => setMode('register')}>Create an account</button>
        ) : (
          <button className="underline" onClick={() => setMode('login')}>I have an account</button>
        )}
      </div>
    </div>
  );
}
