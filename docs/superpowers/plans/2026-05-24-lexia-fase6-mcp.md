# Lexia Fase 6 — MCP Server + Dual Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer Lexia como servidor MCP para gestores y abogados profesionales, con autenticación PAT, verificación de colegiación, y audit log diferenciado por surface (`web` vs `mcp`).

**Architecture:** El servidor MCP corre en modo stdio (proceso hijo arrancado por Claude Desktop / Cursor) y actúa como thin client: cada tool MCP hace una llamada HTTP a `apps/api` con un Bearer PAT. `apps/api` centraliza la autenticación, autorización, audit logging y el acceso a `@lexia/core`. Esto significa que el proceso MCP en el host del gestor nunca tiene acceso directo a la base de datos.

**Tech Stack:** `@modelcontextprotocol/sdk ^1.12.0`, `crypto` (Node built-in para SHA-256), Drizzle ORM, Fastify 5, TypeScript ESM.

---

## Decisiones de Seguridad — Justificación Completa

Antes de las tasks, se documenta el razonamiento detrás de cada decisión arquitectónica de seguridad. Esto es lo que deberías poder defender en el tribunal.

### DEC-1: Transport stdio en lugar de HTTP para el servidor MCP

**¿Qué se eligió?** El servidor MCP (`apps/mcp`) usa `StdioServerTransport` del SDK. Claude Desktop arranca el proceso con `node dist/index.js` y se comunica por stdin/stdout.

**¿Qué amenaza mitiga?**

- Elimina la superficie de red local. Con HTTP, el servidor escucharía en `localhost:XXXX` — cualquier proceso en la misma máquina podría hacer peticiones a ese puerto (SSRF lateral, credential theft via port scan).
- En stdio, solo el proceso padre (Claude Desktop) puede comunicarse. No hay socket, no hay TLS que configurar, no hay puerto en el firewall.

**¿Por qué no HTTP local?**

- HTTP local requiere gestión de TLS o acepta cleartext, binding de puerto, y exposición a otros procesos locales.
- El SDK de MCP recomienda stdio para integraciones de escritorio: "stdio is appropriate for local integrations where the client and server run on the same machine."

**¿Por qué no SSE/StreamableHTTP?**

- SSE/StreamableHTTP es para deployments remotos (servidor MCP en la nube). En ese caso sí necesitaríamos TLS + auth en el transport. Para Fase 6 (MVP desktop), stdio es suficiente y más seguro.

### DEC-2: apps/mcp es thin client — no accede a DB directamente

**¿Qué se eligió?** `apps/mcp` solo conoce `LEXIA_API_URL` y `LEXIA_PAT`. Cada tool MCP hace `fetch()` a `apps/api`.

**¿Qué amenaza mitiga?**

- **Least Privilege**: El proceso MCP en el host del gestor solo tiene un PAT con scopes limitados. No tiene `DATABASE_URL` (que incluye usuario y contraseña de Postgres). Si el host del gestor está comprometido, el atacante solo obtiene el PAT — que puede revocarse inmediatamente.
- **Centralización de audit log**: Si apps/mcp accediera a DB directamente, cada acción del MCP debería loguear por separado y podría hacerlo incorrectamente o no hacerlo. Al pasar por apps/api, el audit log es obligatorio por diseño arquitectónico.
- **Single source of truth para roles**: La verificación de que `role = 'professional'` ocurre en apps/api en cada request. Si un admin revoca la verificación de un profesional, el acceso se corta en la próxima llamada sin necesidad de rotar tokens o esperar TTL.

**¿Por qué no importar `@lexia/core` directamente en apps/mcp?**

- Requeriría que el proceso MCP tenga `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CHROMA_URL`, etc. — todo el stack de credenciales.
- Duplica la lógica de autorización y audit log.

### DEC-3: PAT almacenado como SHA-256 (no bcrypt)

**¿Qué se eligió?** El PAT es `crypto.randomBytes(32).toString('hex')` (64 chars hex = 256 bits de entropía). Se guarda `sha256(token)` en DB. El token plaintext se muestra solo una vez al crearlo.

**¿Por qué SHA-256 y no bcrypt?**

- **bcrypt está diseñado para passwords** (baja entropía, elegidos por humanos, susceptibles a diccionarios). Su lentitud (trabajo de hashing configurable) tiene sentido cuando el espacio de búsqueda es pequeño.
- **Los PATs tienen 256 bits de entropía aleatoria**. Un atacante que obtuviera la DB tendría que hacer brute-force de 2^256 combinaciones. SHA-256 es suficiente — OWASP API Security confirma: "For API tokens with sufficient entropy, a fast hash like SHA-256 is acceptable."
- bcrypt en cada request de API añadiría ~100ms de latencia innecesaria.

**¿Por qué no almacenar el PAT en plaintext?**

- Si la DB se expone (backup sin cifrar, SQL injection, insider threat), los tokens plaintext son utilizables inmediatamente.
- Con SHA-256, un dump de DB solo expone hashes — el token real sigue siendo secreto.

**¿Por qué 32 bytes aleatorios y no UUID v4?**

- UUID v4 tiene 122 bits de entropía (algunos bits son fijos por la versión). 32 bytes = 256 bits.
- `crypto.randomBytes` usa el CSPRNG del OS (getrandom syscall en Linux, CryptGenRandom en Windows). `Math.random()` NO es criptográficamente seguro y está explícitamente prohibido para tokens de seguridad.

### DEC-4: Token visible solo una vez (show-once)

**¿Qué se eligió?** El endpoint `POST /api/auth/pat` devuelve `{ token, id }`. Después solo se puede listar el `id` y el `name`, nunca el token de nuevo.

**¿Qué amenaza mitiga?**

- Principio de mínima exposición: el secreto no persiste en el servidor en forma recuperable. Si un atacante consigue acceso de lectura a la DB después de la creación, no puede recuperar el token (solo el hash).
- Modelo conocido: GitHub PATs, GitLab tokens, AWS access keys — todos funcionan igual. Los usuarios ya entienden este modelo.

**¿Qué pasa si el usuario pierde el token?**

- Lo revoca (`DELETE /api/auth/pat/:id`) y crea uno nuevo. El proceso es deliberadamente incómodo para desincentivar el descuido.

### DEC-5: Verificación de colegiación manual (MVP)

**¿Qué se eligió?** El flujo es: gestor envía número de colegiado → queda `status: 'pending'` → admin lo aprueba vía `PATCH /api/admin/professional-verifications/:id` → `users.role` cambia a `'professional'`.

**¿Qué amenaza mitiga?**

- **Acceso no autorizado a tools profesionales**: Los endpoints `/api/mcp/*` exponen RAG con citas y compute_eligibility. Un usuario B2C que se autoproclamara "profesional" podría acceder a outputs más técnicos o menos disclaimerizados.
- Sin verificación, cualquiera podría hacer `role = 'professional'` con una petición forjada.

**¿Por qué manual y no automatizado?**

