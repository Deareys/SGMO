/** Flujos de credencial personal, mismo CSRF/origen y mismo límite de intentos del login. */
import { Router, type Response } from 'express';
import { isDbConfigured } from '../db/connection.js';
import { authenticateToken, requireRole } from './authMiddleware.js';
import { clearSessionCookie } from './browserSecurity.js';
import { pinRateLimiter, recordFailedAttempt, recordSuccessfulAttempt } from './rateLimiter.js';
import { PasswordFlowError, passwordRepository } from '../db/repositories/PasswordRepository.js';

export const passwordRouter = Router();
passwordRouter.use(['/password-activations','/complete-password-activation','/change-password'], pinRateLimiter, (_req, res, next) => {
  if (!isDbConfigured()) { res.status(503).json({ success: false, code: 'DATABASE_REQUIRED', message: 'Esta operación requiere la base central.' }); return; }
  next();
});
const failure = (error: unknown, response: Response) => {
  if (error instanceof PasswordFlowError) return response.status(error.status).json({ success: false, code: error.code, message: error.message });
  return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'No se pudo confirmar el cambio en la base central. Volvé a consultar antes de reintentar.' });
};
function secret(value: unknown, maximum = 1024): value is string { return typeof value === 'string' && value.length > 0 && value.length <= maximum; }

passwordRouter.post('/password-activations', authenticateToken, requireRole('admin'), async (req, res) => {
  const body = req.body;
  if (!body || Object.keys(body).some(key => !['userId','currentPassword','identityConfirmed'].includes(key))
      || typeof body.userId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(body.userId)
      || !secret(body.currentPassword) || body.identityConfirmed !== true) {
    return res.status(400).json({ success: false, code: 'INVALID_REQUEST', message: 'Confirmá la identidad y tu contraseña para preparar el código.' });
  }
  try {
    const activation = await passwordRepository.issueActivation(body.userId, req.userSession!, body.currentPassword);
    recordSuccessfulAttempt(req);
    return res.json({ success: true, activation, message: 'Código preparado. Entregalo privadamente a la persona verificada.' });
  } catch (error) { if (error instanceof PasswordFlowError && error.status === 401) recordFailedAttempt(req); return failure(error, res); }
});
passwordRouter.post('/complete-password-activation', async (req, res) => {
  const body = req.body;
  if (!body || Object.keys(body).some(key => !['token','newPassword','confirmPassword'].includes(key))
      || !secret(body.token, 64) || !secret(body.newPassword) || body.newPassword !== body.confirmPassword) {
    return res.status(400).json({ success: false, code: 'INVALID_REQUEST', message: 'Revisá el código y la confirmación de la contraseña.' });
  }
  try {
    await passwordRepository.completeActivation(body.token, body.newPassword);
    recordSuccessfulAttempt(req);
    return res.json({ success: true, message: 'Contraseña guardada. Ingresá con tu código o correo y la nueva contraseña.' });
  } catch (error) { recordFailedAttempt(req); return failure(error, res); }
});
passwordRouter.post('/change-password', authenticateToken, async (req, res) => {
  const body = req.body;
  if (!body || Object.keys(body).some(key => !['currentCredential','newPassword','confirmPassword'].includes(key))
      || !secret(body.currentCredential) || !secret(body.newPassword) || body.newPassword !== body.confirmPassword) {
    return res.status(400).json({ success: false, code: 'INVALID_REQUEST', message: 'Revisá tu credencial actual y la confirmación de la nueva.' });
  }
  try {
    await passwordRepository.changePassword(req.userSession!, body.currentCredential, body.newPassword);
    clearSessionCookie(res); recordSuccessfulAttempt(req);
    return res.json({ success: true, message: 'Contraseña actualizada. Volvé a ingresar; tus ventas pendientes se conservan.' });
  } catch (error) { if (error instanceof PasswordFlowError && error.status === 401) recordFailedAttempt(req); return failure(error, res); }
});
