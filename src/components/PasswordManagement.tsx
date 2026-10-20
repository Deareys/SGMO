import React, { useState } from 'react';
import { authenticatedFetch } from '../services/apiClient';
import { storageService } from '../services/storageService';
import { validateAccountPassword, MIN_PASSWORD_LENGTH, MAX_NEW_PASSWORD_LENGTH } from '../shared/passwordPolicy';
import type { UserProfile } from '../types';

const inputClass = 'w-full min-h-12 rounded-xl border-2 border-slate-400 bg-white px-3 text-base text-slate-950';
const primaryClass = 'w-full min-h-12 rounded-xl border-2 border-amber-600 bg-amber-400 font-black text-slate-950 disabled:opacity-50';
const modalClass = 'fixed inset-0 z-[100] bg-slate-950/70 p-4 flex items-center justify-center overflow-y-auto';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentCredential, setCurrentCredential] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    const policy = validateAccountPassword(newPassword);
    if (!policy.isValid || newPassword !== confirmation) { setError(policy.error || 'Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentCredential, newPassword, confirmPassword: confirmation }) });
      const result = await response.json();
      if (!response.ok || result.success !== true) { setError(result.message || 'No se pudo confirmar el cambio.'); return; }
      setCurrentCredential(''); setNewPassword(''); setConfirmation('');
      storageService.clearSessionAfterPasswordChange();
      onClose();
    } catch { setError('No se pudo confirmar el cambio. Si perdiste la conexión, probá ingresar con la nueva contraseña antes de repetirlo.'); }
    finally { setBusy(false); }
  };
  return <div className={modalClass}>
    <section role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="w-full max-w-md rounded-2xl border-2 border-slate-300 bg-white p-5 space-y-4">
      <h2 id="change-password-title" className="text-xl font-black">Mi contraseña</h2>
      <p className="text-sm text-slate-800">Elegí tu nueva contraseña. Al guardar se cierran tus sesiones; las ventas pendientes se conservan en este dispositivo.</p>
      <form onSubmit={changePassword} className="space-y-3">
        <label className="block font-bold text-sm">Contraseña o PIN actual<input type="password" autoComplete="current-password" required maxLength={1024} disabled={busy} value={currentCredential} onChange={event => setCurrentCredential(event.target.value)} className={inputClass} /></label>
        <label className="block font-bold text-sm">Nueva contraseña<input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_NEW_PASSWORD_LENGTH} disabled={busy} value={newPassword} onChange={event => setNewPassword(event.target.value)} className={inputClass} /></label>
        <p className="text-xs text-slate-700">Mínimo {MIN_PASSWORD_LENGTH} caracteres. Podés usar una frase; evitá nombres, fechas y patrones comunes.</p>
        <label className="block font-bold text-sm">Repetir contraseña<input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_NEW_PASSWORD_LENGTH} disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} className={inputClass} /></label>
        {error && <p role="alert" className="text-sm font-bold text-rose-900">{error}</p>}
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Guardando…' : 'Guardar mi contraseña'}</button>
        <button type="button" disabled={busy} onClick={onClose} className="w-full min-h-12 border-2 border-slate-400 rounded-xl">Cancelar</button>
      </form>
    </section>
  </div>;
}

/** La clave final no pasa por el administrador. El código/link sólo vive en este modal. */
export function IssuePasswordActivationModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activation, setActivation] = useState<{ token: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const prepare = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const response = await authenticatedFetch('/api/auth/password-activations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, currentPassword: password, identityConfirmed }) });
      const result = await response.json();
      if (!response.ok || result.success !== true || !/^[a-f0-9]{64}$/.test(result.activation?.token)) { setError(result.message || 'No se pudo preparar el código.'); return; }
      setPassword(''); setActivation(result.activation);
    } catch { setError('No se pudo confirmar la preparación. Reintentá con conexión; un código nuevo reemplaza al anterior.'); }
    finally { setBusy(false); }
  };
  const link = activation ? `${window.location.origin}/activate#token=${activation.token}` : '';
  return <div className={modalClass}>
    <section role="dialog" aria-modal="true" aria-labelledby="activation-issue-title" className="w-full max-w-md rounded-2xl border-2 border-slate-300 bg-white p-5 space-y-4">
      <h2 id="activation-issue-title" className="text-xl font-black">Activar o restablecer contraseña</h2>
      <p className="text-sm text-slate-800">Cuenta: <strong>{user.name}</strong> ({user.userCode}). La persona elegirá su contraseña en su propio dispositivo.</p>
      {activation ? <div className="space-y-3">
        <p role="status" className="text-sm text-emerald-900 font-bold">Enlace preparado. Vence a las {new Date(activation.expiresAt).toLocaleTimeString('es-AR')} y sirve una sola vez.</p>
        <label className="block font-bold text-sm">Enlace privado de activación<textarea readOnly value={link} className={`${inputClass} min-h-24 break-all font-mono text-xs`} /></label>
        <button type="button" className={primaryClass} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError('Seleccioná y copiá el enlace manualmente.'); } }}>{copied ? 'Enlace copiado' : 'Copiar enlace privado'}</button>
        <p className="text-xs text-slate-700">Entregalo sólo a la persona cuya identidad verificaste. No lo publiques ni lo pegues en registros, capturas o chats de soporte. Al cerrar esta ventana no se podrá consultar otra vez.</p>
      </div> : <form onSubmit={prepare} className="space-y-3">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" required disabled={busy} checked={identityConfirmed} onChange={event => setIdentityConfirmed(event.target.checked)} className="w-6 h-6 shrink-0" /><span>Verifiqué presencialmente la identidad de esta persona.</span></label>
        <label className="block font-bold text-sm">Tu contraseña de administrador<input type="password" autoComplete="current-password" required maxLength={1024} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} className={inputClass} /></label>
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Preparando…' : 'Generar enlace de un solo uso'}</button>
      </form>}
      {error && <p role="alert" className="text-sm font-bold text-rose-900">{error}</p>}
      <button type="button" disabled={busy} onClick={onClose} className="w-full min-h-12 border-2 border-slate-400 rounded-xl">Cerrar</button>
    </section>
  </div>;
}