- Los Colegios de Abogados en España no tienen una API pública unificada de verificación de colegiación. Cada comunidad autónoma tiene su registro propio.
- El riesgo R10 del spec reconoce esto: "MVP con verificación manual; automatización Future Work".
- Para el capstone, la verificación manual es **defendible arquitectónicamente** — el campo `status` existe, el flujo existe, y la automatización es un upgrade de infraestructura, no un cambio de diseño.

### DEC-6: surface='mcp' en audit_log en cada request

**¿Qué se eligió?** Todos los endpoints `/api/mcp/*` insertan una fila en `audit_log` con `surface: 'mcp'` antes de retornar.

**¿Qué principio aplica?**

- **Non-repudiation**: Ninguna acción de un profesional puede negarse — hay un registro inmutable con timestamp, userId, surface, action y details.
- **Segregación de surfaces**: Permite queries específicas para auditorías (`WHERE surface = 'mcp'`), detección de anomalías (profesional actuando desde web cuando siempre usa MCP), y compliance con GDPR Art. 5(2) (accountability).
- El campo `surface` ya existe en la tabla `audit_log` (Fase 1). El schema de `conversations` también tiene `surface`. Esto es consistencia arquitectónica.

### DEC-7: requirePat y requireProfessional como middleware separado

**¿Qué se eligió?** Dos funciones separadas: `requirePat` valida el token y carga el usuario; `requireProfessional` verifica `role = 'professional'`. Se componen en la ruta como `preHandler: [requirePat, requireProfessional]`.

**¿Por qué separados?**

- Single Responsibility: cada middleware hace una sola cosa, testeable de forma independiente.
- Composabilidad: en el futuro, un endpoint podría requerir PAT pero no role=professional (e.g., un endpoint de lectura básica). Con middleware separado, se puede hacer sin duplicar lógica.
- Falla explícita: el 401 ("PAT inválido") se distingue del 403 ("no eres profesional"), lo cual ayuda al diagnóstico sin revelar demasiada información.

### DEC-8: role almacenado en tabla users, verificado en cada request

**¿Qué se eligió?** `users.role` en DB, leído en cada request por `requireProfessional`.

**¿Por qué no en el PAT payload (tipo JWT)?**

- Los JWTs codifican el rol al momento de emisión y son válidos hasta su expiración aunque el rol haya cambiado.
- Si un admin revoca la verificación de un profesional a las 14:00, con JWT el profesional podría seguir actuando hasta la expiración del token (potencialmente horas).
- Con DB lookup, la revocación es instantánea: próxima request → 403.
- El costo (1 query por request) es aceptable dado el volumen esperado de uso profesional.

---

## Mapa de Archivos

### Nuevos archivos

```
packages/db/src/schema/professional.ts          — tablas: personal_access_tokens, professional_verifications
packages/db/migrations/0005_mcp_professional.sql — migración con ALTER TABLE users + 2 CREATE TABLE
packages/db/migrations/meta/0005_snapshot.json  — snapshot Drizzle
apps/api/src/middleware/requirePat.ts            — valida Bearer PAT, puebla request.userId + request.userRole
apps/api/src/middleware/requireProfessional.ts   — verifica request.userRole === 'professional'
apps/api/src/routes/pat.ts                       — POST/GET/DELETE /api/auth/pat
apps/api/src/routes/mcp.ts                       — /api/mcp/search, /api/mcp/eligibility, /api/mcp/procedure
apps/api/src/routes/professionalVerification.ts  — POST /api/me/professional-verification + admin PATCH
apps/mcp/src/tools/searchCorpus.ts               — tool MCP: search_corpus_with_citations
apps/mcp/src/tools/computeEligibility.ts         — tool MCP: compute_eligibility
apps/mcp/src/tools/getProcedureRequirements.ts   — tool MCP: get_procedure_requirements
apps/mcp/src/apiClient.ts                        — fetch wrapper con Bearer PAT + error handling
apps/mcp/src/server.ts                           — McpServer + StdioServerTransport + registro de tools
apps/mcp/README.md                               — instrucciones para gestores (Claude Desktop, Cursor)
```

### Archivos modificados

```
packages/db/src/schema/index.ts                  — + export * from './professional.js'
packages/db/migrations/meta/_journal.json        — + entry idx 5
apps/api/src/types.ts                            — + userRole?: string en FastifyRequest
apps/api/src/server.ts                           — registrar patRoute, mcpRoute, professionalVerificationRoute
apps/api/src/middleware/requireAdmin.ts          — ninguno (se reutiliza tal cual)
apps/mcp/package.json                            — + @modelcontextprotocol/sdk, dependencies
apps/mcp/tsconfig.json                           — ya correcto (extend tsconfig.base.json)
```

---

## Task 1: DB Schema — professional.ts + migration 0005

**¿Por qué esta task primero?** Todo lo demás depende de las tablas. Sin `personal_access_tokens` no hay PATs, sin `role` en `users` no hay autorización.

**Files:**

- Create: `packages/db/src/schema/professional.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/migrations/0005_mcp_professional.sql`
- Create: `packages/db/migrations/meta/0005_snapshot.json`
- Modify: `packages/db/migrations/meta/_journal.json`

- [ ] **Step 1: Escribir el schema professional.ts**

```typescript
// packages/db/src/schema/professional.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const personalAccessTokens = pgTable('personal_access_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  name: text('name').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const professionalVerifications = pgTable('professional_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  collegiateNumber: text('collegiate_number').notNull(),
  collegiateBody: text('collegiate_body').notNull(),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Decisión de seguridad inline:** `tokenHash` tiene `unique()`. Un hash duplicado (colisión SHA-256) es prácticamente imposible pero la constraint hace que la DB rechace cualquier intento de insertar el mismo token dos veces. `expiresAt` nullable permite PATs sin expiración en MVP pero el campo existe para enforcement futuro.

- [ ] **Step 2: Exportar desde index.ts**

Archivo: `packages/db/src/schema/index.ts`

```typescript
export * from './auth.js';
export * from './audit.js';
export * from './domain.js';
export * from './infrastructure.js';
export * from './ccse.js';
export * from './reminders.js';
export * from './professional.js';
```

- [ ] **Step 3: Escribir la migración SQL**

```sql
-- packages/db/migrations/0005_mcp_professional.sql

-- Agregar columna role a users (ver DEC-8: verificación en cada request)
ALTER TABLE "users" ADD COLUMN "role" text NOT NULL DEFAULT 'user';

-- Tabla de PATs (ver DEC-3: SHA-256, DEC-4: show-once)
CREATE TABLE "personal_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "name" text NOT NULL,
  "last_used_at" timestamptz,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_token_hash_unique" UNIQUE("token_hash");

-- Tabla de verificaciones profesionales (ver DEC-5: verificación manual)
CREATE TABLE "professional_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "collegiate_number" text NOT NULL,
  "collegiate_body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "professional_verifications" ADD CONSTRAINT "professional_verifications_user_id_unique" UNIQUE("user_id");
