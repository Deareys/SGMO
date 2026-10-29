import React, { useState } from 'react';
import { authenticatedFetch } from '../services/apiClient';
import { validateAccountPassword } from '../shared/passwordPolicy';

/** Activación única por el dueño. Nunca guarda contraseñas ni códigos de activación en caché. */
export default function InitialOwnerSetup() {
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const activateOwner = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || completed) return;
    setError('');
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    const policy = validateAccountPassword(password, [ownerEmail]);
    if (!policy.isValid) { setError(policy.error!); return; }
    setBusy(true);
    try {
      const response = await authenticatedFetch('/api/auth/bootstrap-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'ADM-01', newPassword: password, bootstrapSecret: activationCode,
          ownerName: ownerName.trim(), ownerEmail: ownerEmail.trim() })
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        setError(response.status === 403 ? 'La activación no está disponible o el código no es válido. Contactá al responsable de la instalación.'
          : response.status === 400 ? 'Revisá el nombre, correo y contraseña ingresados.'
          : response.status === 429 ? 'Demasiados intentos. Esperá antes de volver a probar.'
          : 'No se pudo confirmar la activación. Volvé a intentar con conexión al servidor.');
        return;
      }
      setPassword(''); setConfirmation(''); setActivationCode(''); setCompleted(true);
    } catch {
      setError('No se pudo confirmar la activación. Si se cortó la conexión, probá ingresar con tu correo y contraseña antes de repetirla.');
    } finally { setBusy(false); }
  };

  const fieldClass = 'w-full min-h-12 rounded-xl border-2 border-slate-400 bg-white px-3 text-base text-slate-950';
  return (
    <main className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl border-2 border-slate-300 bg-white p-5 space-y-4">
        <h1 className="text-xl font-black text-slate-950">Activar el negocio</h1>
        {completed ? (
          <div role="status" className="space-y-4 text-slate-900">
            <p>La cuenta del dueño está activada. Ya podés ingresar con tu correo y tu contraseña.</p>
            <a href="/" className="min-h-12 flex items-center justify-center rounded-xl border-2 border-emerald-700 bg-emerald-100 font-bold">Ir al inicio de sesión</a>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-800">Este paso se realiza una sola vez. El dueño del negocio elige su contraseña y administra las cuentas del equipo.</p>
            <form onSubmit={activateOwner} className="space-y-3" aria-label="Activación del dueño">
              <label className="block text-sm font-bold text-slate-900">Nombre del dueño
                <input name="owner-name" autoComplete="name" required maxLength={120} value={ownerName} disabled={busy} onChange={event => setOwnerName(event.target.value)} className={fieldClass} />
              </label>
              <label className="block text-sm font-bold text-slate-900">Correo del dueño
                <input type="email" name="owner-email" autoComplete="username" autoCapitalize="none" required maxLength={160} value={ownerEmail} disabled={busy} onChange={event => setOwnerEmail(event.target.value)} className={fieldClass} />
              </label>
              <label className="block text-sm font-bold text-slate-900">Nueva contraseña
                <input type="password" name="new-password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className={fieldClass} aria-describedby="owner-password-help" />
              </label>
              <p id="owner-password-help" className="text-xs text-slate-700">Al menos 12 caracteres. Podés usar una frase; evitá claves comunes. Guardala en tu gestor de contraseñas.</p>
              <label className="block text-sm font-bold text-slate-900">Repetir contraseña
                <input type="password" name="confirm-password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} className={fieldClass} />
              </label>
              <label className="block text-sm font-bold text-slate-900">Código privado de activación
                <input type="password" name="activation-code" autoComplete="off" required minLength={32} maxLength={1024} value={activationCode} disabled={busy} onChange={event => setActivationCode(event.target.value)} className={fieldClass} aria-describedby="owner-activation-help" />
              </label>
              <p id="owner-activation-help" className="text-xs text-slate-700">Lo proporciona el responsable de la instalación. No lo compartas por chat ni lo uses como contraseña.</p>
              {error && <p role="alert" className="rounded-xl border-2 border-rose-400 bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</p>}
              <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl border-2 border-amber-600 bg-amber-400 font-black text-slate-950 disabled:opacity-50">{busy ? 'Activando…' : 'Activar cuenta del dueño'}</button>
            </form>
            <a href="/" className="min-h-12 flex items-center justify-center text-slate-800 underline">Volver al inicio de sesión</a>
          </>
        )}
      </section>
    </main>
  );
}
