import React from 'react';

/** Aclara qué módulos aún conservan registros sólo en el navegador, sin prometer sincronización. */
export function LocalOperationNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="bg-amber-50 border-2 border-amber-500 text-slate-950 p-4 rounded-xl text-sm space-y-1">
      <p className="font-bold">Registros locales de este dispositivo</p>
      <p>{children}</p>
      <p>No se comparten automáticamente con otros dispositivos. No borres los datos del navegador.</p>
    </div>
  );
}
