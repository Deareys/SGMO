/** Cambios de configuración sólo por administrador autenticado; CSRF se aplica en servidor. */
import { Router } from 'express';
import { authenticateToken, requireRole } from '../auth/authMiddleware.js';
import { isDbConfigured } from '../db/connection.js';
import { configurationRepository, ConfigurationValidationError } from '../db/repositories/ConfigurationRepository.js';
export const configRouter=Router();
const administratorOnly = [authenticateToken, requireRole('admin')];
function mutation(action:(req:any)=>Promise<void>) {
  return async(req:any,res:any)=>{
    if(!isDbConfigured()) {res.status(503).json({success:false,code:'SERVICE_UNAVAILABLE',message:'La configuración requiere PostgreSQL central disponible.'});return;}
    try {await action(req);res.json({success:true,catalog:await configurationRepository.getBootstrapCatalog()});}
    catch(error:any) {const validation=error instanceof ConfigurationValidationError;res.status(validation?error.status:error.code==='23505'?409:503).json({success:false,code:validation?'INVALID_CONFIGURATION':'SERVICE_UNAVAILABLE',message:validation?error.message:error.code==='23505'?'Ese código ya está registrado.':'No se pudo confirmar la configuración. Volvé a consultar el estado antes de reintentar.'});}
  };
}
configRouter.put('/settings',...administratorOnly,mutation(req=>configurationRepository.saveSettings(req.body,req.userSession.userId)));
configRouter.put('/zones',...administratorOnly,mutation(req=>configurationRepository.saveZones(req.body,req.userSession.userId)));
for(const kind of ['varieties','houses','carts'] as const) {
  configRouter.post(`/${kind}`,...administratorOnly,mutation(req=>configurationRepository.saveEntity(kind,req.body.id,req.body.attributes,req.userSession.userId,true)));
  configRouter.patch(`/${kind}/:id`,...administratorOnly,mutation(req=>configurationRepository.saveEntity(kind,req.params.id,req.body,req.userSession.userId)));
}
configRouter.put('/houses/:id/stock',...administratorOnly,mutation(req=>configurationRepository.adjustHouseStock(req.params.id,req.body,req.userSession.userId)));
