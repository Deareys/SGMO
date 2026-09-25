import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, X, AlertCircle, Image as ImageIcon, Check } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackFileInputRef = useRef<HTMLInputElement>(null);

  // Iniciar la cámara cuando se abre el modal
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPhoto(null);
      setCameraError(null);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (facing: 'environment' | 'user') => {
    setIsLoadingCamera(true);
    setCameraError(null);
    stopCamera();

    // Comprobar soporte de mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Tu navegador o dispositivo no soporta acceso directo a la cámara. Podés subir el comprobante desde la galería.');
      setIsLoadingCamera(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((err) => {
          console.warn('Error al reproducir video de cámara:', err);
        });
      }
    } catch (err: any) {
      console.warn('Fallo al solicitar cámara con facingMode:', facing, err);
      // Intento de fallback a cualquier cámara disponible
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        console.error('Error total accediendo a la cámara:', fallbackErr);
        setCameraError(
          fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError'
            ? 'Permiso de cámara denegado. Podés habilitarlo en los ajustes o seleccionar una imagen desde la galería.'
            : 'No se pudo acceder a la cámara trasera. Podés cargar el comprobante usando el archivo de imagen.'
        );
      }
    } finally {
      setIsLoadingCamera(false);
    }
  };

  // Capturar fotograma actual
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = canvasRef.current || document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  // Reintentar tomar foto
  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera(facingMode);
  };

  // Confirmar foto tomada
  const handleConfirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  // Alternar entre cámara trasera y delantera (si el dispositivo tiene ambas)
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Fallback para seleccionar imagen desde el explorador / galería
  const handleFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      onCapture(base64);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Fotografiar Comprobante</h3>
              <p className="text-[11px] text-slate-400">Enfocá la pantalla del comprador con Mercado Pago</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de Video / Foto Tomada */}
        <div className="relative bg-black flex-1 min-h-[300px] max-h-[500px] flex items-center justify-center overflow-hidden">
          {capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Comprobante capturado"
              className="w-full h-full object-contain max-h-[460px]"
            />
          ) : cameraError ? (
            <div className="p-6 text-center space-y-4 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Cámara no disponible</h4>
                <p className="text-xs text-slate-400">{cameraError}</p>
              </div>
              <button
                type="button"
                onClick={() => fallbackFileInputRef.current?.click()}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 cursor-pointer transition-all"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Elegir Comprobante desde Galería</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover sm:object-contain max-h-[460px]"
              />

              {/* Guía visual para centrar la pantalla del celular del comprador */}
              <div className="absolute inset-x-8 inset-y-10 border-2 border-dashed border-sky-400/60 rounded-2xl pointer-events-none flex flex-col justify-between p-3 bg-sky-950/10">
                <div className="text-[11px] font-semibold text-sky-300 bg-slate-950/80 px-2.5 py-1 rounded-md self-center backdrop-blur-sm shadow">
                  Alineá el comprobante de Mercado Pago aquí
                </div>
                <div className="text-[10px] text-slate-300 text-center bg-slate-950/70 px-2 py-0.5 rounded backdrop-blur-sm">
                  Cámara trasera activa (prioridad alta resolución)
                </div>
              </div>

              {isLoadingCamera && (
                <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center space-x-2 text-sky-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Iniciando cámara trasera...</span>
                </div>
              )}
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
          <input
            type="file"
            ref={fallbackFileInputRef}
            accept="image/*"
            onChange={handleFallbackFileSelect}
            className="hidden"
          />
        </div>

        {/* Barra de Controles Inferiores */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          {capturedPhoto ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Volver a Tomar</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Usar Esta Foto</span>
              </button>
            </>
          ) : !cameraError ? (
            <>
              {/* Botón de cambio de lente / alternar */}
              <button
                type="button"
                onClick={toggleFacingMode}
                title="Cambiar de cámara"
                className="p-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Disparador de Foto Gigante */}
              <button
                type="button"
                onClick={takeSnapshot}
                disabled={isLoadingCamera}
                className="flex-1 py-3.5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-xl shadow-sky-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                <span>Capturar Foto</span>
              </button>

              {/* Botón de acceso a Galería como alternativa directa */}
              <button
                type="button"
                onClick={() => fallbackFileInputRef.current?.click()}
                title="Subir desde galería"
                className="p-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl transition-all"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
            >
              Cerrar
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