```

- [ ] **Step 4: Escribir el snapshot de Drizzle**

```json
// packages/db/migrations/meta/0005_snapshot.json
{
  "id": "d4e5f6a7-b8c9-0123-def0-234567890123",
  "prevId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "version": "7",
  "dialect": "postgresql",
  "tables": {},
  "enums": {},
  "schemas": {},
  "sequences": {},
  "_meta": { "columns": {}, "schemas": {}, "tables": {} }
}
```

- [ ] **Step 5: Actualizar el journal**

Archivo: `packages/db/migrations/meta/_journal.json`

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1778616851198,
      "tag": "0000_dear_centennial",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1778786884864,
      "tag": "0001_deep_mulholland_black",
      "breakpoints": true
    },
    {
      "idx": 2,
      "version": "7",
      "when": 1747440000000,
      "tag": "0002_add_citations_to_messages",
      "breakpoints": true
    },
    {
      "idx": 3,
      "version": "7",
      "when": 1747958400000,
      "tag": "0003_token_usage_unique_index",
      "breakpoints": true
    },
    {
      "idx": 4,
      "version": "7",
      "when": 1748217600000,
      "tag": "0004_ccse_reminders",
      "breakpoints": true
    },
    {
      "idx": 5,
      "version": "7",
      "when": 1748390400000,
      "tag": "0005_mcp_professional",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 6: Typecheck para verificar que el schema compila**

```powershell
cd packages/db && pnpm typecheck
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/professional.ts packages/db/src/schema/index.ts packages/db/migrations/0005_mcp_professional.sql packages/db/migrations/meta/0005_snapshot.json packages/db/migrations/meta/_journal.json
git commit -m "feat(db): add personal_access_tokens, professional_verifications, users.role (migration 0005)"
```

---

## Task 2: Middleware requirePat + requireProfessional

**¿Por qué antes de las rutas?** Las rutas de Task 3 y 4 dependen de estos middlewares. Construirlos primero, con tests, permite confiar en ellos.

**¿Por qué dos middlewares separados y no uno?** Ver DEC-7. `requirePat` resuelve "¿quién eres?" y `requireProfessional` resuelve "¿tenés permiso?". Son preguntas distintas con respuestas distintas (401 vs 403).

**Files:**

- Modify: `apps/api/src/types.ts`
- Create: `apps/api/src/middleware/requirePat.ts`
- Create: `apps/api/src/middleware/requireProfessional.ts`
- Create: `apps/api/src/middleware/requirePat.test.ts`

- [ ] **Step 1: Extender FastifyRequest con userRole**

Archivo: `apps/api/src/types.ts`

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail?: string;
    userRole?: string;
  }
}
```

- [ ] **Step 2: Escribir el test del middleware requirePat (failing)**

```typescript
// apps/api/src/middleware/requirePat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  })),
  schema: {
    personalAccessTokens: {
      tokenHash: 'tokenHash',
      userId: 'userId',
      expiresAt: 'expiresAt',
      lastUsedAt: 'lastUsedAt',
    },
    users: { id: 'id', role: 'role' },
  },
}));

import { requirePat } from './requirePat.js';

function makeReq(authHeader?: string) {
  return {
    headers: { authorization: authHeader },
    userId: '',
    userEmail: undefined as string | undefined,
    userRole: undefined as string | undefined,
  } as any;
}

function makeReply() {
  const r = { _status: 0, _body: null as any };
  r.status = (code: number) => {
    r._status = code;
    return r;
  };
  r.send = (body: any) => {
    r._body = body;
    return r;
  };
  return r as any;
}

describe('requirePat', () => {
  it('rechaza sin header Authorization', async () => {
    const reply = makeReply();
    await requirePat(makeReq(), reply);
    expect(reply._status).toBe(401);
  });

  it('rechaza con header que no es Bearer', async () => {
    const reply = makeReply();
    await requirePat(makeReq('Basic dXNlcjpwYXNz'), reply);
    expect(reply._status).toBe(401);
  });

  it('rechaza con token que no existe en DB', async () => {
    const reply = makeReply();
    await requirePat(makeReq('Bearer invalidtoken'), reply);
    expect(reply._status).toBe(401);
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

```powershell
cd apps/api && pnpm test --reporter=verbose middleware/requirePat
```

Esperado: FAIL — "Cannot find module './requirePat.js'"

- [ ] **Step 4: Implementar requirePat**

```typescript
// apps/api/src/middleware/requirePat.ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { createDb, schema } from '@lexia/db';
import { eq, and, or, isNull, gt } from 'drizzle-orm';

// Ver DEC-2: lazy singleton — no inicializar DB hasta que sea necesario
let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (!_db) _db = createDb(process.env.DATABASE_URL ?? '');
  return _db;
}

export async function requirePat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  // Ver DEC-3: verificamos Bearer prefix
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Bearer PAT requerido' });
  }

  const token = authHeader.slice(7);

  // Ver DEC-3: SHA-256 del token recibido para comparar contra el hash almacenado
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const db = getDb();
  const now = new Date();

  // Buscar PAT + usuario en un solo JOIN (minimizar round-trips a DB)
  const rows = await db
    .select({
      patId: schema.personalAccessTokens.id,
      userId: schema.personalAccessTokens.userId,
      userRole: schema.users.role,
      userEmail: schema.users.email,
    })
    .from(schema.personalAccessTokens)
    .innerJoin(schema.users, eq(schema.personalAccessTokens.userId, schema.users.id))
    .where(
      and(
        eq(schema.personalAccessTokens.tokenHash, tokenHash),
        // Ver DEC-3: respetar expiración si existe
        or(
          isNull(schema.personalAccessTokens.expiresAt),
          gt(schema.personalAccessTokens.expiresAt, now),
        ),
      ),
    );

  if (rows.length === 0) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'PAT inválido o expirado' });
  }

  const { patId, userId, userRole, userEmail } = rows[0]!;

  // Ver DEC-3: actualizar lastUsedAt para auditoría (stale token detection)
  // fire-and-forget: no bloquear el request por esto
  db.update(schema.personalAccessTokens)
    .set({ lastUsedAt: now })
    .where(eq(schema.personalAccessTokens.id, patId))
    .catch(() => undefined);

  request.userId = userId;
  request.userRole = userRole ?? 'user';
  request.userEmail = userEmail;
}
```

- [ ] **Step 5: Implementar requireProfessional**

```typescript
// apps/api/src/middleware/requireProfessional.ts
import type { FastifyReply, FastifyRequest } from 'fastify';

// Ver DEC-7: separado de requirePat — resuelve "¿tenés permiso?" no "¿quién eres?"
// Ver DEC-8: el rol viene de la DB via requirePat (no de JWT), garantizando revocación instantánea
export async function requireProfessional(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.userRole !== 'professional') {
    return reply
      .status(403)
      .send({ error: 'FORBIDDEN', message: 'Acceso restringido a profesionales verificados' });
  }
}
```

- [ ] **Step 6: Correr los tests de requirePat**

```powershell
cd apps/api && pnpm test --reporter=verbose middleware/requirePat
```

Esperado: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/middleware/requirePat.ts apps/api/src/middleware/requireProfessional.ts apps/api/src/middleware/requirePat.test.ts
git commit -m "feat(api): add requirePat + requireProfessional middleware with SHA-256 token validation"
```

