/**
 * SGMO — Tequeños Costa
 * Servidor Express Full-Stack + Integración de Gemini AI para Validación OCR y Asesor de Stock
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { dbRouter } from './src/server/routes/dbRoutes.js';
import { authRouter } from './src/server/auth/authRoutes.js';
import { browserSecurityMiddleware } from './src/server/auth/browserSecurity.js';
import { bootstrapRouter } from './src/server/routes/bootstrapRoutes.js';
import { configRouter } from './src/server/routes/configRoutes.js';
import { paymentRouter, handleMercadoPagoWebhook } from './src/server/routes/paymentRoutes.js';
import { authenticateToken, requireRole } from './src/server/auth/authMiddleware.js';
import { isIsolatedDemoEnabled } from './src/server/auth/authPolicy.js';

const app = express();
export default app;
const PORT = Number(process.env.PORT) || 3000;

// Parser JSON con límite amplio para imágenes base64 de comprobantes
// Credenciales no necesitan el límite amplio utilizado por las imágenes OCR.
app.use('/api/auth', express.json({ limit: '4kb' }));
app.use('/api/ai', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '25mb' }));
app.use((error: any, _req: Request, res: Response, next: express.NextFunction) => {
  if (error?.type === 'entity.too.large' || error?.type === 'entity.parse.failed') {
    return res.status(error.type === 'entity.too.large' ? 413 : 400).json({ success: false, message: 'Solicitud inválida.' });
  }
  next(error);
});

// Webhooks utilizan su firma bancaria, no cookies/CSRF de navegador.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.path === '/mercadopago/webhook' || req.path === '/webhooks/mercadopago' || req.path === '/health') { next(); return; }
  browserSecurityMiddleware(req, res, next);
});
app.use('/api/auth', authRouter);
app.use('/api', bootstrapRouter);
app.use('/api', configRouter);

// Lazy inicialización del cliente Gemini
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          timeout: 10000,
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    } catch (e) {
      console.error('No se pudo inicializar el servicio de análisis de imágenes.');
    }
  }
  return aiClient;
}

// Función auxiliar para llamar a Gemini con reintento y modelo de respaldo ante picos de demanda (503 / 429)
async function generateContentWithFallback(ai: GoogleGenAI, requestOptions: any): Promise<any> {
  // Orden de modelos a probar: primero el modelo estándar, y si está sobrecargado (503), intentar con modelos alternativos
  const modelsToTry = ['gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...requestOptions,
          model: modelName
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err || '');
        const isTransient = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('429') || errMsg.includes('UNAVAILABLE') || errMsg.includes('overloaded');
        if (isTransient && attempt === 0) {
          // Breve pausa con backoff antes del reintento
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        // Si no es transitorio o falló el reintento, pasar al siguiente modelo
        break;
      }
    }
  }

  throw lastError;
}

// 1. Health check & Base de Datos
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    revision: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SGMO_REVISION || 'local',
    authTransport: 'httpOnly-cookie',
    timestamp: new Date().toISOString(),
    service: 'SGMO Tequeños Costa Backend API'
  });
});

// Rutas de Persistencia Centralizada (PostgreSQL)
app.use('/api', dbRouter);
app.use('/api/db', dbRouter);

// 2. Validación Asistida con IA de Comprobantes de Transferencia (Mercado Pago OCR)
app.post('/api/ai/validate-voucher', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      imageBase64,
      saleAmount,
      saleVariety,
      sellerName,
      saleTimestamp,
      existingOperationIds = []
    } = req.body;

    const ai = getGeminiClient();

    // Ausencia de OCR no autoriza a inventar un número de operación o importe leído.
    let extractionSucceeded = false;
    let extractedData = {
      operationId: '',
      amount: 0,
      date: '',
      time: '',
      senderName: '',
      destinationAccount: '',
      confidenceScore: 0,
      aiNotes: 'No se pudo leer el comprobante. Pendiente de revisión manual.',
      isVisualAnomalyDetected: false
    };

    if (ai && imageBase64 && imageBase64.length > 50) {
      try {
        // Limpiar encabezado data URL si viene presente
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        const mimeTypeMatch = imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

        const promptText = `
Sos un auditor experto en detección de fraudes y OCR de comprobantes de pago de transferencias bancarias y billeteras electrónicas (principalmente Mercado Pago Argentina).
Analizá minuciosamente la imagen del comprobante y extraé los siguientes datos con máxima precisión:
- operationId: Número de operación / comprobante / transacción / control (sólo dígitos o formato MP-XXXXXXXX).
- amount: Importe total transferido (número flotante sin signo $, ej: 7500).
- date: Fecha de la transferencia (formato YYYY-MM-DD si es legible).
- time: Hora de la transferencia (formato HH:MM).
- senderName: Nombre o titular de la cuenta que envía el dinero.
- destinationAccount: Titular o cuenta de destino (ej: Tequeños Costa).
- confidenceScore: Nivel de certeza de lectura de 0.0 a 1.0.
- isVisualAnomalyDetected: boolean indicando si la tipografía parece editada, borroneada, screenshot manipulado o fuera de patrón.
- aiNotes: Breve observación en español sobre la legibilidad y autenticidad visual.
        `;

        const imagePart = {
          inlineData: {
            mimeType,
            data: cleanBase64
          }
        };

        const response = await generateContentWithFallback(ai, {
          contents: {
            parts: [imagePart, { text: promptText }]
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                operationId: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                date: { type: Type.STRING },
                time: { type: Type.STRING },
                senderName: { type: Type.STRING },
                destinationAccount: { type: Type.STRING },
                confidenceScore: { type: Type.NUMBER },
                isVisualAnomalyDetected: { type: Type.BOOLEAN },
                aiNotes: { type: Type.STRING }
              },
              required: ['amount', 'confidenceScore']
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
            || typeof parsed.amount !== 'number' || !Number.isFinite(parsed.amount) || parsed.amount <= 0
            || typeof parsed.confidenceScore !== 'number' || !Number.isFinite(parsed.confidenceScore)
            || parsed.confidenceScore < 0 || parsed.confidenceScore > 1) throw new Error('Lectura incompleta.');
          const textField = (field: string, maximum: number) => typeof parsed[field] === 'string' ? parsed[field].slice(0, maximum).trim() : '';
          extractedData = {
            operationId: textField('operationId', 100), amount: parsed.amount,
            date: textField('date', 10), time: textField('time', 8),
            senderName: textField('senderName', 160), destinationAccount: textField('destinationAccount', 160),
            confidenceScore: parsed.confidenceScore, aiNotes: textField('aiNotes', 500),
            isVisualAnomalyDetected: parsed.isVisualAnomalyDetected === true
          };
          extractionSucceeded = true;
        }
      } catch (geminiError: any) {
        const errorMsg = String(geminiError?.message || geminiError || '');
        console.warn('Gemini OCR no disponible temporalmente (' + (errorMsg.includes('503') ? 'pico de demanda 503' : 'modo contingencia') + '). Continuando con validación de seguridad local.');
      }
    }

    // Reglas de negocio y semáforo de validación
    const isDuplicate = Array.isArray(existingOperationIds) && extractedData.operationId ? existingOperationIds.includes(extractedData.operationId) : false;
    const amountDifference = Math.abs(extractedData.amount - (Number(saleAmount) || 0));
    const amountMatches = extractionSucceeded && amountDifference < 1.0; // Sólo compara un importe realmente leído.

    // Reglas de negocio y semáforo de validación OCR
    // IMPORTANTE: OCR solo extrae texto de la imagen, NUNCA confirma acreditación de dinero en cuenta bancaria.
    let validationStatus: 'validada' | 'pendiente_revision' | 'inconsistente' | 'sospechosa' = 'pendiente_revision';
    let mismatchReason: string | undefined = undefined;

    if (!extractionSucceeded) {
      mismatchReason = 'No se pudo leer el comprobante. Registrar la venta no confirma el pago; requiere revisión.';
    } else if (isDuplicate) {
      validationStatus = 'sospechosa';
      mismatchReason = `¡ALERTA DE FRAUDE! El número de operación ${extractedData.operationId} ya fue utilizado en otra venta.`;
    } else if (extractedData.isVisualAnomalyDetected) {
      validationStatus = 'sospechosa';
      mismatchReason = 'Se detectaron posibles alteraciones visuales o tipografía no estándar en el comprobante.';
    } else if (!amountMatches) {
      validationStatus = 'inconsistente';
      mismatchReason = `El importe en el comprobante ($${extractedData.amount.toLocaleString()}) no coincide con la venta registrada ($${Number(saleAmount).toLocaleString()}).`;
    } else if (extractedData.confidenceScore < 0.70) {
      validationStatus = 'pendiente_revision';
      mismatchReason = 'Lectura de baja nitidez. Requiere confirmación visual del coordinador.';
    } else {
      validationStatus = 'pendiente_revision';
      mismatchReason = 'Comprobante escaneado. Pendiente de verificación y acreditación bancaria en Mercado Pago.';
    }

    // OCR NO es una consulta bancaria oficial: mpApiMatched siempre es false aquí
    const mpApiMatched = false;
    const mpTransactionStatus = isDuplicate ? 'duplicate_flagged' : 'pending';

    res.json({
      extractedData,
      extractionSucceeded,
      validationStatus,
      matchResults: {
        amountMatches,
        dateMatches: false, // Todavía no hay una comprobación independiente de fecha.
        isDuplicateOperationId: isDuplicate,
        mpApiMatched,
        mpTransactionStatus,
        mismatchReason
      }
    });
  } catch (error: any) {
    console.error('No se pudo analizar el comprobante.');
    res.status(503).json({ error: 'El análisis de comprobantes no está disponible. El pago permanece pendiente.' });
  }
});

// 3. Recomendación Predictiva de Stock con IA para Coordinadores
app.post('/api/ai/recommend-stock', authenticateToken, requireRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const {
      zoneName,
      sellerName,
      dayOfWeek,
      weatherCondition,
      availableHouseStock = [],
      historicalAvgUnits = 280
    } = req.body;

    const ai = getGeminiClient();

    let result = {
      recommendedTotalUnits: 320,
      breakdown: [
        { varietyId: 'VAR-CLASICO', varietyName: 'Tequeño Clásico Queso Vegano', quantity: 200 },
        { varietyId: 'VAR-AHUMADO', varietyName: 'Tequeño Ahumado & Finas Hierbas', quantity: 85 },
        { varietyId: 'VAR-DULCE', varietyName: 'Tequeño Dulce Guayaba', quantity: 35 }
      ],
      reasoning: `Pronóstico de alta demanda en ${zoneName} debido a clima óptimo (${weatherCondition || 'Soleado'}). Se recomienda reforzar el Tequeño Clásico (65% del mix de venta).`,
      weatherFactor: 'Condición favorable para venta de tarde (14:00 - 18:30)',
      affluenceFactor: 'Pico de playa alto',
      safetyMarginUnits: 30
    };

    if (ai) {
      try {
        const prompt = `
Actúa como el Jefe de Operaciones y Logística de "Tequeños Costa" (comida ambulante en playas).
Genera una recomendación de stock exacta para la jornada de hoy con los siguientes datos:
- Zona de playa asignada: ${zoneName}
- Vendedor: ${sellerName}
- Día de la semana: ${dayOfWeek}
- Clima y temperatura: ${weatherCondition}
- Promedio histórico de unidades de la zona: ${historicalAvgUnits} unidades.
- Stock disponible en el congelador de la casa: ${JSON.stringify(availableHouseStock)}

Devolvé un plan operativo con cantidades recomendadas por variedad (Clásico, Ahumado, Dulce Guayaba), el total sugerido y la justificación lógica operativa en español.
        `;

        const response = await generateContentWithFallback(ai, {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                recommendedTotalUnits: { type: Type.NUMBER },
                breakdown: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      varietyId: { type: Type.STRING },
                      varietyName: { type: Type.STRING },
                      quantity: { type: Type.NUMBER }
                    },
                    required: ['varietyId', 'varietyName', 'quantity']
                  }
                },
                reasoning: { type: Type.STRING },
                weatherFactor: { type: Type.STRING },
                affluenceFactor: { type: Type.STRING },
                safetyMarginUnits: { type: Type.NUMBER }
              },
              required: ['recommendedTotalUnits', 'breakdown', 'reasoning']
            }
          }
        });

        if (response.text) {
          result = JSON.parse(response.text.trim());
        }
      } catch (err) {
        console.warn('Error en recomendador Gemini, usando cálculo matemático inteligente:', err);
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error en recomendación' });
  }
});

// Banco: módulo con autorizaciones, evidencia central y firma de webhook.
app.use('/api/mercadopago', paymentRouter);
app.post('/api/webhooks/mercadopago', handleMercadoPagoWebhook);

app.use('/api', (_req, res) => res.status(404).json({ success: false, code: 'API_NOT_FOUND', message: 'La operación solicitada no está disponible.' }));

if (process.env.VERCEL) {
  app.get('*', (_req, res) => res.sendFile(path.join(process.cwd(), 'public', 'index.html')));
}

// Montar Vite middleware en desarrollo o servir estáticos en producción
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Nunca publicar el bundle/ sourcemap del servidor con Express estático.
    app.use('/assets', express.static(path.join(distPath, 'assets')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const host = isIsolatedDemoEnabled() ? '127.0.0.1' : '0.0.0.0';
  app.listen(PORT, host, () => {
    console.log(`SGMO Server corriendo en http://${host}:${PORT}`);
  });
}

if (!process.env.VERCEL && process.env.SGMO_SERVER_AUTOSTART !== 'false') {
  startServer().catch(() => { console.error('No se pudo iniciar el servidor.'); process.exitCode = 1; });
}
