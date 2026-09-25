/**
 * SGMO — Tequeños Costa
 * Pantalla de Inicio de Sesión Seguro mediante PIN Personal de 4 Dígitos
 * Acceso individual, privado y directo por rol
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Delete,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import { UserProfile } from '../types';
import { storageService } from '../services/storageService';

interface PinLoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const PinLoginScreen: React.FC<PinLoginScreenProps> = ({ onLoginSuccess }) => {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [loginSuccessUser, setLoginSuccessUser] = useState<UserProfile | null>(null);

  const handleValidatePin = useCallback((pinToValidate: string) => {
    if (pinToValidate.length !== 4) return;

    setIsAuthenticating(true);
    setErrorMsg(null);

    // Pequeño retardo para dar feedback táctil y visual fluido
    setTimeout(() => {
      const result = storageService.loginWithPin(pinToValidate);
      if (result.success && result.user) {
        setLoginSuccessUser(result.user);
        setTimeout(() => {
          onLoginSuccess(result.user!);
        }, 400);
      } else {
        setIsAuthenticating(false);
        setErrorMsg(result.error || 'PIN incorrecto. Acceso denegado.');
        setIsShaking(true);
        setPin('');
        setTimeout(() => setIsShaking(false), 600);
      }
    }, 250);
  }, [onLoginSuccess]);

  const handleKeyPress = useCallback((num: string) => {
    if (isAuthenticating || loginSuccessUser) return;
    setErrorMsg(null);
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + num;
      if (next.length === 4) {
        handleValidatePin(next);
      }
      return next;
    });
  }, [isAuthenticating, loginSuccessUser, handleValidatePin]);

  const handleDelete = useCallback(() => {
    if (isAuthenticating || loginSuccessUser) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isAuthenticating, loginSuccessUser]);

  const handleClear = useCallback(() => {
    if (isAuthenticating || loginSuccessUser) return;
    setErrorMsg(null);
    setPin('');
  }, [isAuthenticating, loginSuccessUser]);

  // Soporte para teclado físico
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, handleDelete, handleClear]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Fondos decorativos sutiles */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        
        {/* Identidad y Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black text-3xl shadow-lg shadow-amber-500/20 mb-3">
            🌮
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-2">
            <span>SGMO</span>
            <span className="text-amber-400 font-medium text-xs px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
              Tequeños Costa
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistema de Gestión y Monitoreo de Operación Costera
          </p>
        </div>

        {/* Mensaje de Bienvenida / Indicación */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium mb-2">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Acceso Seguro por PIN</span>
          </div>
          <p className="text-sm text-slate-300 font-semibold">
            Ingresá tu PIN personal de 4 dígitos
          </p>
        </div>

        {/* Visualizador de Dígitos (Dots de PIN) */}
        <div className={`flex justify-center items-center space-x-4 mb-6 ${isShaking ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((index) => {
            const hasDigit = pin.length > index;
            const isCurrent = pin.length === index;

            return (
              <div
                key={index}
                className={`w-12 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-200 ${
                  loginSuccessUser
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 scale-105'
                    : hasDigit
                    ? 'border-amber-500 bg-amber-500/15 shadow-md shadow-amber-500/10'
                    : isCurrent
                    ? 'border-amber-400/60 bg-slate-950 scale-105 shadow-inner'
                    : 'border-slate-800 bg-slate-950/70'
                }`}
              >
                {loginSuccessUser ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-scale" />
                ) : hasDigit ? (
                  <div className="w-4 h-4 rounded-full bg-amber-400 shadow-sm shadow-amber-300 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-700" />
                )}
              </div>
            );
          })}
        </div>

        {/* Mensaje de Error / Éxito */}
        <div className="min-h-[38px] flex items-center justify-center mb-4">
          {errorMsg && (
            <div className="flex items-center space-x-2 text-xs font-medium text-rose-400 bg-rose-950/70 border border-rose-800/80 px-3.5 py-1.5 rounded-xl animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {isAuthenticating && !errorMsg && (
            <div className="flex items-center space-x-2 text-xs font-medium text-amber-400 bg-amber-950/50 border border-amber-800/60 px-3 py-1 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Validando credencial...</span>
            </div>
          )}
          {loginSuccessUser && (
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3.5 py-1.5 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
              <span>Bienvenido/a, {loginSuccessUser.name}</span>
            </div>
          )}
        </div>

        {/* Teclado Numérico Táctil */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              disabled={isAuthenticating || !!loginSuccessUser}
              className="h-14 sm:h-16 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 active:bg-amber-500 active:text-slate-950 active:scale-95 border border-slate-700/70 text-xl font-bold text-white transition-all flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
            >
              {digit}
            </button>
          ))}

          {/* Botón Limpiar */}
          <button
            type="button"
            onClick={handleClear}
            disabled={isAuthenticating || !!loginSuccessUser || pin.length === 0}
            title="Borrar todo"
            className="h-14 sm:h-16 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 active:scale-95 border border-slate-800 text-xs font-bold text-slate-400 hover:text-slate-200 transition-all flex flex-col items-center justify-center space-y-0.5 focus:outline-none disabled:opacity-30"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-[10px]">Limpiar</span>
          </button>

          {/* Dígito 0 */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            disabled={isAuthenticating || !!loginSuccessUser}
            className="h-14 sm:h-16 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 active:bg-amber-500 active:text-slate-950 active:scale-95 border border-slate-700/70 text-xl font-bold text-white transition-all flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
          >
            0
          </button>

          {/* Botón Borrar 1 dígito */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isAuthenticating || !!loginSuccessUser || pin.length === 0}
            title="Borrar último dígito"
            className="h-14 sm:h-16 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 active:scale-95 border border-slate-800 text-slate-400 hover:text-rose-400 transition-all flex flex-col items-center justify-center space-y-0.5 focus:outline-none disabled:opacity-30"
          >
            <Delete className="w-5 h-5" />
            <span className="text-[10px]">Borrar</span>
          </button>
        </div>

        {/* Pie de seguridad */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center space-x-1">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Acceso individual restringido por perfil operativo</span>
          </p>
        </div>

      </div>
    </div>
  );
};
