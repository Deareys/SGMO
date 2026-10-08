/**
 * SGMO — Tequeños Costa
 * Core Port: Notificador Sonoro y Háptico
 *
 * Contrato abstracto para retroalimentación táctil y acústica en la terminal de venta.
 */

export interface ISoundNotifier {
  playCashRegister(): void;
  playSuccess(): void;
  playAlert(): void;
  playError(): void;
  triggerHapticFeedback(pattern?: number[]): void;
}
