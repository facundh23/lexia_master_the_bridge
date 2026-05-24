# apps/api

API HTTP de Lexia — Fastify 5 + Better Auth + Drizzle.

## Arrancar en desarrollo

```powershell
# Desde la raíz del monorepo:
pnpm --filter @lexia/api dev
# API en http://localhost:4000
```

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Health check básico |
| GET | `/api/health/deep` | Health check con DB + Chroma |
| POST | `/api/auth/sign-up/email` | Registro (rate: 10/h) |
| POST | `/api/auth/sign-in/email` | Login (rate: 5/15min) |
| GET | `/api/me` | Perfil del usuario autenticado |
| DELETE | `/api/me/account` | Borrado de cuenta (GDPR Art. 17) |
| POST | `/api/conversations` | Nueva conversación |
| POST | `/api/conversations/:id/messages` | Enviar mensaje (llama runLexiaCore) |
| POST | `/api/ccse/quiz` | Generar simulacro CCSE |
| POST | `/api/auth/pat` | Crear PAT (MCP, show-once) |
| POST | `/api/mcp/search` | Búsqueda corpus (requiere PAT + professional) |

## Rate limiting

- Global: 100 req/min por IP
- Sign-up: 10 req/hora por IP
- Sign-in: 5 req/15 min por IP

## Tests

```powershell
pnpm --filter @lexia/api test
```

Requiere PostgreSQL corriendo (`docker compose -f docker-compose.dev.yml up postgres -d`).
