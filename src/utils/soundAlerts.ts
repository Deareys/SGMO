/**
 * SGMO — Sistema de Alertas Sonoras Web Audio API
 * Archivo: src/utils/soundAlerts.ts
 *
 * Emite notificaciones acústicas en tiempo real cuando ingresa una transferencia
 * con error, sospechosa o que requiere revisión por parte del Administrador o Coordinador.
 * No depende de archivos externos ni peticiones de red (funciona 100% offline).
 */

class SoundAlertManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Restaurar preferencia de sonido si existe
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sgmo_sound_alerts_enabled');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Alerta acústica para transferencias sospechosas, con error o que requieren revisión.
   * Genera un doble tono de advertencia distintivo y urgente (880Hz -> 660Hz -> 880Hz).
   */
  public playTransferAlertSound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Primer Beep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, now); // La5
      osc1.frequency.exponentialRampToValueAtTime(660, now + 0.12);

      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.18);

      // Segundo Beep (urgencia ascendente para llamar la atención en la playa)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(1087.77, now + 0.22);
      osc2.frequency.exponentialRampToValueAtTime(1483.99, now + 0.38);

      gain2.gain.setValueAtTime(0.35, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.22);
      osc2.stop(now + 0.42);
    } catch (e) {
      console.warn('No se pudo reproducir el sonido de alerta:', e);
    }
  }

  /**
   * Tono melódico agradable para confirmación de pago acreditado exitosamente.
   * Acorde arpegiado C-E-G (Do-Mi-Sol).
   */
  public playTransferSuccessSound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + index * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.2, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.25);
      });
    } catch (e) {
      console.warn('No se pudo reproducir el sonido de éxito:', e);
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sgmo_sound_alerts_enabled', String(enabled));
    }
  }
}

export const soundAlerts = new SoundAlertManager();
