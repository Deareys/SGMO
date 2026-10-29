import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/apiClient';
import { getLegacyBackup, downloadLegacyBackup } from '../services/legacyRecovery';
import { legacyCounts, sanitizeLegacyValue, type LegacyBackup } from '../shared/legacyBackup';
import { storageService } from '../services/storageService';
type Receipt = {id:string;sourceOrigin:string;counts:Record<string,number>;createdAt:string;catalogResult?:{complete:boolean;errors:string[];historyStatus:string}};

/** Recuperar desde el mismo origen o desde un archivo de otro dispositivo.
 * Guardar evidencia e incorporar catálogo son acciones separadas y explícitas.
 */
export const LegacyRecoveryPanel: React.FC = () => {
  const [candidate,setCandidate] = useState<LegacyBackup|null>(()=>getLegacyBackup());
  const [receipts,setReceipts] = useState<Receipt[]>([]);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const loadReceipts = async () => {
    const response=await authenticatedFetch('/api/legacy-imports'); const result=await response.json();
    if(!response.ok||!result.success) throw new Error(result.message||'No se pudo consultar los respaldos.');
    setReceipts(result.receipts);
  };
  useEffect(()=>{void loadReceipts().catch(failure=>setError(failure.message));},[]);
  const run = async (action:()=>Promise<void>)=>{
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();await loadReceipts();}catch(failure){setError(failure instanceof Error?failure.message:'No se confirmó la operación.');}finally{setBusy(false);}
  };
  return <section className="bg-white border-2 border-slate-400 rounded-xl p-5 space-y-4 text-slate-950">
    <h2 className="font-bold text-lg">Recuperar datos de la app anterior</h2>
    <p className="text-sm">Abrí esta sección en cada navegador que usaste antes. Primero guardá su respaldo en Neon; después podés incorporar casas, carritos, productos, usuarios y configuración. Las contraseñas anteriores no se trasladan.</p>
    <p className="text-sm">Las ventas, comprobantes, jornadas y otros registros anteriores se conservan dentro del respaldo descargable. Requieren revisión antes de convertirse en operaciones centrales; un comprobante anterior no acredita un pago.</p>
    <label className="block text-sm font-bold">Cargar un respaldo de otro dispositivo
      <input type="file" accept="application/json,.json" disabled={busy} className="block mt-2 max-w-full" onChange={async event=>{
        const file=event.target.files?.[0];if(!file)return;
        try{
          if(file.size>3_500_000)throw new Error('El archivo supera 3,5 MB. Conservá el original para su importación por el operador.');
          const parsed=JSON.parse(await file.text());
          if(parsed.format!=='sgmo-legacy-v1')throw new Error('Seleccioná un respaldo SGMO de recuperación.');
          setCandidate({...parsed,state:sanitizeLegacyValue(parsed.state)});
          setError('');setMessage('Archivo preparado; todavía no se envió.');
        }catch(failure){setError(failure instanceof Error?failure.message:'Archivo inválido.');}
      }}/>
    </label>
    {candidate && <>
      <p className="text-sm">Detectado: {Object.entries(legacyCounts(candidate.state)).filter(([,count])=>count>0).map(([key,count])=>`${key}: ${count}`).join(' · ')}</p>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} className="min-h-12 px-4 border-2 rounded-lg font-bold" onClick={()=>downloadLegacyBackup(candidate)}>Descargar respaldo anterior</button>
        <button disabled={busy} className="min-h-12 px-4 bg-amber-300 border-2 border-amber-600 rounded-lg font-bold" onClick={()=>void run(async()=>{
          const response=await authenticatedFetch('/api/legacy-imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(candidate)});
          const result=await response.json();if(!response.ok||!result.success)throw new Error(result.message||'No se confirmó el respaldo.');
          setMessage('Respaldo confirmado en Neon. El original sigue conservado en este navegador.');
        })}>Guardar respaldo en Neon</button>
      </div>
    </>}
    {!candidate && <p className="text-sm">Este navegador no tiene datos anteriores pendientes. Podés cargar el respaldo de otro dispositivo.</p>}
    {error && <p role="alert" className="text-red-800 font-bold">{error}</p>}
    {message && <p role="status" className="text-emerald-900 font-bold">{message}</p>}
    {receipts.map(receipt=><article key={receipt.id} className="border-2 rounded-lg p-3 space-y-2 text-sm">
      <p>Respaldo {new Date(receipt.createdAt).toLocaleString()} · {receipt.sourceOrigin}</p>
      <p>{Object.keys(receipt.counts).filter(key=>Number(receipt.counts[key])>0).map(key=>`${key}: ${receipt.counts[key]}`).join(' · ')}</p>
      <div className="flex flex-wrap gap-3">
        <a className="min-h-12 p-3 underline" href={`/api/legacy-imports/${receipt.id}`} download>Descargar desde Neon</a>
        <button disabled={busy||receipt.catalogResult?.complete} className="min-h-12 px-3 border-2 rounded-lg font-bold disabled:opacity-50" onClick={()=>{
          if(!window.confirm('Incorporar este catálogo y sus montos. Puede actualizar configuración existente; no reemplaza cuentas ya activadas ni confirma ventas antiguas.'))return;
          void run(async()=>{
            const response=await authenticatedFetch(`/api/legacy-imports/${receipt.id}/catalog`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true})});
            const result=await response.json();if(!response.ok||!result.success)throw new Error(result.message||'No se confirmó el catálogo.');
            await storageService.refreshCentralState();
            if(!result.result.complete)throw new Error('Incorporación parcial. El respaldo está a salvo: '+result.result.errors.join(' · '));
            setMessage('Catálogo incorporado. Asigná contraseñas a las cuentas nuevas antes de usarlas. El historial financiero continúa en el respaldo para revisión.');
          });
        }}>{receipt.catalogResult?.complete?'Catálogo incorporado':'Incorporar catálogo y configuración'}</button>
      </div>
      {receipt.catalogResult?.errors?.map((failure,index)=><p className="text-red-800" key={index}>{failure}</p>)}
    </article>)}
  </section>;
};
