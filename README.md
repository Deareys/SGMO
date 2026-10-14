# SGMO — Tequeños Costa

Aplicación React/TypeScript + Express + PostgreSQL para gestión de venta ambulante. Entrega MVP en revisión: el estado de producción depende de las migraciones, configuración y pruebas del deployment.

## Empezar a revisar

- [Informe de entrega y evidencia](docs/INFORME_ENTREGA_MVP.md)
- [Guía para Sebas: probar y entender el código](docs/GUIA_SEBAS.md)
- [Conectar credenciales y verificar servicios](docs/CREDENCIALES_Y_VERIFICACION.md)
- [Hitos, prompts y criterios de aceptación](docs/HITOS_Y_PROMPTS_MVP.md)
- [Operaciones y pruebas manuales](docs/OPERACIONES_MVP.md)
- [Configuración central e inventario inicial](docs/CONFIGURACION_CENTRAL_MVP.md)
- [Pruebas automatizadas en GitHub Actions](docs/CI.md)
- [Autenticación](docs/AUTHENTICATION.md) y [sesiones de navegador](docs/HITO_1_3_SESIONES_BROWSER.md)
- [Decisiones actuales e históricas](docs/DECISIONS.md)

## Verificación local

Node.js 22. Desde la carpeta del repositorio:

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:auth:legacy
```

La última orden usa demo aislada y cierra su propio servidor. Las pruebas PostgreSQL real de CI utilizan un contenedor desechable; no necesitan Neon ni credenciales bancarias.

## Ejecutar el servidor

`npm run dev` usa las variables inyectadas en el entorno. Para desarrollo local, copiá `.env.example` a `.env`, completá **sólo una base de pruebas** y su origen, y ejecutá `npm run dev:local`. `.env` no se versiona. No hay credenciales por defecto.

`npm run build` genera frontend, bundle Node y archivos públicos separados para Vercel. `npm start` ejecuta el bundle local. Vercel utiliza `server.ts` exportado; el build no inicia el servidor ni ejecuta migraciones.

Las migraciones son una operación explícita. No aplicarlas a una base existente sin respaldo, revisión y prueba sobre copia. La 005 invalida credenciales heredadas; deben aprovisionarse nuevamente. El script `db:migrate` exige `.env`, `SGMO_MIGRATION_TARGET=host/base` y `--apply`; nunca se ejecuta automáticamente.

## Alcance que aún necesita cierre

Ventas y operaciones principales se confirman centralmente. Hay módulos de fábrica, gastos, incidencias/radar y mantenimiento que todavía conservan datos locales. PWA completa, imágenes durables, prueba bancaria y prueba de campo requieren verificación adicional. Consultar la guía antes de usarlo con ventas reales.
