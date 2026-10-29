/**
 * SGMO — Tequeños Costa
 * Pantalla de Inicio de Sesión Modernizada (Hito 1.2)
 *
 * Un único formulario sin selector de perfiles. El servidor decide el rol.
 * Dos campos: código/correo y contraseña. Compatibilidad histórica sólo en el servicio.
 *
 * Alto Contraste Solar — Diseñado para lectura impecable bajo luz solar directa en la arena.
 */

import React, { useState } from 'react';
import {
  Lock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
  ChevronRight,
} from 'lucide-react';
import { UserProfile } from '../types';
import { storageService } from '../services/storageService';

interface PinLoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const PinLoginScreen: React.FC<PinLoginScreenProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [credential, setCredential] = useState('');
  const [showCredential, setShowCredential] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginSuccessUser, setLoginSuccessUser] = useState<UserProfile | null>(null);
  const busy = isAuthenticating || !!loginSuccessUser;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setIsAuthenticating(true);
    setErrorMsg(null);
    try {
      const result = await storageService.loginWithCredentialAsync(identifier, credential);
      if (result.success && result.user) {
        setLoginSuccessUser(result.user);
        onLoginSuccess(result.user);
        return;
      }
      setErrorMsg(result.error || 'No se pudo verificar tu acceso.');
    } catch {
      setErrorMsg('No se pudo conectar con el servidor. Volvé a intentarlo con conexión.');
    }
    setIsAuthenticating(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-3 sm:p-4 relative select-none">
      <div className="w-full max-w-sm sm:max-w-md bg-white border-2 border-slate-300 rounded-3xl p-5 sm:p-7 shadow-xl relative z-10">
        
        {/* Identidad de Marca */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-400 border-2 border-amber-500 text-slate-950 font-black text-2xl shadow-md mb-2">
            🌮
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 flex items-center justify-center space-x-2">
            <span>SGMO</span>
            <span className="text-amber-900 font-bold text-xs px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300">
              Tequeños Costa
            </span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            Terminal Operativo de Playa y Producción
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" aria-label="Inicio de sesión">
          <p className="text-sm text-slate-700">Ingresá tus datos personales de acceso.</p>
          <div>
            <label htmlFor="login-identifier" className="block text-sm font-bold text-slate-800 mb-1">
              Código de usuario o correo
            </label>
            <input id="login-identifier" name="username" type="text" autoComplete="username"
              autoCapitalize="none" spellCheck={false} maxLength={254} required value={identifier}
              onChange={event => { setIdentifier(event.target.value); setErrorMsg(null); }}
              disabled={busy} placeholder="Tu código o correo"
              className="w-full min-h-12 bg-slate-50 border-2 border-slate-300 rounded-xl px-3 text-base font-semibold text-slate-950 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label htmlFor="login-credential" className="block text-sm font-bold text-slate-800 mb-1">Contraseña</label>
            <div className="relative">
              <input id="login-credential" name="password" type={showCredential ? 'text' : 'password'}
                autoComplete="current-password" autoCapitalize="none" spellCheck={false} inputMode="text"
                enterKeyHint="go" maxLength={1024} required value={credential} disabled={busy}
                onChange={event => { setCredential(event.target.value); setErrorMsg(null); }}
                aria-describedby="login-credential-help"
                className="w-full min-h-12 bg-slate-50 border-2 border-slate-300 rounded-xl pl-3 pr-14 text-base font-semibold text-slate-950 focus:outline-none focus:border-amber-500" />
              <button type="button" aria-label={showCredential ? 'Ocultar credencial' : 'Mostrar credencial'}
                aria-pressed={showCredential} disabled={busy} onClick={() => setShowCredential(current => !current)}
                className="absolute right-0 top-0 min-h-12 min-w-12 flex items-center justify-center text-slate-700">
                {showCredential ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p id="login-credential-help" className="text-xs text-slate-600 mt-1">
              Ingresá la contraseña de tu cuenta.
            </p>
          </div>

          <div aria-live="polite" className="min-h-8">
            {errorMsg && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 border-2 border-rose-300 p-3 text-sm font-bold text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{errorMsg}</span>
            </p>}
            {isAuthenticating && <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Sparkles className="w-4 h-4 animate-spin" />Verificando tu acceso…
            </p>}
            {loginSuccessUser && <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />Acceso confirmado.
            </p>}
          </div>
          <button type="submit" disabled={busy} className="w-full min-h-12 bg-amber-400 border-2 border-amber-500 rounded-xl text-slate-950 font-black flex items-center justify-center gap-2 active:bg-amber-500 disabled:opacity-50">
            <span>Ingresar</span><ChevronRight className="w-4 h-4" />
          </button>
        </form>

        {/* Pie de seguridad */}
        <div className="mt-4 pt-3 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center space-x-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Acceso personal verificado en el servidor</span>
          </p>
        </div>

      </div>
    </div>
  );
};
