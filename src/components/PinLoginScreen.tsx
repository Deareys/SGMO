/**
 * SGMO — Tequeños Costa
 * Pantalla de Inicio de Sesión Modernizada (Hito 1.2)
 *
 * Un único formulario sin selector de perfiles. El servidor decide el rol.
 * Conserva dos contratos de credencial:
 * 1. Trabajadores de Playa, Base y Fábrica: Código de cuenta individual + PIN personal de 8 dígitos.
 * 2. Administradores: Identificador (userCode/email) + Contraseña de al menos 14 caracteres.
 *
 * Alto Contraste Solar — Diseñado para lectura impecable bajo luz solar directa en la arena.
 */

import React, { useState } from 'react';
import {
  Lock,
  Delete,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RotateCcw,
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
  const numericCredential = /^\d{0,8}$/.test(credential);

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

  const appendDigit = (digit: string) => {
    if (!busy && numericCredential && credential.length < 8) {
      setCredential(current => current + digit);
      setErrorMsg(null);
    }
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
              onChange={event => { setIdentifier(event.target.value); setCredential(''); setErrorMsg(null); }}
              disabled={busy} placeholder="Tu código o correo"
              className="w-full min-h-12 bg-slate-50 border-2 border-slate-300 rounded-xl px-3 text-base font-semibold text-slate-950 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label htmlFor="login-credential" className="block text-sm font-bold text-slate-800 mb-1">PIN o contraseña</label>
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
              Usá tu PIN de 8 dígitos o tu contraseña de al menos 14 caracteres.
            </p>
          </div>

          <details className="rounded-xl border-2 border-slate-300 bg-slate-50">
            <summary className="min-h-12 px-3 flex items-center cursor-pointer font-bold text-sm text-slate-800">
              Teclado numérico para PIN
            </summary>
            <div className="grid grid-cols-3 gap-2 p-3" aria-label="Teclado numérico">
              {['1','2','3','4','5','6','7','8','9'].map(digit => (
                <button key={digit} type="button" onClick={() => appendDigit(digit)}
                  disabled={busy || !numericCredential || credential.length === 8}
                  className="h-12 rounded-xl bg-white border-2 border-slate-300 text-xl font-black text-slate-950 active:bg-amber-400 disabled:opacity-40">{digit}</button>
              ))}
              <button type="button" aria-label="Limpiar credencial" disabled={busy || !credential}
                onClick={() => { setCredential(''); setErrorMsg(null); }}
                className="h-12 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center text-slate-800 disabled:opacity-40">
                <RotateCcw className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => appendDigit('0')} disabled={busy || !numericCredential || credential.length === 8}
                className="h-12 rounded-xl bg-white border-2 border-slate-300 text-xl font-black text-slate-950 active:bg-amber-400 disabled:opacity-40">0</button>
              <button type="button" aria-label="Borrar último carácter" disabled={busy || !credential}
                onClick={() => { setCredential(current => current.slice(0,-1)); setErrorMsg(null); }}
                className="h-12 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center text-slate-800 disabled:opacity-40">
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </details>

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
          <a href="/setup" className="min-h-12 flex items-center justify-center text-xs font-semibold text-slate-700 underline">Configuración inicial del negocio</a>
          <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center space-x-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Acceso personal verificado en el servidor</span>
          </p>
        </div>

      </div>
    </div>
  );
};