---

## Task 3: PAT CRUD — POST/GET/DELETE /api/auth/pat

**¿Por qué esta ruta usa /api/auth/pat?** Semánticamente, los PATs son credenciales de autenticación. Agruparlos bajo `/api/auth/` es consistente con el patrón ya establecido por Better Auth.

**Files:**

- Create: `apps/api/src/routes/pat.ts`
- Create: `apps/api/src/routes/pat.test.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Escribir el test de la ruta PAT (failing)**

```typescript
// apps/api/src/routes/pat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de requireAuth para simular usuario autenticado
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: vi.fn(async (req: any) => {
    req.userId = 'user-1';
    req.userEmail = 'test@test.com';
  }),
}));

// Mock DB
const mockInsert = vi.fn().mockResolvedValue([{ id: 'pat-1' }]);
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnThis(),
  where: vi
    .fn()
    .mockResolvedValue([
      { id: 'pat-1', name: 'Mi PAT', lastUsedAt: null, expiresAt: null, createdAt: new Date() },
    ]),
});
const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue([]),
});
vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({ insert: mockInsert, select: mockSelect, delete: mockDelete })),
  schema: { personalAccessTokens: {} },
}));

import { buildServer } from '../server.js';

describe('PAT routes', () => {
  it('POST /api/auth/pat genera un token y lo devuelve una vez', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/pat',
      payload: { name: 'Mi cliente MCP' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.token).toHaveLength(64); // 32 bytes hex
    expect(body.id).toBeDefined();
  });

  it('GET /api/auth/pat lista PATs sin token', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/api/auth/pat' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pats).toBeDefined();
    expect(body.pats[0]).not.toHaveProperty('token');
    expect(body.pats[0]).not.toHaveProperty('tokenHash');
  });

  it('DELETE /api/auth/pat/:id revoca el PAT', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'DELETE', url: '/api/auth/pat/pat-1' });
    expect(res.statusCode).toBe(204);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```powershell
cd apps/api && pnpm test --reporter=verbose routes/pat
```

Esperado: FAIL — "Cannot find module '../routes/pat.js'"

- [ ] **Step 3: Implementar la ruta pat.ts**

```typescript
// apps/api/src/routes/pat.ts
import type { FastifyPluginAsync } from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth.js';

const db = createDb(process.env.DATABASE_URL ?? '');

export const patRoute: FastifyPluginAsync = async (app) => {
  // Ver DEC-4: genera token, muestra plaintext una sola vez, persiste solo el hash
  app.post('/api/auth/pat', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { name?: string } | null;
    const name = body?.name?.trim();
    if (!name) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'name es requerido' });
    }

    // Ver DEC-3: 32 bytes de CSPRNG = 256 bits de entropía
    const token = randomBytes(32).toString('hex');
    // Ver DEC-3: SHA-256, no bcrypt (alta entropía → fast hash es suficiente)
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [row] = await db
      .insert(schema.personalAccessTokens)
      .values({ userId: request.userId, tokenHash, name })
      .returning({ id: schema.personalAccessTokens.id });

    // Ver DEC-4: token visible UNA SOLA VEZ aquí. Después solo el id.
    return reply.status(201).send({ id: row!.id, token, name });
  });

  // Lista PATs del usuario — NUNCA incluir tokenHash (ver DEC-4)
  app.get('/api/auth/pat', { preHandler: [requireAuth] }, async (request) => {
    const pats = await db
      .select({
        id: schema.personalAccessTokens.id,
        name: schema.personalAccessTokens.name,
        lastUsedAt: schema.personalAccessTokens.lastUsedAt,
        expiresAt: schema.personalAccessTokens.expiresAt,
        createdAt: schema.personalAccessTokens.createdAt,
      })
      .from(schema.personalAccessTokens)
      .where(eq(schema.personalAccessTokens.userId, request.userId));

    return { pats };
  });

  // Revocar PAT — solo el propietario puede revocar sus propios tokens (ver DEC-7: least privilege)
  app.delete('/api/auth/pat/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await db.delete(schema.personalAccessTokens).where(
      and(
        eq(schema.personalAccessTokens.id, id),
        eq(schema.personalAccessTokens.userId, request.userId), // ownership check
      ),
    );

    return reply.status(204).send();
  });
};
```

- [ ] **Step 4: Registrar la ruta en server.ts**

Archivo: `apps/api/src/server.ts` — agregar imports y registro:

```typescript
// Agregar al bloque de imports existente:
import { patRoute } from './routes/pat.js';

// Agregar antes del return app:
await app.register(patRoute);
```

- [ ] **Step 5: Correr los tests**

```powershell
cd apps/api && pnpm test --reporter=verbose routes/pat
```

Esperado: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/pat.ts apps/api/src/routes/pat.test.ts apps/api/src/server.ts
git commit -m "feat(api): add PAT CRUD routes with show-once token generation"
```

---

## Task 4: Verificación de colegiación — /api/me/professional-verification + admin PATCH

**¿Por qué esta task antes de los endpoints MCP?** Los endpoints MCP requieren `role = 'professional'`, que solo se asigna cuando un admin aprueba la verificación.

**Files:**

- Create: `apps/api/src/routes/professionalVerification.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `.env.example`

- [ ] **Step 1: Implementar la ruta**

```typescript
// apps/api/src/routes/professionalVerification.ts
import type { FastifyPluginAsync } from 'fastify';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const db = createDb(process.env.DATABASE_URL ?? '');

export const professionalVerificationRoute: FastifyPluginAsync = async (app) => {
  // Gestor solicita verificación (ver DEC-5: flujo manual)
  app.post(
    '/api/me/professional-verification',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = request.body as {
        collegiateNumber?: string;
        collegiateBody?: string;
      } | null;

      const { collegiateNumber, collegiateBody } = body ?? {};
      if (!collegiateNumber?.trim() || !collegiateBody?.trim()) {
        return reply
          .status(400)
          .send({
            error: 'BAD_REQUEST',
            message: 'collegiateNumber y collegiateBody son requeridos',
          });
      }

      // Upsert: si ya existe una verificación para este usuario, actualizarla
      await db
        .insert(schema.professionalVerifications)
        .values({
          userId: request.userId,
          collegiateNumber: collegiateNumber.trim(),
          collegiateBody: collegiateBody.trim(),
          status: 'pending',
        })
        .onConflictDoUpdate({
          target: schema.professionalVerifications.userId,
          set: {
            collegiateNumber: collegiateNumber.trim(),
            collegiateBody: collegiateBody.trim(),
            status: 'pending',
            reviewedAt: null,
          },
        });

      return reply.status(202).send({ status: 'pending' });
    },
  );

  // Admin lista verificaciones pendientes
  app.get('/api/admin/professional-verifications', { preHandler: [requireAdmin] }, async () => {
    const verifications = await db
      .select({
        id: schema.professionalVerifications.id,
        userId: schema.professionalVerifications.userId,
        collegiateNumber: schema.professionalVerifications.collegiateNumber,
        collegiateBody: schema.professionalVerifications.collegiateBody,
        status: schema.professionalVerifications.status,
        createdAt: schema.professionalVerifications.createdAt,
      })
      .from(schema.professionalVerifications);

    return { verifications };
  });

  // Admin aprueba o rechaza — actualiza status + role del usuario (ver DEC-5, DEC-8)
  app.patch(
    '/api/admin/professional-verifications/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { status?: 'approved' | 'rejected' } | null;

      if (body?.status !== 'approved' && body?.status !== 'rejected') {
        return reply
          .status(400)
          .send({ error: 'BAD_REQUEST', message: 'status debe ser approved o rejected' });
      }

      const [verification] = await db
        .update(schema.professionalVerifications)
        .set({ status: body.status, reviewedAt: new Date() })
        .where(eq(schema.professionalVerifications.id, id))
        .returning({ userId: schema.professionalVerifications.userId });

      if (!verification) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }

      // Ver DEC-8: actualizar role en users — revocación/aprobación instantánea
      const newRole = body.status === 'approved' ? 'professional' : 'user';
      await db
        .update(schema.users)
        .set({ role: newRole })
        .where(eq(schema.users.id, verification.userId));

      return { status: body.status };
    },
  );
};
```

