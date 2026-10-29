# SGMO — Tequeños Costa

Aplicación de venta ambulante: React/TypeScript, Express y PostgreSQL en Neon.

- **Aplicación habitual:** https://sgmo-rose.vercel.app
- **[Documentación ordenada](docs/README.md)**
- **[Guía para usar, migrar y probar](docs/guia/GUIA_SEBAS.md)**
- **[Estado y continuidad](docs/gestion/CONTINUIDAD_HITOS.md)**

## Desarrollo y verificación

Requiere Node.js 22. Desde la carpeta del proyecto:

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:auth:legacy
```

`npm run dev` usa variables inyectadas. Para desarrollo local, configurar una base de pruebas en `.env` a partir de `.env.example` y ejecutar `npm run dev:local`. No versionar secretos ni usar Production para tests.

Vercel utiliza el servidor Express exportado en `server.ts`. El build no ejecuta migraciones. Production tiene una inicialización mínima sin datos ficticios; el dueño activa su cuenta en `/setup` con el código privado de instalación. Nunca reejecutar una semilla de demostración sobre ese entorno.

Acceso, configuración/catálogo, stock por casa, jornadas, ventas y cierres usan confirmación central. Hay módulos heredados locales identificados en la app y guía. Los datos anteriores de cada navegador requieren respaldo/importación desde ese dispositivo; publicar código no los transporta por sí solo.
