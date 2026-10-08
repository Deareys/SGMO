/**
 * SGMO — Tequeños Costa
 * Notification Adapter: Web Audio API & Haptic Feedback
 *
 * Implementa el puerto ISoundNotifier utilizando la API nativa de audio del navegador
 * y la API de vibración táctil para el uso en la orilla de la playa.
 */

import { ISoundNotifier } from '../../core/ports/ISoundNotifier';
import { soundAlerts } from '../../utils/soundAlerts';

export class WebAudioAdapter implements ISoundNotifier {
  playCashRegister(): void {
    soundAlerts.playTransferSuccessSound();
  }

  playSuccess(): void {
    soundAlerts.playTransferSuccessSound();
  }

  playAlert(): void {
    soundAlerts.playTransferAlertSound();
  }

  playError(): void {
    soundAlerts.playTransferAlertSound();
  }

  triggerHapticFeedback(pattern: number[] = [40, 30, 40]): void {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignorar si no está soportado
      }
    }
  }
}

export const webAudioAdapter = new WebAudioAdapter();