- [ ] **Step 2: Registrar la ruta en server.ts**

Archivo: `apps/api/src/server.ts` — agregar:

```typescript
import { professionalVerificationRoute } from './routes/professionalVerification.js';

// En buildServer(), antes del return app:
await app.register(professionalVerificationRoute);
```

- [ ] **Step 3: Actualizar .env.example**

Agregar al final del archivo `.env.example`:

```bash
# MCP professional verification
# ADMIN_EMAILS ya existe arriba — los admins también aprueban verificaciones profesionales
```

- [ ] **Step 4: Typecheck**

```powershell
cd apps/api && pnpm typecheck
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/professionalVerification.ts apps/api/src/server.ts .env.example
git commit -m "feat(api): add professional verification flow with admin approval and instant role update"
```

---

## Task 5: Endpoints MCP-facing en apps/api — /api/mcp/\*

**¿Por qué endpoints dedicados y no reutilizar los web?**

- Ver DEC-6: audit log con `surface: 'mcp'` requiere rutas dedicadas que controlen el valor de surface.
- Los endpoints web usan sesiones de Better Auth. Los endpoints MCP usan PAT. Son mecanismos de autenticación distintos — mezclarlos crea complejidad innecesaria.
- Permite rate limiting diferenciado si es necesario en el futuro.

**Files:**

- Create: `apps/api/src/routes/mcp.ts`
- Create: `apps/api/src/routes/mcp.test.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Escribir el test de endpoints MCP (failing)**

```typescript
// apps/api/src/routes/mcp.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../middleware/requirePat.js', () => ({
  requirePat: vi.fn(async (req: any) => {
    req.userId = 'user-pro-1';
    req.userRole = 'professional';
    req.userEmail = 'gestor@bufete.es';
  }),
}));
vi.mock('../middleware/requireProfessional.js', () => ({
  requireProfessional: vi.fn(async () => undefined),
}));
vi.mock('@lexia/core', () => ({
  runNormativaAgent: vi.fn().mockResolvedValue({
    response: 'Art. 22 CC: 2 años para iberoamericanos.',
    citations: ['Art. 22 CC'],
  }),
  computeEligibility: vi.fn().mockReturnValue({
    yearsRequired: 2,
    yearsElapsed: 3,
    isEligible: true,
    specialCase: 'iberoamerican',
    legalBasis: 'Art. 22.1 CC',
    notes: [],
  }),
}));
vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
  })),
  schema: { auditLog: {} },
}));

import { buildServer } from '../server.js';

