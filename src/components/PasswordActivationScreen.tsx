import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/apiClient';
import { storageService } from '../services/storageService';
import { MAX_NEW_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, validateAccountPassword } from '../shared/passwordPolicy';

/** El fragmento del enlace no llega al servidor ni se guarda en localStorage. */
export default function PasswordActivationScreen() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  const activate = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || complete) return;
    const policy = validateAccountPassword(password);
    if (!policy.isValid || password !== confirmation) { setError(policy.error || 'Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch('/api/auth/complete-password-activation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password, confirmPassword: confirmation }) });
      const result = await response.json();
      if (!response.ok || result.success !== true) { setError(result.message || 'No se pudo confirmar la activación.'); return; }
      setPassword(''); setConfirmation(''); setToken(''); setComplete(true);
      // No adopta una identidad desde el código. Retira una sesión anterior del dispositivo antes del login normal.
      await storageService.logout();
    } catch { setError('No se pudo confirmar la operación. Si se cortó la conexión, probá ingresar con tu nueva contraseña antes de repetirla.'); }
    finally { setBusy(false); }
  };
  const fieldClass = 'w-full min-h-12 rounded-xl border-2 border-slate-400 px-3 text-base';
  return <main className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
    <section className="w-full max-w-md bg-white rounded-2xl border-2 border-slate-300 p-5 space-y-4 text-slate-950">
      <h1 className="text-xl font-black">Elegí tu contraseña</h1>
      {complete ? <div role="status" className="space-y-4"><p>Tu contraseña quedó guardada. Ingresá con tu código o correo y tu nueva contraseña.</p><a href="/" className="min-h-12 flex items-center justify-center bg-emerald-100 border-2 border-emerald-700 rounded-xl font-bold">Ir al inicio de sesión</a></div>
        : <form onSubmit={activate} className="space-y-3">
          <p className="text-sm">Usá el código privado que te entregó el administrador después de verificar tu identidad.</p>
          <label className="block text-sm font-bold">Código de activación<input type="password" autoComplete="off" required maxLength={64} value={token} disabled={busy} onChange={event => setToken(event.target.value)} className={fieldClass} /></label>
          <label className="block text-sm font-bold">Nueva contraseña<input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_NEW_PASSWORD_LENGTH} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className={fieldClass} /></label>
          <p className="text-xs text-slate-700">Mínimo {MIN_PASSWORD_LENGTH} caracteres. Se permiten frases; evitá claves comunes o tu nombre/código.</p>
          <label className="block text-sm font-bold">Repetir contraseña<input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_NEW_PASSWORD_LENGTH} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} className={fieldClass} /></label>
          {error && <p role="alert" className="text-sm font-bold text-rose-900">{error}</p>}
          <button type="submit" disabled={busy} className="w-full min-h-12 rounded-xl border-2 border-amber-600 bg-amber-400 font-black disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar mi contraseña'}</button>
          <a href="/" className="min-h-12 flex items-center justify-center underline">Volver al inicio de sesión</a>
        </form>}
    </section>
  </main>;
}
