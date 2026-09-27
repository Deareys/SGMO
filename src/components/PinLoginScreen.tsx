/**
 * SGMO — Tequeños Costa
 * Pantalla de Inicio de Sesión Seguro mediante PIN Personal de 4 Dígitos
 * Alto Contraste Solar — Diseñado para lectura impecable bajo luz solar directa
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Delete,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
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
        setTimeout(() => setIsShaking(false), 500);
        setPin('');
      }
    }, 250);
  }, [onLoginSuccess]);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4 && !isAuthenticating && !loginSuccessUser) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        handleValidatePin(newPin);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isAuthenticating && !loginSuccessUser) {
      setPin(pin.slice(0, -1));
      setErrorMsg(null);
    }
  };

  const handleClear = () => {
    if (!isAuthenticating && !loginSuccessUser) {
      setPin('');
      setErrorMsg(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isAuthenticating, loginSuccessUser]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 relative select-none">
      <div className="w-full max-w-sm sm:max-w-md bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-8 shadow-xl relative z-10">
        
        {/* Identidad y Logo */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-400 border-2 border-amber-500 text-slate-950 font-black text-3xl shadow-md mb-2.5">
            🌮
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 flex items-center justify-center space-x-2">
            <span>SGMO</span>
            <span className="text-amber-900 font-bold text-xs px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300">
              Tequeños Costa
            </span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            Terminal de Gestión y Monitoreo Costero
          </p>
        </div>

        {/* Indicación */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold mb-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            <span>Acceso Seguro por PIN</span>
          </div>
          <p className="text-sm text-slate-900 font-black">
            Ingresá tu PIN de 4 dígitos
          </p>
        </div>

        {/* Visualizador de Dígitos (Dots de PIN) */}
        <div className={`flex justify-center items-center space-x-3.5 mb-5 ${isShaking ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((index) => {
            const hasDigit = pin.length > index;
            const isCurrent = pin.length === index;

            return (
              <div
                key={index}
                className={`w-12 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-150 ${
                  loginSuccessUser
                    ? 'border-emerald-600 bg-emerald-100 text-emerald-800 scale-105'
                    : hasDigit
                    ? 'border-amber-500 bg-amber-100 shadow-sm'
                    : isCurrent
                    ? 'border-amber-500 bg-white scale-105 shadow-inner'
                    : 'border-slate-300 bg-slate-50'
                }`}
              >
                {loginSuccessUser ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 animate-scale" />
                ) : hasDigit ? (
                  <div className="w-4 h-4 rounded-full bg-amber-500 shadow-sm" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                )}
              </div>
            );
          })}
        </div>

        {/* Mensaje de Error / Éxito */}
        <div className="min-h-[38px] flex items-center justify-center mb-3">
          {errorMsg && (
            <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-300 px-3.5 py-1.5 rounded-xl animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
          {isAuthenticating && !errorMsg && (
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span>Validando credencial...</span>
            </div>
          )}
          {loginSuccessUser && (
            <div className="flex items-center space-x-2 text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-400 px-3.5 py-1.5 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Bienvenido/a, {loginSuccessUser.name}</span>
            </div>
          )}
        </div>

        {/* Teclado Numérico Táctil con Alto Contraste */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              disabled={isAuthenticating || !!loginSuccessUser}
              className="h-13 sm:h-15 rounded-2xl bg-white hover:bg-slate-50 active:bg-amber-400 active:text-slate-950 active:scale-95 border-2 border-slate-300 hover:border-slate-400 text-2xl font-black text-slate-950 transition-all flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-50"
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
            className="h-13 sm:h-15 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 border-2 border-slate-300 text-xs font-bold text-slate-700 transition-all flex flex-col items-center justify-center space-y-0.5 cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-[10px]">Limpiar</span>
          </button>

          {/* Dígito 0 */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            disabled={isAuthenticating || !!loginSuccessUser}
            className="h-13 sm:h-15 rounded-2xl bg-white hover:bg-slate-50 active:bg-amber-400 active:text-slate-950 active:scale-95 border-2 border-slate-300 hover:border-slate-400 text-2xl font-black text-slate-950 transition-all flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-50"
          >
            0
          </button>

          {/* Botón Borrar 1 dígito */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isAuthenticating || !!loginSuccessUser || pin.length === 0}
            title="Borrar último dígito"
            className="h-13 sm:h-15 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 border-2 border-slate-300 text-slate-700 hover:text-rose-700 transition-all flex flex-col items-center justify-center space-y-0.5 cursor-pointer disabled:opacity-40"
          >
            <Delete className="w-5 h-5" />
            <span className="text-[10px]">Borrar</span>
          </button>
        </div>

        {/* Pie de seguridad */}
        <div className="mt-5 pt-3 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center space-x-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Acceso individual restringido por perfil operativo</span>
          </p>
        </div>

      </div>
    </div>
  );
};