describe('MCP routes', () => {
  it('POST /api/mcp/search devuelve respuesta con citas y loguea surface=mcp', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/mcp/search',
      payload: { query: '¿Cuántos años necesito?', vertical: 'nacionalidad_residencia' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.response).toBeDefined();
    expect(body.citations).toBeDefined();
    expect(body.surface).toBe('mcp');
  });

  it('POST /api/mcp/eligibility devuelve resultado determinista', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/mcp/eligibility',
      payload: { countryOrigin: 'argentina', arrivalDate: '2020-01-01' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.isEligible).toBe(true);
    expect(body.surface).toBe('mcp');
  });

  it('GET /api/mcp/procedure/nacionalidad_residencia/requirements devuelve checklist', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/api/mcp/procedure/nacionalidad_residencia/requirements',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.requirements).toBeDefined();
    expect(body.surface).toBe('mcp');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```powershell
cd apps/api && pnpm test --reporter=verbose routes/mcp
```

Esperado: FAIL — "Cannot find module '../routes/mcp.js'"

- [ ] **Step 3: Implementar mcp.ts**

```typescript
// apps/api/src/routes/mcp.ts
import type { FastifyPluginAsync } from 'fastify';
import { createDb, schema } from '@lexia/db';
import { runNormativaAgent, computeEligibility } from '@lexia/core';
import { requirePat } from '../middleware/requirePat.js';
import { requireProfessional } from '../middleware/requireProfessional.js';
import { nacionalidadResidencia } from '@lexia/core/verticals/nacionalidad_residencia/manifest';

const db = createDb(process.env.DATABASE_URL ?? '');

// Ver DEC-6: helper para insertar audit_log con surface='mcp' en cada request
async function logMcpAction(
  userId: string,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      actorType: 'user',
      actorId: userId,
      surface: 'mcp', // Ver DEC-6: diferenciación de surfaces
      action,
      details: details ?? {},
    });
  } catch {
    // fail-open: no interrumpir el request si el audit log falla
  }
}

// Los 3 manifests disponibles (extensible con más verticales en el futuro)
const VERTICAL_MANIFESTS: Record<string, typeof nacionalidadResidencia> = {
  nacionalidad_residencia: nacionalidadResidencia,
};

export const mcpRoute: FastifyPluginAsync = async (app) => {
  // Ver DEC-1, DEC-2: todos los endpoints requieren PAT válido + role=professional
  const auth = { preHandler: [requirePat, requireProfessional] };

  // Tool: search_corpus_with_citations — wraps NormativaAgent con surface='mcp'
  app.post('/api/mcp/search', auth, async (request, reply) => {
    const body = request.body as {
      query?: string;
      vertical?: string;
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    } | null;

    const query = body?.query?.trim();
    if (!query) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'query es requerido' });
    }

    const vertical = body?.vertical ?? 'nacionalidad_residencia';

    const result = await runNormativaAgent({
      content: query,
      conversationHistory: body?.conversationHistory ?? [],
      userId: request.userId,
      vertical,
    });

    // Ver DEC-6: audit log con surface='mcp' antes de retornar
    await logMcpAction(request.userId, 'mcp_search', {
      vertical,
      citationsCount: result.citations.length,
    });

    return { ...result, surface: 'mcp' };
  });

  // Tool: compute_eligibility — determinista, no llama LLM (ver DEC-2: apps/api centraliza)
  app.post('/api/mcp/eligibility', auth, async (request) => {
    const body = request.body as {
      countryOrigin?: string;
      arrivalDate?: string;
      residenceStatus?: string;
    } | null;

    const result = computeEligibility({
      countryOrigin: body?.countryOrigin,
      arrivalDate: body?.arrivalDate,
      residenceStatus: body?.residenceStatus,
    });

    await logMcpAction(request.userId, 'mcp_eligibility', {
      specialCase: result.specialCase,
      isEligible: result.isEligible,
    });

    return { ...result, surface: 'mcp' };
  });

  // Tool: get_procedure_requirements — lee manifest del vertical, no llama LLM ni DB
  app.get('/api/mcp/procedure/:vertical/requirements', auth, async (request, reply) => {
    const { vertical } = request.params as { vertical: string };

    const manifest = VERTICAL_MANIFESTS[vertical];
    if (!manifest) {
      return reply
        .status(404)
        .send({ error: 'NOT_FOUND', message: `Vertical '${vertical}' no encontrado` });
    }

    await logMcpAction(request.userId, 'mcp_requirements', { vertical });

    return {
      surface: 'mcp',
      vertical: manifest.slug,
      name: manifest.name,
      requirements: {
        intakeFields: manifest.intake.fields,
        corpusSources: manifest.corpus.sources,
        reminders: manifest.reminders,
      },
    };
  });
};
```

- [ ] **Step 4: Fix el import del manifest en mcp.ts**

El import `@lexia/core/verticals/...` requiere que ese path sea exportado. Verificar que `packages/core/src/index.ts` exporte el manifest, o importar directamente:

```typescript
// Cambiar el import en mcp.ts si el path no existe:
// En lugar de @lexia/core/verticals/..., usar importación dinámica del manifest
import { nacionalidadResidencia } from '@lexia/core';
```

Verificar que `packages/core/src/index.ts` tiene:

```typescript
export { nacionalidadResidencia } from './verticals/nacionalidad_residencia/manifest.js';
```

Si no lo tiene, agregarlo al archivo `packages/core/src/index.ts`.

- [ ] **Step 5: Registrar la ruta en server.ts**

```typescript
import { mcpRoute } from './routes/mcp.js';

// En buildServer(), antes del return app:
await app.register(mcpRoute);
```

- [ ] **Step 6: Correr los tests**

```powershell
cd apps/api && pnpm test --reporter=verbose routes/mcp
```

Esperado: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/mcp.ts apps/api/src/routes/mcp.test.ts apps/api/src/server.ts packages/core/src/index.ts
git commit -m "feat(api): add /api/mcp/* endpoints with PAT auth, professional guard, and surface=mcp audit log"
```

---

## Task 6: Servidor MCP real en apps/mcp

**¿Por qué stdio y no HTTP?** Ver DEC-1 completo arriba. Claude Desktop espera un proceso stdio.

**Files:**

- Modify: `apps/mcp/package.json`
- Create: `apps/mcp/src/apiClient.ts`
- Create: `apps/mcp/src/tools/searchCorpus.ts`
- Create: `apps/mcp/src/tools/computeEligibility.ts`
- Create: `apps/mcp/src/tools/getProcedureRequirements.ts`
- Modify: `apps/mcp/src/index.ts`
- Create: `apps/mcp/src/server.ts`

- [ ] **Step 1: Instalar dependencias en apps/mcp**

```powershell
cd apps/mcp && pnpm add @modelcontextprotocol/sdk@^1.12.0
```

Verificar que `apps/mcp/package.json` queda con:

```json
{
  "name": "@lexia/mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "lexia-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Implementar el cliente HTTP hacia apps/api**

```typescript
// apps/mcp/src/apiClient.ts
// Ver DEC-2: el MCP solo conoce LEXIA_API_URL y LEXIA_PAT — no tiene DATABASE_URL
export interface ApiClientConfig {
  baseUrl: string;
  pat: string;
}

export class LexiaApiClient {
  private readonly headers: Record<string, string>;

  constructor(private readonly config: ApiClientConfig) {
    this.headers = {
      'Content-Type': 'application/json',
      // Ver DEC-3: PAT enviado como Bearer token en cada request
      Authorization: `Bearer ${config.pat}`,
    };
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
```

- [ ] **Step 3: Implementar el tool search_corpus_with_citations**

```typescript
// apps/mcp/src/tools/searchCorpus.ts
import { z } from 'zod';
import type { LexiaApiClient } from '../apiClient.js';

export const searchCorpusSchema = z.object({
  query: z.string().min(1).describe('Consulta en lenguaje natural sobre normativa de extranjería'),
  vertical: z
    .string()
    .default('nacionalidad_residencia')
    .describe('Vertical de normativa: nacionalidad_residencia (único en MVP)'),
});

export type SearchCorpusInput = z.infer<typeof searchCorpusSchema>;

export function createSearchCorpusTool(client: LexiaApiClient) {
  return {
    name: 'search_corpus_with_citations' as const,
    description:
      'Busca en el corpus legal de Lexia (BOE, Código Civil, instrucciones DGRN) y devuelve una respuesta con citas legales específicas. Usar para responder consultas normativas de clientes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Consulta en lenguaje natural' },
        vertical: {
          type: 'string',
          description: 'Vertical: nacionalidad_residencia',
          default: 'nacionalidad_residencia',
        },
      },
      required: ['query'],
    },
    async execute(input: SearchCorpusInput) {
      const result = await client.post<{ response: string; citations: string[] }>(
        '/api/mcp/search',
        input,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: `${result.response}\n\nCitas: ${result.citations.join(', ')}`,
          },
        ],
      };
    },
  };
}
```

- [ ] **Step 4: Implementar el tool compute_eligibility**

```typescript
// apps/mcp/src/tools/computeEligibility.ts
import type { LexiaApiClient } from '../apiClient.js';

export function createComputeEligibilityTool(client: LexiaApiClient) {
  return {
    name: 'compute_eligibility' as const,
    description:
      'Calcula si un cliente cumple el requisito de años de residencia para la nacionalidad española. Resultado determinista basado en Art. 22 CC.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        countryOrigin: {
          type: 'string',
          description: 'País de origen del cliente (e.g., "argentina", "colombia")',
        },
        arrivalDate: {
          type: 'string',
          description: 'Fecha de llegada a España en formato ISO 8601 (e.g., "2020-03-15")',
        },
        residenceStatus: {
          type: 'string',
          description: 'Situación: refugee, stateless, u omitir para caso general',
        },
      },
    },
    async execute(input: {
      countryOrigin?: string;
      arrivalDate?: string;
      residenceStatus?: string;
    }) {
      const result = await client.post<{
        yearsRequired: number;
        yearsElapsed?: number;
        yearsRemaining?: number;
        isEligible?: boolean;
        specialCase: string;
        legalBasis: string;
        notes: string[];
      }>('/api/mcp/eligibility', input);

      const summary = result.isEligible
        ? `✅ ELEGIBLE — ${result.yearsElapsed} años transcurridos de ${result.yearsRequired} requeridos.`
        : `❌ NO ELEGIBLE — Faltan ${result.yearsRemaining} años. Requisito: ${result.yearsRequired} años.`;

      return {
        content: [
          {
            type: 'text' as const,
            text: `${summary}\n\nBase legal: ${result.legalBasis}\n\nNotas:\n${result.notes.map((n) => `• ${n}`).join('\n')}`,
          },
        ],
      };
    },
  };
}
```

- [ ] **Step 5: Implementar el tool get_procedure_requirements**

```typescript
// apps/mcp/src/tools/getProcedureRequirements.ts
import type { LexiaApiClient } from '../apiClient.js';

export function createGetProcedureRequirementsTool(client: LexiaApiClient) {
  return {
    name: 'get_procedure_requirements' as const,
    description:
      'Devuelve el checklist de requisitos, campos de intake y recordatorios clave para un trámite. Usar para orientar al cliente sobre documentación necesaria.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        vertical: {
          type: 'string',
          description: 'Vertical: nacionalidad_residencia',
          default: 'nacionalidad_residencia',
        },
      },
      required: ['vertical'],
    },
    async execute(input: { vertical: string }) {
      const result = await client.get<{
        name: string;
        requirements: {
          intakeFields: string[];
          corpusSources: string[];
          reminders: Array<{ slug: string; label: string; defaultDaysBeforeDeadline: number }>;
        };
      }>(`/api/mcp/procedure/${encodeURIComponent(input.vertical)}/requirements`);

      const remindersText = result.requirements.reminders
        .map((r) => `• ${r.label} (${r.defaultDaysBeforeDeadline} días antes del plazo)`)
        .join('\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `## ${result.name}\n\n**Datos del cliente necesarios:**\n${result.requirements.intakeFields.map((f) => `• ${f}`).join('\n')}\n\n**Recordatorios clave:**\n${remindersText}`,
          },
        ],
      };
    },
  };
}
```

- [ ] **Step 6: Implementar el servidor MCP**

```typescript
// apps/mcp/src/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LexiaApiClient } from './apiClient.js';
import { createSearchCorpusTool } from './tools/searchCorpus.js';
import { createComputeEligibilityTool } from './tools/computeEligibility.js';
import { createGetProcedureRequirementsTool } from './tools/getProcedureRequirements.js';

