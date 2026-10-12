/**
 * SGMO — Tequeños Costa
 * Pantalla de Inicio de Sesión Modernizada (Hito 1.2)
 *
 * Soporta dos vías de autenticación:
 * 1. Trabajadores de Playa, Base y Fábrica: Código de cuenta individual + PIN personal de 8 dígitos.
 * 2. Administradores: Identificador (userCode/email) + Contraseña de al menos 14 caracteres.
 *
 * Alto Contraste Solar — Diseñado para lectura impecable bajo luz solar directa en la arena.
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
  RotateCcw,
  Users,
  Eye,
  EyeOff,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { UserProfile } from '../types';
import { storageService } from '../services/storageService';

interface PinLoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const PinLoginScreen: React.FC<PinLoginScreenProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'worker' | 'admin'>('worker');

  // Estado modo trabajador (PIN 8 dígitos)
  const [selectedUserCode, setSelectedUserCode] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [loginSuccessUser, setLoginSuccessUser] = useState<UserProfile | null>(null);

  // Estado modo administrador
  const [adminIdentifier, setAdminIdentifier] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);

  // La cuenta se identifica manualmente; no publicar un listado de trabajadores.
  const handleValidatePin = useCallback(
    async (pinToValidate: string) => {
      if (!/^\d{8}$/.test(pinToValidate)) return;

      setIsAuthenticating(true);
      setErrorMsg(null);

      try {
        const result = await storageService.loginWithPinAsync(pinToValidate, selectedUserCode);
        if (result.success && result.user) {
          setLoginSuccessUser(result.user);
          setTimeout(() => {
            onLoginSuccess(result.user!);
          }, 350);
        } else {
          setIsAuthenticating(false);
          setErrorMsg(result.error || 'PIN incorrecto o cuenta no válida.');
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          setPin('');
        }
      } catch (err: any) {
        setIsAuthenticating(false);
        setErrorMsg(err.message || 'Error al validar credenciales');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setPin('');
      }
    },
    [onLoginSuccess, selectedUserCode]
  );

  // Manejo de teclado táctil
  const handleKeyPress = (digit: string) => {
    if (pin.length < 8 && !isAuthenticating && !loginSuccessUser) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 8) {
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

  // Login de Administrador
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminIdentifier || !adminPassword) {
      setErrorMsg('Ingresá el identificador y la contraseña.');
      return;
    }

    setIsAuthenticating(true);
    setErrorMsg(null);

    try {
      const result = await storageService.loginAsAdminAsync(adminIdentifier, adminPassword);
      if (result.success && result.user) {
        setLoginSuccessUser(result.user);
        setTimeout(() => {
          onLoginSuccess(result.user!);
        }, 350);
      } else {
        setIsAuthenticating(false);
        setErrorMsg(result.error || 'Credenciales de administrador incorrectas.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      }
    } catch (err: any) {
      setIsAuthenticating(false);
      setErrorMsg(err.message || 'Error de conexión con el servidor.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  // Teclado físico sólo activo en pestaña de trabajador
  useEffect(() => {
    if (authMode !== 'worker') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
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
  }, [pin, isAuthenticating, loginSuccessUser, authMode, selectedUserCode]);

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

        {/* Selector de Modo: Trabajadores (PIN 8 dígitos) vs Administrador */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-300 mb-4">
          <button
            type="button"
            onClick={() => {
              setAuthMode('worker');
              setErrorMsg(null);
            }}
            className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              authMode === 'worker'
                ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-500'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>PIN Personal (8d)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('admin');
              setErrorMsg(null);
            }}
            className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              authMode === 'admin'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administración</span>
          </button>
        </div>

        {/* 1. MODO TRABAJADOR */}
        {authMode === 'worker' && (
          <div>
            {/* Identificador de Trabajador */}
            <div className="mb-3.5">
              <label htmlFor="worker-user-code" className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                Código de usuario:
              </label>
              <input
                id="worker-user-code"
                type="text"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Ingresá tu código de usuario"
                value={selectedUserCode}
                onChange={(e) => {
                  setSelectedUserCode(e.target.value);
                  setPin('');
                  setErrorMsg(null);
                }}
                disabled={isAuthenticating || !!loginSuccessUser}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Visualizador de Dígitos (8 Dots de PIN de Alto Contraste) */}
            <div className="text-center mb-3">
              <p className="text-xs text-slate-600 font-bold mb-2">
                Ingresá tu PIN de 8 dígitos ({pin.length}/8)
              </p>
              <div
                className={`flex justify-center items-center space-x-1.5 sm:space-x-2 ${
                  isShaking ? 'animate-bounce' : ''
                }`}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
                  const hasDigit = pin.length > index;
                  const isCurrent = pin.length === index;

                  return (
                    <div
                      key={index}
                      className={`w-7 sm:w-8 h-10 sm:h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-150 ${
                        loginSuccessUser
                          ? 'border-emerald-600 bg-emerald-100'
                          : hasDigit
                          ? 'border-amber-500 bg-amber-100 shadow-sm'
                          : isCurrent
                          ? 'border-amber-500 bg-white scale-105 shadow-inner'
                          : 'border-slate-300 bg-slate-50'
                      }`}
                    >
                      {loginSuccessUser ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : hasDigit ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mensajes de Estado */}
            <div className="min-h-[34px] flex items-center justify-center mb-2.5">
              {errorMsg && (
                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-3 py-1 rounded-xl animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {isAuthenticating && !errorMsg && (
                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>Validando con servidor central...</span>
                </div>
              )}
              {loginSuccessUser && (
                <div className="flex items-center space-x-1.5 text-[11px] font-black text-emerald-900 bg-emerald-100 border border-emerald-400 px-3 py-1 rounded-xl">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Bienvenido/a {loginSuccessUser.name}</span>
                </div>
              )}
            </div>

            {/* Teclado Numérico Táctil de Alto Contraste Solar */}
            <div className="grid grid-cols-3 gap-2 max-w-[270px] mx-auto mb-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  disabled={isAuthenticating || !!loginSuccessUser}
                  className="h-12 sm:h-13 rounded-2xl bg-white hover:bg-slate-50 active:bg-amber-400 active:text-slate-950 active:scale-95 border-2 border-slate-300 hover:border-slate-400 text-xl font-black text-slate-950 transition-all flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}

              {/* Botón Limpiar */}
              <button
                type="button"
                onClick={handleClear}
                disabled={isAuthenticating || !!loginSuccessUser || pin.length === 0}
                title="Limpiar todo"
                className="h-12 sm:h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 border-2 border-slate-300 text-xs font-bold text-slate-700 transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[9px]">Limpiar</span>
              </button>

              {/* Dígito 0 */}
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isAuthenticating || !!loginSuccessUser}
                className="h-12 sm:h-13 rounded-2xl bg-white hover:bg-slate-50 active:bg-amber-400 active:text-slate-950 active:scale-95 border-2 border-slate-300 hover:border-slate-400 text-xl font-black text-slate-950 transition-all flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-50"
              >
                0
              </button>

              {/* Botón Borrar 1 dígito */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isAuthenticating || !!loginSuccessUser || pin.length === 0}
                title="Borrar dígito"
                className="h-12 sm:h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 border-2 border-slate-300 text-slate-700 hover:text-rose-700 transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <Delete className="w-4 h-4" />
                <span className="text-[9px]">Borrar</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. MODO ADMINISTRACIÓN (Contraseña de al menos 14 caracteres) */}
        {authMode === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-3.5 mb-2">
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                Identificador / Correo de Administrador:
              </label>
              <input
                type="text"
                value={adminIdentifier}
                onChange={(e) => setAdminIdentifier(e.target.value)}
                placeholder="Ingresá tu código o correo"
                autoComplete="username"
                required
                disabled={isAuthenticating || !!loginSuccessUser}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                Contraseña (mínimo 14 caracteres):
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••••••••"
                  required
                  disabled={isAuthenticating || !!loginSuccessUser}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 pr-9 focus:outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Mensajes de Estado */}
            <div className="min-h-[30px] flex items-center justify-center">
              {errorMsg && (
                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-3 py-1 rounded-xl">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {isAuthenticating && !errorMsg && (
                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-300 px-3 py-1 rounded-xl">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-slate-700" />
                  <span>Verificando credenciales de administración...</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isAuthenticating || !!loginSuccessUser}
              className="w-full h-12 bg-slate-900 hover:bg-slate-950 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <span>Ingresar a Administración</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Pie de seguridad */}
        <div className="mt-4 pt-3 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center space-x-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Autenticación scrypt individual protegida contra fuerza bruta</span>
          </p>
        </div>

      </div>
    </div>
  );
};