export async function startMcpServer(): Promise<void> {
  // Ver DEC-2: solo necesita API_URL y PAT — sin acceso a DB ni credenciales internas
  const apiUrl = process.env.LEXIA_API_URL;
  const pat = process.env.LEXIA_PAT;

  if (!apiUrl || !pat) {
    process.stderr.write(
      'Error: LEXIA_API_URL y LEXIA_PAT son requeridos.\n' +
        'Configuralos en claude_desktop_config.json bajo "env".\n',
    );
    process.exit(1);
  }

  const client = new LexiaApiClient({ baseUrl: apiUrl, pat });

  const server = new McpServer({
    name: 'lexia',
    version: '0.1.0',
  });

  // Registrar los 3 tools profesionales
  const searchTool = createSearchCorpusTool(client);
  const eligibilityTool = createComputeEligibilityTool(client);
  const requirementsTool = createGetProcedureRequirementsTool(client);

  server.tool(searchTool.name, searchTool.description, searchTool.inputSchema, (input: any) =>
    searchTool.execute(input),
  );
  server.tool(
    eligibilityTool.name,
    eligibilityTool.description,
    eligibilityTool.inputSchema,
    (input: any) => eligibilityTool.execute(input),
  );
  server.tool(
    requirementsTool.name,
    requirementsTool.description,
    requirementsTool.inputSchema,
    (input: any) => requirementsTool.execute(input),
  );

  // Ver DEC-1: StdioServerTransport — sin puerto expuesto, proceso hijo de Claude Desktop
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 7: Actualizar el entrypoint index.ts**

```typescript
// apps/mcp/src/index.ts
import { startMcpServer } from './server.js';

startMcpServer().catch((err) => {
  process.stderr.write(`lexia-mcp failed to start: ${err}\n`);
  process.exit(1);
});
```

- [ ] **Step 8: Typecheck del paquete MCP**

```powershell
cd apps/mcp && pnpm typecheck
```

Esperado: sin errores.

- [ ] **Step 9: Build para verificar que el dist se genera**

```powershell
cd apps/mcp && pnpm build
```

Esperado: `dist/index.js` y `dist/server.js` generados sin errores.

- [ ] **Step 10: Commit**

```bash
git add apps/mcp/
git commit -m "feat(mcp): implement MCP server with 3 professional tools via stdio transport"
```

---

## Task 7: Tests de integración del audit log

**¿Por qué task separada para el audit log?** El audit log es un requerimiento de compliance (no solo funcional). Los tests deben verificar explícitamente que cada request MCP genera una fila con `surface = 'mcp'`. Esto es lo que se demuestra en la defensa.

**Files:**

- Create: `apps/api/src/routes/mcp.audit.test.ts`

- [ ] **Step 1: Escribir el test de audit log**

```typescript
// apps/api/src/routes/mcp.audit.test.ts
import { describe, it, expect, vi } from 'vitest';

// Capturar las filas insertadas en audit_log
const auditInserts: any[] = [];
const mockInsert = vi.fn((table: any) => ({
  values: vi.fn((row: any) => {
    auditInserts.push({ table, row });
    return Promise.resolve([]);
  }),
}));

vi.mock('../middleware/requirePat.js', () => ({
  requirePat: vi.fn(async (req: any) => {
    req.userId = 'pro-user';
    req.userRole = 'professional';
    req.userEmail = 'gestor@bufete.es';
  }),
}));
vi.mock('../middleware/requireProfessional.js', () => ({
  requireProfessional: vi.fn(async () => undefined),
}));
vi.mock('@lexia/core', () => ({
  runNormativaAgent: vi.fn().mockResolvedValue({ response: 'ok', citations: [] }),
  computeEligibility: vi.fn().mockReturnValue({
    yearsRequired: 2,
    isEligible: true,
    specialCase: 'iberoamerican',
    legalBasis: 'Art. 22 CC',
    notes: [],
  }),
}));
vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({ insert: mockInsert })),
  schema: { auditLog: 'auditLog' },
}));

import { buildServer } from '../server.js';

describe('MCP audit log', () => {
  it('POST /api/mcp/search inserta fila con surface=mcp en audit_log', async () => {
    auditInserts.length = 0;
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/api/mcp/search',
      payload: { query: 'test', vertical: 'nacionalidad_residencia' },
    });

    const auditRow = auditInserts.find((e) => e.table === 'auditLog' && e.row.surface === 'mcp');
    expect(auditRow).toBeDefined();
    expect(auditRow.row.actorType).toBe('user');
    expect(auditRow.row.actorId).toBe('pro-user');
    expect(auditRow.row.action).toBe('mcp_search');
  });

  it('POST /api/mcp/eligibility inserta fila con surface=mcp en audit_log', async () => {
    auditInserts.length = 0;
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/api/mcp/eligibility',
      payload: { countryOrigin: 'argentina' },
    });

    const auditRow = auditInserts.find((e) => e.table === 'auditLog' && e.row.surface === 'mcp');
    expect(auditRow).toBeDefined();
    expect(auditRow.row.action).toBe('mcp_eligibility');
  });
});
```

- [ ] **Step 2: Correr los tests**

```powershell
cd apps/api && pnpm test --reporter=verbose routes/mcp.audit
```

Esperado: PASS (2 tests)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/mcp.audit.test.ts
git commit -m "test(api): verify surface=mcp in audit_log for all MCP endpoints"
```

---

## Task 8: Documentación para gestores

**¿Por qué documentar el Claude Desktop config y no solo el README?** Claude Desktop lee `claude_desktop_config.json` para arrancar servidores MCP. Sin el ejemplo exacto, el gestor no puede configurarlo. La doc es parte del deliverable.

**Files:**

- Create: `apps/mcp/README.md`

- [ ] **Step 1: Escribir el README para gestores**

````markdown
# Lexia MCP Server — Guía para Gestores y Abogados

Lexia expone tres herramientas profesionales accesibles desde Claude Desktop o Cursor.

## Requisitos previos

1. Tener una cuenta Lexia con **verificación de colegiación aprobada** (solicitarla en la web desde tu perfil → "Verificación profesional")
2. Generar un **PAT** (Personal Access Token) en la web desde tu perfil → "Tokens de acceso"
3. Node.js 20+ instalado en tu máquina

## Instalación

```bash
# Clonar el repositorio o pedir el binario compilado al equipo de Lexia
git clone https://github.com/tu-org/lexia-capstone.git
cd lexia-capstone
pnpm install
pnpm --filter @lexia/mcp build
```
````

## Configuración en Claude Desktop

Editar `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) o `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "lexia": {
      "command": "node",
      "args": ["/ruta/absoluta/a/lexia-capstone/apps/mcp/dist/index.js"],
      "env": {
        "LEXIA_API_URL": "https://api.lexia.tu-dominio.com",
        "LEXIA_PAT": "tu-pat-de-64-caracteres-aqui"
      }
    }
  }
}
```

Reiniciar Claude Desktop. El ícono del servidor MCP aparecerá en la barra inferior.

## Configuración en Cursor

En `.cursor/mcp.json` en la raíz de tu proyecto:

```json
{
  "mcpServers": {
    "lexia": {
      "command": "node",
      "args": ["/ruta/absoluta/a/apps/mcp/dist/index.js"],
      "env": {
        "LEXIA_API_URL": "https://api.lexia.tu-dominio.com",
        "LEXIA_PAT": "tu-pat-aqui"
      }
    }
  }
}
```

## Herramientas disponibles

### `search_corpus_with_citations`

Busca en el corpus legal (BOE, Código Civil, instrucciones DGRN) y devuelve respuesta con citas.

**Ejemplo de uso:**

> "Usa search_corpus_with_citations para saber cuántos años de residencia necesita un cliente colombiano"

### `compute_eligibility`

Calcula si un cliente cumple el requisito de años de residencia. Resultado determinista (sin LLM).

**Ejemplo de uso:**

> "Usa compute_eligibility con countryOrigin=colombia, arrivalDate=2021-06-01"

### `get_procedure_requirements`

Devuelve el checklist de documentación y recordatorios clave para el trámite.

**Ejemplo de uso:**

> "Usa get_procedure_requirements para ver qué documentos necesita mi cliente"

## Seguridad del PAT

- El PAT se muestra **una única vez** al crearlo. Guardarlo en un gestor de contraseñas.
- Si se pierde, revocar el PAT desde el perfil web y crear uno nuevo.
- **No compartir el PAT** ni incluirlo en repositorios de código.
- El PAT identifica las acciones en el audit log de Lexia bajo tu nombre.

## Soporte

Contactar al administrador de Lexia para solicitar verificación de colegiación o reportar problemas.

````

- [ ] **Step 2: Commit**

```bash
git add apps/mcp/README.md
git commit -m "docs(mcp): add gestores guide with Claude Desktop and Cursor setup instructions"
````

---

## Task 9: Typecheck + test suite completo + pre-flight

- [ ] **Step 1: Typecheck de todos los paquetes afectados**

```powershell
pnpm --filter @lexia/db typecheck
pnpm --filter @lexia/api typecheck
pnpm --filter @lexia/mcp typecheck
```

Esperado: 0 errores en los 3 paquetes.

- [ ] **Step 2: Test suite completo de api**

```powershell
pnpm --filter @lexia/api test
```

Esperado: todos los tests existentes + los nuevos de esta fase pasan.

- [ ] **Step 3: Test suite completo de core**

```powershell
pnpm --filter @lexia/core test
```

Esperado: los 115+ tests de Fase 4/5 siguen pasando.

- [ ] **Step 4: pnpm audit**

```powershell
pnpm audit --audit-level=high
```

Esperado: 0 vulnerabilidades high/critical.

- [ ] **Step 5: Tag de fase**

```bash
git tag fase-6-complete
git push origin feat/fase6-mcp --tags
```

- [ ] **Step 6: Merge a main**

```bash
git checkout main
git merge --no-ff feat/fase6-mcp -m "feat: Fase 6 — MCP server + dual surface"
git push origin main
```

---

## Self-Review

### Spec coverage

| Requisito del spec                                      | Task que lo cubre              |
| ------------------------------------------------------- | ------------------------------ |
| MCP server con `@modelcontextprotocol/sdk`              | Task 6                         |
| Tools profesionales (search, eligibility, requirements) | Tasks 5 + 6                    |
| Auth + scopes obligatorios (PAT + colegiación)          | Tasks 1, 2, 3, 4               |
| Audit log diferencia surfaces                           | Task 5 + 7                     |
| Doc para gestores                                       | Task 8                         |
| Verificación de role professional en MCP                | Task 2 (`requireProfessional`) |

### Invariantes de seguridad verificables

1. `grep -r "tokenHash\|token_hash" apps/api/src/routes/pat.ts` — solo aparece en INSERT/SELECT, nunca en el response body
2. `grep -r "surface" apps/api/src/routes/mcp.ts` — aparece en el `logMcpAction` call de cada endpoint
3. `grep -r "DATABASE_URL" apps/mcp/src` — no debe aparecer (MCP no accede a DB directamente)
4. `grep -r "randomBytes" apps/api/src/routes/pat.ts` — CSPRNG confirmado
5. `grep -r "Math.random" apps/api/src` — no debe aparecer en nada relacionado a tokens

### Riesgos residuales documentados

- **R-MCP-1**: El PAT se transmite como Bearer en HTTP. Si `apps/api` está en HTTP (no HTTPS) en producción, es sniffable. Mitigación: Fase 8 configura Caddy con TLS. En desarrollo, se asume red local confiable.
- **R-MCP-2**: El gestor puede perder el PAT. Mitigación: flujo de revocación + creación nuevo PAT, documentado en README.
- **R-MCP-3**: La verificación de colegiación es manual — un admin distraído podría aprobar un no-profesional. Mitigación: proceso documentado, único punto de falla humano auditado.

```

```
