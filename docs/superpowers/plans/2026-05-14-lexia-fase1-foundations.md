# Lexia — Plan de implementación · Fase 1 (Foundations)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir los cimientos funcionales de Lexia: auth endurecida (email verification, HIBP, throttle), rutas API principales (me, cases, conversations, messages, documents), clientes de storage (Chroma + MinIO), contrato de vertical con manifest skeleton de `nacionalidad_residencia`, chat UI en Next.js con eco fake, y documentos de compliance (Privacy Policy, ToS, Aviso Legal, Subprocessors).

**Architecture:** `packages/core` se empieza a poblar con storage clients y el vertical contract. `apps/api` añade rutas protegidas con un preHandler `requireAuth`. `apps/web` añade shadcn/ui + página de login + chat UI que llama al API vía Next.js rewrites (mismo origin → sin problemas de CORS con cookies). El chat devuelve eco puro (sin LLM) para establecer el modelo de datos que F2 reemplazará.

**Tech Stack:** Node.js 20 · pnpm 9 · TypeScript 5 · Fastify 4 · Better Auth 1.1.7 · Next.js 15 (App Router) · Drizzle ORM · Zod 3 · nodemailer · hibp · @fastify/rate-limit · @fastify/multipart · chromadb ^1.9.7 · minio ^8.0.2 · shadcn/ui · better-auth/react · vitest.

**Spec base:** `docs/superpowers/specs/2026-05-01-lexia-design.md` §8.2 Fase 1 · §3.2 (schema) · §4.5-4.6 (auth hardening) · §6.1-6.3 (vertical contract).

**Tiempo objetivo:** ~45h (semanas 2–4).

---

## Estructura de archivos resultante

```
lexia-capstone/
├── packages/
│   ├── db/
│   │   └── src/schema/
│   │       ├── domain.ts         ← cases, conversations, messages, documents
│   │       ├── infrastructure.ts ← verticals, token_usage
│   │       └── index.ts          ← actualizado
│   └── core/
│       ├── package.json          ← deps: chromadb, minio, zod + vitest
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── storage/
│       │   │   ├── chroma.ts
│       │   │   ├── minio.ts
│       │   │   └── index.ts
│       │   ├── vertical/
│       │   │   ├── definition.ts  ← Zod schema VerticalDefinition
│       │   │   ├── registry.ts
│       │   │   ├── preflight.ts
│       │   │   └── index.ts
│       │   ├── verticals/
│       │   │   └── nacionalidad_residencia/
│       │   │       └── manifest.ts
│       │   └── index.ts           ← re-exports
│       └── tests/
│           ├── storage.test.ts
│           └── vertical.test.ts
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── mailer.ts
│   │   │   ├── types.ts            ← augment FastifyRequest
│   │   │   ├── middleware/
│   │   │   │   ├── requireAuth.ts
│   │   │   │   └── hibpCheck.ts
│   │   │   └── routes/
│   │   │       ├── me.ts
│   │   │       ├── cases.ts
│   │   │       ├── conversations.ts
│   │   │       ├── messages.ts
│   │   │       ├── documents.ts
│   │   │       └── deepHealth.ts
│   │   └── tests/
│   │       ├── me.test.ts
│   │       ├── cases.test.ts
│   │       ├── conversations.test.ts
│   │       ├── documents.test.ts
│   │       └── deepHealth.test.ts
│   └── web/
│       ├── .env.local
│       ├── next.config.mjs        ← rewrites a /api/*
│       ├── lib/
│       │   └── auth-client.ts
│       ├── app/
│       │   ├── (auth)/login/page.tsx
│       │   └── (app)/
│       │       ├── layout.tsx
│       │       └── chat/page.tsx
│       └── components/
│           ├── chat/
│           │   ├── MessageList.tsx
│           │   └── MessageInput.tsx
│           └── Disclaimer.tsx
└── docs/
    ├── legal/
    │   ├── privacy_policy.md
    │   ├── terms_of_service.md
    │   └── aviso_legal.md
    └── compliance/
        ├── subprocessors.md
        └── records_of_processing.md
```

---

## Convenciones

- Todos los comandos asumen working dir `C:\Users\facun\Desktop\facu\lexia-capstone`.
- Shell: PowerShell 7. Comandos `pnpm` son cross-platform.
- Cada Task termina en commit. Mensajes en inglés, Conventional Commits.
- TDD donde hay comportamiento observable. Tests de storage se ejecutan con mock; tests de rutas usan `app.inject()`.

---

## Task 1: packages/db — domain + infrastructure tables

**Files:**

- Create: `packages/db/src/schema/domain.ts`
- Create: `packages/db/src/schema/infrastructure.ts`
- Modify: `packages/db/src/schema/index.ts`

**Tiempo estimado:** 1.5h

- [ ] **Step 1: Crear `packages/db/src/schema/domain.ts`**

```ts
import { boolean, date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const cases = pgTable('cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  verticalSlug: text('vertical_slug').notNull().default('nacionalidad_residencia'),
  countryOrigin: text('country_origin'), // F3: pgcrypto encryption
  arrivalDate: date('arrival_date'),
  residenceStatus: text('residence_status'),
  hasChildren: boolean('has_children').notNull().default(false),
  status: text('status').notNull().default('active'), // active | archived
  notes: text('notes'), // F3: pgcrypto encryption
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  title: text('title'),
  surface: text('surface').notNull().default('web'), // web | mcp
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // user | assistant
    content: text('content').notNull(),
    traceId: text('trace_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    convIdx: index('messages_conversation_idx').on(table.conversationId),
  }),
);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  filename: text('filename').notNull(), // F3: pgcrypto encryption
  minioKey: text('minio_key'),
  status: text('status').notNull().default('pending'), // pending | sanitized | indexed | rejected
  sizeBytes: integer('size_bytes'),
  mimeType: text('mime_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Crear `packages/db/src/schema/infrastructure.ts`**

```ts
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const verticals = pgTable('verticals', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  corpusNamespace: text('corpus_namespace').notNull(),
  version: text('version').notNull().default('0.0.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tokenUsage = pgTable(
  'token_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodMonth: text('period_month').notNull(), // e.g. '2026-05'
    tokensUsed: integer('tokens_used').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userPeriodIdx: index('token_usage_user_period_idx').on(table.userId, table.periodMonth),
  }),
);
```

- [ ] **Step 3: Actualizar `packages/db/src/schema/index.ts`**

```ts
export * from './auth.js';
export * from './audit.js';
export * from './domain.js';
export * from './infrastructure.js';
```

- [ ] **Step 4: Generar migración**

Run:

```powershell
$env:DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').ToString().Split('=', 2)[1]
pnpm --filter @lexia/db db:generate
```

Expected: crea `packages/db/migrations/0001_*.sql` con `CREATE TABLE` para las 4 tablas nuevas (cases, conversations, messages, documents, verticals, token_usage).

- [ ] **Step 5: Aplicar migración**

Run:

```powershell
pnpm --filter @lexia/db db:migrate
```

Verificar:

```powershell
docker exec lexia-postgres psql -U lexia -d lexia -c "\dt"
```

Expected: 11 tablas totales (5 de F0 + 6 nuevas + `__drizzle_migrations`).

- [ ] **Step 6: Typecheck**

```powershell
pnpm --filter @lexia/db typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): add domain and infrastructure schema (cases, conversations, messages, documents, verticals, token_usage)"
```

---

## Task 2: packages/core — setup + Chroma + MinIO clients

**Files:**

- Modify: `packages/core/package.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/storage/chroma.ts`
- Create: `packages/core/src/storage/minio.ts`
- Create: `packages/core/src/storage/index.ts`
- Create: `packages/core/tests/storage.test.ts`

**Tiempo estimado:** 2h

- [ ] **Step 1: Actualizar `packages/core/package.json`**

```json
{
  "name": "@lexia/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./storage": "./src/storage/index.ts",
    "./vertical": "./src/vertical/index.ts"
  },
  "scripts": {
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "chromadb": "^1.9.7",
    "minio": "^8.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.5",
    "@types/node": "^20.14.0"
  }
}
```

- [ ] **Step 2: Crear `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Crear `packages/core/src/storage/chroma.ts`**

```ts
import { ChromaClient } from 'chromadb';

export interface ChromaConfig {
  path?: string;
}

export function createChromaClient(config?: ChromaConfig): ChromaClient {
  return new ChromaClient({
    path: config?.path ?? process.env.CHROMA_URL ?? 'http://localhost:8000',
  });
}

export async function ensureCollection(
  client: ChromaClient,
  collectionName = 'lexia_corpus',
): Promise<void> {
  await client.getOrCreateCollection({
    name: collectionName,
    metadata: { 'hnsw:space': 'cosine' },
  });
}
```

- [ ] **Step 4: Crear `packages/core/src/storage/minio.ts`**

```ts
import { Client as MinioClient } from 'minio';

export interface MinioConfig {
  endPoint?: string;
  port?: number;
  useSSL?: boolean;
  accessKey?: string;
  secretKey?: string;
}

export function createMinioClient(config?: MinioConfig): MinioClient {
  return new MinioClient({
    endPoint: config?.endPoint ?? process.env.MINIO_ENDPOINT ?? 'localhost',
    port: config?.port ?? Number(process.env.MINIO_PORT ?? '9000'),
    useSSL: config?.useSSL ?? false,
    accessKey: config?.accessKey ?? process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: config?.secretKey ?? process.env.MINIO_SECRET_KEY ?? '',
  });
}

export async function ensureBucket(client: MinioClient, bucket: string): Promise<void> {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
  }
}
```

- [ ] **Step 5: Crear `packages/core/src/storage/index.ts`**

```ts
export * from './chroma.js';
export * from './minio.js';
```

- [ ] **Step 6: Escribir test failing primero**

Crear `packages/core/tests/storage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChromaClient, createMinioClient } from '../src/storage/index.js';

vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => ({
    heartbeat: vi.fn().mockResolvedValue({ 'nanosecond heartbeat': 1 }),
    getOrCreateCollection: vi.fn().mockResolvedValue({ name: 'lexia_corpus' }),
  })),
}));

vi.mock('minio', () => ({
  Client: vi.fn().mockImplementation(() => ({
    bucketExists: vi.fn().mockResolvedValue(false),
    makeBucket: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('createChromaClient', () => {
  it('creates a ChromaClient with default URL', () => {
    const client = createChromaClient();
    expect(client).toBeDefined();
  });

  it('creates a ChromaClient with custom URL', () => {
    const client = createChromaClient({ path: 'http://custom:8000' });
    expect(client).toBeDefined();
  });
});

describe('createMinioClient', () => {
  it('creates a MinioClient with default config', () => {
    const client = createMinioClient();
    expect(client).toBeDefined();
  });
});
```

- [ ] **Step 7: Correr test y verificar que falla**

```powershell
pnpm install
pnpm --filter @lexia/core test
```

Expected: FAIL porque los archivos de storage no existen todavía (ya los creamos, así que debería pasar — si falla por otro motivo, revisar imports).

- [ ] **Step 8: Correr test y verificar PASS**

Expected: 3 tests PASS.

- [ ] **Step 9: Typecheck**

```powershell
pnpm --filter @lexia/core typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): add chroma and minio storage clients"
```

---

## Task 3: packages/core — vertical contract + NR manifest

**Files:**

- Create: `packages/core/src/vertical/definition.ts`
- Create: `packages/core/src/vertical/registry.ts`
- Create: `packages/core/src/verticals/nacionalidad_residencia/manifest.ts`
- Create: `packages/core/src/vertical/index.ts`
- Create: `packages/core/tests/vertical.test.ts`
- Modify: `packages/core/src/index.ts`

**Tiempo estimado:** 1.5h

- [ ] **Step 1: Crear `packages/core/src/vertical/definition.ts`**

```ts
import { z } from 'zod';

export const VerticalDefinitionSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z_]+$/),
  name: z.string().min(1),
  description: z.string(),
  enabled: z.boolean().default(true),
  version: z.string().default('0.0.0'),
  corpus: z.object({
    namespace: z.string().min(1), // e.g. 'vertical:nacionalidad_residencia'
    sources: z.array(z.string()).default([]),
  }),
  intake: z.object({
    fields: z.array(z.string()).default([]), // field names for case intake form
  }),
});

export type VerticalDefinition = z.infer<typeof VerticalDefinitionSchema>;
```

- [ ] **Step 2: Crear `packages/core/src/vertical/registry.ts`**

```ts
import type { VerticalDefinition } from './definition.js';
import { nacionalidadResidencia } from '../verticals/nacionalidad_residencia/manifest.js';

const _registry = new Map<string, VerticalDefinition>();

export function registerVertical(vertical: VerticalDefinition): void {
  _registry.set(vertical.slug, vertical);
}

export function getVertical(slug: string): VerticalDefinition | undefined {
  return _registry.get(slug);
}

export function getEnabledVerticals(): VerticalDefinition[] {
  return [..._registry.values()].filter((v) => v.enabled);
}

// Auto-register built-in verticals
registerVertical(nacionalidadResidencia);
```

- [ ] **Step 3: Crear `packages/core/src/verticals/nacionalidad_residencia/manifest.ts`**

```ts
import type { VerticalDefinition } from '../../vertical/definition.js';

export const nacionalidadResidencia: VerticalDefinition = {
  slug: 'nacionalidad_residencia',
  name: 'Nacionalidad por Residencia',
  description:
    'Asistencia informativa sobre el proceso de obtención de la nacionalidad española por residencia, incluyendo requisitos, plazos, documentación y examen CCSE.',
  enabled: true,
  version: '0.1.0',
  corpus: {
    namespace: 'vertical:nacionalidad_residencia',
    sources: [
      'BOE (RD 557/2011 - Reglamento de Extranjería)',
      'Código Civil arts. 17-26 (nacionalidad)',
      'Instrucciones DGRN sobre nacionalidad por residencia',
      'Manual oficial CCSE (Instituto Cervantes)',
    ],
  },
  intake: {
    fields: ['countryOrigin', 'arrivalDate', 'residenceStatus', 'hasChildren'],
  },
};
```

- [ ] **Step 4: Crear `packages/core/src/vertical/index.ts`**

```ts
export * from './definition.js';
export * from './registry.js';
```

- [ ] **Step 5: Actualizar `packages/core/src/index.ts`**

```ts
export const LEXIA_CORE_VERSION = '0.1.0';
export * from './storage/index.js';
export * from './vertical/index.js';
```

- [ ] **Step 6: Escribir failing test**

Crear `packages/core/tests/vertical.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { VerticalDefinitionSchema } from '../src/vertical/definition.js';
import { getVertical, getEnabledVerticals } from '../src/vertical/registry.js';
import { nacionalidadResidencia } from '../src/verticals/nacionalidad_residencia/manifest.js';

describe('VerticalDefinitionSchema', () => {
  it('validates a valid vertical definition', () => {
    const result = VerticalDefinitionSchema.safeParse(nacionalidadResidencia);
    expect(result.success).toBe(true);
  });

  it('rejects a vertical with empty slug', () => {
    const result = VerticalDefinitionSchema.safeParse({ ...nacionalidadResidencia, slug: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a vertical with invalid slug (uppercase)', () => {
    const result = VerticalDefinitionSchema.safeParse({
      ...nacionalidadResidencia,
      slug: 'Nacionalidad',
    });
    expect(result.success).toBe(false);
  });
});

describe('registry', () => {
  it('registers nacionalidad_residencia at module load', () => {
    const vertical = getVertical('nacionalidad_residencia');
    expect(vertical).toBeDefined();
    expect(vertical?.slug).toBe('nacionalidad_residencia');
  });

  it('returns enabled verticals', () => {
    const list = getEnabledVerticals();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((v) => v.enabled)).toBe(true);
  });
});
```

- [ ] **Step 7: Correr tests**

```powershell
pnpm --filter @lexia/core test
```

Expected: 5 tests PASS (3 storage + 5 vertical — total 8, some overlap with previous run).

- [ ] **Step 8: Typecheck**

```powershell
pnpm --filter @lexia/core typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): add vertical contract and nacionalidad_residencia manifest skeleton"
```

---

## Task 4: Auth hardening — email verification + CORS

**Files:**

- Create: `apps/api/src/mailer.ts`
- Modify: `apps/api/src/auth.ts`
- Modify: `apps/api/src/server.ts` (CORS)
- Modify: `apps/api/package.json`
- Modify: `apps/api/tests/auth.test.ts`

**Tiempo estimado:** 1.5h

- [ ] **Step 1: Añadir nodemailer a `apps/api/package.json`**

En `dependencies` agregar:

```json
"nodemailer": "^6.9.16"
```

En `devDependencies` agregar:

```json
"@types/nodemailer": "^6.4.17"
```

Run:

```powershell
pnpm install
```

- [ ] **Step 2: Crear `apps/api/src/mailer.ts`**

```ts
import nodemailer from 'nodemailer';

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? '1025'),
  secure: false,
  tls: { rejectUnauthorized: false },
});
```

- [ ] **Step 3: Actualizar `apps/api/src/auth.ts`**

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb, schema } from '@lexia/db';
import { mailer } from './mailer.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error('BETTER_AUTH_SECRET is required');

const db = createDb(databaseUrl);

const requireEmailVerification = process.env.NODE_ENV !== 'test';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verifications: schema.verifications,
    },
    usePlural: true,
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await mailer.sendMail({
        from: process.env.SMTP_FROM ?? 'noreply@lexia.local',
        to: user.email,
        subject: 'Verificá tu email en Lexia',
        html: `<p>Hola ${user.name ?? user.email},</p>
               <p>Para verificar tu cuenta hacé clic aquí:</p>
               <p><a href="${url}">Verificar email</a></p>
               <p>El enlace expira en 24 horas.</p>
               <p><small>Si no creaste una cuenta en Lexia, ignorá este mensaje.</small></p>`,
      });
    },
    autoSignInAfterVerification: true,
  },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:4000',
    ...(process.env.TRUSTED_ORIGINS?.split(',') ?? []),
  ],
});
```

- [ ] **Step 4: Actualizar CORS en `apps/api/src/server.ts`**

Reemplazar la línea de registro de cors:

```ts
// Antes:
await app.register(cors, { origin: true, credentials: true });

// Después:
await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000', 'http://localhost:4000'],
  credentials: true,
});
```

- [ ] **Step 5: Correr los tests existentes**

```powershell
pnpm --filter @lexia/api test
```

Expected: 2 tests PASS (health + sign-up). `requireEmailVerification` es `false` en test env → el test existente sigue funcionando sin cambios.

- [ ] **Step 6: Smoke — email de verificación a mailhog**

Levantar docker-compose si no está:

```powershell
docker compose -f docker-compose.dev.yml up -d
```

En una terminal:

```powershell
pnpm --filter @lexia/api dev
```

En otra:

```powershell
$body = @{ email='verify@lexia.local'; password='LongPassword123!'; name='Verify Test' } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri http://localhost:4000/api/auth/sign-up/email -Body $body -ContentType 'application/json'
```

Abrir `http://localhost:8025` (MailHog UI). Expected: email con link de verificación recibido para `verify@lexia.local`.

- [ ] **Step 7: Commit**

```powershell
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): enable email verification and update CORS to specific origins"
```

---

## Task 5: Auth hardening — HIBP check + rate limiting

**Files:**

- Modify: `apps/api/package.json`
- Create: `apps/api/src/middleware/hibpCheck.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/tests/hibp.test.ts`

**Tiempo estimado:** 1.5h

- [ ] **Step 1: Añadir deps a `apps/api/package.json`**

En `dependencies` agregar:

```json
"hibp": "^13.0.0",
"@fastify/rate-limit": "^9.1.0"
```

Run:

```powershell
pnpm install
```

- [ ] **Step 2: Crear `apps/api/src/middleware/hibpCheck.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { pwnedPassword } from 'hibp';

export async function hibpPasswordCheck(
  request: FastifyRequest<{ Body: { password?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const password = (request.body as { password?: string } | undefined)?.password;
  if (!password) return;

  // Skip HIBP in test environment to avoid network calls
  if (process.env.NODE_ENV === 'test') return;

  const count = await pwnedPassword(password);
  if (count > 0) {
    return reply.status(400).send({
      error: 'HIBP_PWNED',
      message:
        'Esta contraseña fue expuesta en filtraciones de datos públicas. Elegí una diferente.',
    });
  }
}
```

- [ ] **Step 3: Escribir failing test**

Crear `apps/api/tests/hibp.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

vi.mock('hibp', () => ({
  pwnedPassword: vi.fn().mockImplementation(async (password: string) => {
    if (password === 'password123') return 5; // this password is pwned
    return 0;
  }),
}));

// Override NODE_ENV so the HIBP check runs in this test
vi.stubEnv('NODE_ENV', 'development');

describe('HIBP password check', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a pwned password during sign-up', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'hibp@lexia.local',
        password: 'password123', // mocked as pwned
        name: 'HIBP Test',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('HIBP_PWNED');
  });

  it('allows a non-pwned password during sign-up', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: `safe-${Date.now()}@lexia.local`,
        password: 'SafeUniquePassword999!',
        name: 'Safe User',
      },
    });

    // 200 from Better Auth (sign-up success) or 422 (validation) — not 400 HIBP
    expect(response.statusCode).not.toBe(400);
  });
});
```

- [ ] **Step 4: Correr test y verificar que falla**

```powershell
pnpm --filter @lexia/api test
```

Expected: FAIL — `hibpPasswordCheck` preHandler no está conectado todavía.

- [ ] **Step 5: Actualizar `apps/api/src/server.ts`**

El archivo completo resultante:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { healthRoute } from './routes/health.js';
import { auth } from './auth.js';
import { hibpPasswordCheck } from './middleware/hibpCheck.js';

async function handleAuthRequest(
  request: Parameters<typeof auth.handler>[0] extends Request
    ? never
    : Parameters<import('fastify').RouteHandlerMethod>[0],
  reply: Parameters<import('fastify').RouteHandlerMethod>[1],
) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (value !== undefined) headers.set(key, value);
  }
  const init: RequestInit = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = JSON.stringify((request as { body?: unknown }).body ?? {});
  }
  const webRequest = new Request(url, init);
  const response = await auth.handler(webRequest);
  reply.status(response.status);
  response.headers.forEach((value, key) => reply.header(key, value));
  return reply.send(await response.text());
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:4000',
    ],
    credentials: true,
  });
  await app.register(sensible);
  await app.register(rateLimit, { global: false });

  // Auth routes with specific rate limits and HIBP check on sign-up
  app.post('/api/auth/sign-up/email', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    preHandler: [hibpPasswordCheck],
    handler: handleAuthRequest,
  });

  app.post('/api/auth/sign-in/email', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    handler: handleAuthRequest,
  });

  // Fallback for all other auth routes
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: handleAuthRequest,
  });

  await app.register(healthRoute);

  return app;
}
```

- [ ] **Step 6: Correr todos los tests**

```powershell
pnpm --filter @lexia/api test
```

Expected: todos los tests PASS (health + sign-up + hibp).

- [ ] **Step 7: Typecheck**

```powershell
pnpm --filter @lexia/api typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add HIBP password check and rate limiting on auth routes"
```

---

## Task 6: API — auth middleware (requireAuth)

**Files:**

- Create: `apps/api/src/types.ts`
- Create: `apps/api/src/middleware/requireAuth.ts`
- Create: `apps/api/tests/requireAuth.test.ts`

**Tiempo estimado:** 45min

- [ ] **Step 1: Crear `apps/api/src/types.ts`**

```ts
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}
```

- [ ] **Step 2: Crear `apps/api/src/middleware/requireAuth.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '../auth.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (value != null) headers.set(key, value);
  }

  const session = await auth.api.getSession({ headers });
  if (!session) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Autenticación requerida' });
  }

  request.userId = session.user.id;
}
```

- [ ] **Step 3: Escribir failing test**

Crear `apps/api/tests/requireAuth.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('requireAuth middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();

    // Register a test route that uses requireAuth
    app.get(
      '/api/test/protected',
      { preHandler: [(await import('../src/middleware/requireAuth.js')).requireAuth] },
      async (request) => ({ userId: request.userId }),
    );

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when no session cookie is present', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/test/protected',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('UNAUTHORIZED');
  });
});
```

- [ ] **Step 4: Correr test y verificar PASS**

```powershell
pnpm --filter @lexia/api test
```

Expected: nuevo test PASS (401 sin cookie).

- [ ] **Step 5: Commit**

```powershell
git add apps/api
git commit -m "feat(api): add requireAuth preHandler middleware"
```

---

## Task 7: API routes — /me

**Files:**

- Create: `apps/api/src/routes/me.ts`
- Modify: `apps/api/src/server.ts` (register route)
- Create: `apps/api/tests/me.test.ts`

**Tiempo estimado:** 1.5h

- [ ] **Step 1: Escribir failing test**

Crear `apps/api/tests/me.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';

describe('GET /api/me', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  const testEmail = `me-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Sign up and get session cookie
    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: testEmail, password: 'TestPassword123!', name: 'Me Test' },
    });
    const setCookie = signup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? '');
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('returns 401 without session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/me' });
    expect(response.statusCode).toBe(401);
  });

  it('returns user profile with valid session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe(testEmail);
  });
});
```

- [ ] **Step 2: Correr test y verificar que falla**

```powershell
pnpm --filter @lexia/api test
```

Expected: FAIL — ruta `/api/me` devuelve 404.

- [ ] **Step 3: Crear `apps/api/src/routes/me.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const meRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        emailVerified: schema.users.emailVerified,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, request.userId))
      .then((rows) => rows[0]);

    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    return user;
  });

  app.get('/api/me/export', { preHandler: [requireAuth] }, async (request) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, request.userId));

    const userCases = await db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.userId, request.userId));

    const userConversations = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.userId, request.userId));

    return { user, cases: userCases, conversations: userConversations, exportedAt: new Date() };
  });

  app.delete('/api/me/account', { preHandler: [requireAuth] }, async (request, reply) => {
    await db.delete(schema.users).where(eq(schema.users.id, request.userId));
    return reply.status(204).send();
  });
};
```

- [ ] **Step 4: Registrar ruta en `apps/api/src/server.ts`**

Añadir al final de `buildServer`, antes del `return app`:

```ts
import { meRoute } from './routes/me.js';
// ...
await app.register(meRoute);
```

- [ ] **Step 5: Correr tests y verificar PASS**

```powershell
pnpm --filter @lexia/api test
```

Expected: todos los tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api
git commit -m "feat(api): add /me route with profile, export, and delete"
```

---

## Task 8: API routes — cases CRUD

**Files:**

- Create: `apps/api/src/routes/cases.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/tests/cases.test.ts`

**Tiempo estimado:** 2h

- [ ] **Step 1: Escribir failing test**

Crear `apps/api/tests/cases.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';

describe('Cases API', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  const testEmail = `cases-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: testEmail, password: 'TestPassword123!', name: 'Cases Test' },
    });
    const setCookie = signup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? '');
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('POST /api/cases — creates a case', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: { cookie: sessionCookie },
      payload: {
        verticalSlug: 'nacionalidad_residencia',
        countryOrigin: 'Argentina',
        hasChildren: false,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().verticalSlug).toBe('nacionalidad_residencia');
  });

  it('GET /api/cases — lists cases for the authenticated user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });
});
```

- [ ] **Step 2: Correr test y verificar que falla**

Expected: FAIL — 404 en `/api/cases`.

- [ ] **Step 3: Crear `apps/api/src/routes/cases.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const casesRoute: FastifyPluginAsync = async (app) => {
  app.post('/api/cases', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as {
      verticalSlug?: string;
      countryOrigin?: string;
      arrivalDate?: string;
      residenceStatus?: string;
      hasChildren?: boolean;
      notes?: string;
    };

    const [newCase] = await db
      .insert(schema.cases)
      .values({
        userId: request.userId,
        verticalSlug: body.verticalSlug ?? 'nacionalidad_residencia',
        countryOrigin: body.countryOrigin ?? null,
        arrivalDate: body.arrivalDate ?? null,
        residenceStatus: body.residenceStatus ?? null,
        hasChildren: body.hasChildren ?? false,
        notes: body.notes ?? null,
      })
      .returning();

    return reply.status(201).send(newCase);
  });

  app.get('/api/cases', { preHandler: [requireAuth] }, async (request) => {
    return db
      .select()
      .from(schema.cases)
      .where(and(eq(schema.cases.userId, request.userId), eq(schema.cases.status, 'active')));
  });

  app.get('/api/cases/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [found] = await db
      .select()
      .from(schema.cases)
      .where(and(eq(schema.cases.id, id), eq(schema.cases.userId, request.userId)));

    if (!found) return reply.status(404).send({ error: 'NOT_FOUND' });
    return found;
  });

  app.patch('/api/cases/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      countryOrigin: string;
      arrivalDate: string;
      residenceStatus: string;
      hasChildren: boolean;
      notes: string;
      status: string;
    }>;

    const [updated] = await db
      .update(schema.cases)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(schema.cases.id, id), eq(schema.cases.userId, request.userId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'NOT_FOUND' });
    return updated;
  });
};
```

- [ ] **Step 4: Registrar en `apps/api/src/server.ts`**

```ts
import { casesRoute } from './routes/cases.js';
// ...
await app.register(casesRoute);
```

- [ ] **Step 5: Correr tests y verificar PASS**

```powershell
pnpm --filter @lexia/api test
```

Expected: todos PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api
git commit -m "feat(api): add cases CRUD routes"
```

---

## Task 9: API routes — conversations + messages (echo)

**Files:**

- Create: `apps/api/src/routes/conversations.ts`
- Create: `apps/api/src/routes/messages.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/tests/conversations.test.ts`

**Tiempo estimado:** 2h

- [ ] **Step 1: Escribir failing test**

Crear `apps/api/tests/conversations.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';

describe('Conversations + Messages API', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let conversationId: string;
  const testEmail = `conv-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: testEmail, password: 'TestPassword123!', name: 'Conv Test' },
    });
    const setCookie = signup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? '');
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('POST /api/conversations — creates a conversation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { cookie: sessionCookie },
      payload: { title: 'Mi consulta de nacionalidad' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().id).toBeTruthy();
    conversationId = response.json().id as string;
  });

  it('POST /api/conversations/:id/messages — returns echo response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: sessionCookie },
      payload: { content: '¿Cuáles son los requisitos para la nacionalidad?' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.userMessage.role).toBe('user');
    expect(body.assistantMessage.role).toBe('assistant');
    expect(body.assistantMessage.content).toContain('[eco]');
  });

  it('GET /api/conversations — lists conversations', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/conversations',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });
});
```

- [ ] **Step 2: Correr test y verificar que falla**

Expected: FAIL — 404.

- [ ] **Step 3: Crear `apps/api/src/routes/conversations.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const conversationsRoute: FastifyPluginAsync = async (app) => {
  app.post('/api/conversations', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { title?: string; caseId?: string };
    const [conv] = await db
      .insert(schema.conversations)
      .values({
        userId: request.userId,
        title: body.title ?? null,
        caseId: body.caseId ?? null,
        surface: 'web',
      })
      .returning();

    return reply.status(201).send(conv);
  });

  app.get('/api/conversations', { preHandler: [requireAuth] }, async (request) => {
    return db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.userId, request.userId))
      .orderBy(schema.conversations.updatedAt);
  });

  app.get('/api/conversations/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, request.userId)));

    if (!conv) return reply.status(404).send({ error: 'NOT_FOUND' });
    return conv;
  });

  app.get(
    '/api/conversations/:id/messages',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [conv] = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(
          and(eq(schema.conversations.id, id), eq(schema.conversations.userId, request.userId)),
        );

      if (!conv) return reply.status(404).send({ error: 'NOT_FOUND' });

      return db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, id))
        .orderBy(schema.messages.createdAt);
    },
  );
};
```

- [ ] **Step 4: Crear `apps/api/src/routes/messages.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const messagesRoute: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/conversations/:id/messages',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: conversationId } = request.params as { id: string };
      const body = request.body as { content?: string };
      const content = body.content?.trim();

      if (!content) return reply.status(400).send({ error: 'CONTENT_REQUIRED' });

      // Verify conversation belongs to user
      const [conv] = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.id, conversationId),
            eq(schema.conversations.userId, request.userId),
          ),
        );

      if (!conv) return reply.status(404).send({ error: 'NOT_FOUND' });

      // Store user message
      const [userMessage] = await db
        .insert(schema.messages)
        .values({ conversationId, role: 'user', content })
        .returning();

      // Echo response (F2 replaces this with real LLM call)
      const echoContent = `Lexia [eco]: ${content}`;
      const [assistantMessage] = await db
        .insert(schema.messages)
        .values({ conversationId, role: 'assistant', content: echoContent })
        .returning();

      // Update conversation updatedAt
      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, conversationId));

      return reply.send({ userMessage, assistantMessage });
    },
  );
};
```

- [ ] **Step 5: Registrar rutas en `apps/api/src/server.ts`**

```ts
import { conversationsRoute } from './routes/conversations.js';
import { messagesRoute } from './routes/messages.js';
// ...
await app.register(conversationsRoute);
await app.register(messagesRoute);
```

- [ ] **Step 6: Correr tests y verificar PASS**

```powershell
pnpm --filter @lexia/api test
```

Expected: todos PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/api
git commit -m "feat(api): add conversations and messages routes with echo mode"
```

---

## Task 10: API routes — document upload

**Files:**

- Modify: `apps/api/package.json`
- Create: `apps/api/src/routes/documents.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/tests/documents.test.ts`

**Tiempo estimado:** 1.5h

- [ ] **Step 1: Añadir @fastify/multipart**

En `apps/api/package.json` → `dependencies`:

```json
"@fastify/multipart": "^8.3.0"
```

Run:

```powershell
pnpm install
```

- [ ] **Step 2: Escribir failing test**

Crear `apps/api/tests/documents.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

// Mock MinIO to avoid needing real MinIO in tests
vi.mock('@lexia/core/storage', () => ({
  createMinioClient: vi.fn(() => ({
    bucketExists: vi.fn().mockResolvedValue(true),
    putObject: vi.fn().mockResolvedValue(undefined),
  })),
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

const DB_URL = process.env.DATABASE_URL ?? '';

describe('Documents API', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  const testEmail = `docs-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: testEmail, password: 'TestPassword123!', name: 'Docs Test' },
    });
    const setCookie = signup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? '');
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('POST /api/documents/upload — requires auth', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/documents/upload' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/documents — returns empty list for new user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
```

- [ ] **Step 3: Crear `apps/api/src/routes/documents.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { createMinioClient } from '@lexia/core/storage';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const db = createDb(process.env.DATABASE_URL ?? '');
const minio = createMinioClient();
const BUCKET = process.env.MINIO_BUCKET ?? 'lexia-uploads';

export const documentsRoute: FastifyPluginAsync = async (app) => {
  app.post('/api/documents/upload', { preHandler: [requireAuth] }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'NO_FILE' });

    const ext = data.filename.split('.').pop() ?? 'bin';
    const minioKey = `${request.userId}/${randomUUID()}.${ext}`;
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    await minio.putObject(BUCKET, minioKey, buffer, buffer.length, {
      'Content-Type': data.mimetype,
    });

    const [doc] = await db
      .insert(schema.documents)
      .values({
        userId: request.userId,
        filename: data.filename,
        minioKey,
        status: 'pending',
        sizeBytes: buffer.length,
        mimeType: data.mimetype,
      })
      .returning();

    return reply.status(201).send(doc);
  });

  app.get('/api/documents', { preHandler: [requireAuth] }, async (request) => {
    return db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.userId, request.userId))
      .orderBy(schema.documents.createdAt);
  });
};
```

- [ ] **Step 4: Registrar multipart y ruta en `apps/api/src/server.ts`**

```ts
import multipart from '@fastify/multipart';
import { documentsRoute } from './routes/documents.js';
// ...
// Registrar después de los otros plugins y antes de las rutas:
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB
// ...
await app.register(documentsRoute);
```

- [ ] **Step 5: Correr tests y verificar PASS**

```powershell
pnpm --filter @lexia/api test
```

Expected: todos PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add document upload endpoint backed by MinIO"
```

---

## Task 11: Pre-flight check + /api/health/deep + CI

**Files:**

- Create: `packages/core/src/vertical/preflight.ts`
- Modify: `packages/core/src/vertical/index.ts`
- Create: `apps/api/src/routes/deepHealth.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/tests/deepHealth.test.ts`
- Modify: `.github/workflows/ci.yml`

**Tiempo estimado:** 1h

- [ ] **Step 1: Crear `packages/core/src/vertical/preflight.ts`**

```ts
import { getEnabledVerticals } from './registry.js';
import type { VerticalDefinition } from './definition.js';

export interface PreflightResult {
  ok: boolean;
  checks: Array<{ vertical: string; check: string; passed: boolean; detail?: string }>;
}

export function runPreflight(): PreflightResult {
  const verticals = getEnabledVerticals();
  const checks: PreflightResult['checks'] = [];

  for (const v of verticals) {
    checks.push({
      vertical: v.slug,
      check: 'slug_valid',
      passed: /^[a-z_]+$/.test(v.slug) && v.slug.length > 0,
    });

    checks.push({
      vertical: v.slug,
      check: 'corpus_namespace_present',
      passed: typeof v.corpus.namespace === 'string' && v.corpus.namespace.length > 0,
    });

    checks.push({
      vertical: v.slug,
      check: 'intake_fields_defined',
      passed: Array.isArray(v.intake.fields),
    });
  }

  const ok = checks.every((c) => c.passed);
  return { ok, checks };
}
```

- [ ] **Step 2: Actualizar `packages/core/src/vertical/index.ts`**

```ts
export * from './definition.js';
export * from './registry.js';
export * from './preflight.js';
```

- [ ] **Step 3: Añadir test de preflight en `packages/core/tests/vertical.test.ts`**

Agregar al final del archivo:

```ts
import { runPreflight } from '../src/vertical/preflight.js';

describe('runPreflight', () => {
  it('passes with the default registry', () => {
    const result = runPreflight();
    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });
});
```

- [ ] **Step 4: Correr tests de core**

```powershell
pnpm --filter @lexia/core test
```

Expected: todos PASS incluyendo el nuevo test de preflight.

- [ ] **Step 5: Crear `apps/api/src/routes/deepHealth.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { runPreflight } from '@lexia/core/vertical';

export const deepHealthRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/health/deep', async (_request, reply) => {
    const preflight = runPreflight();

    const status = preflight.ok ? 'ok' : 'degraded';
    const code = preflight.ok ? 200 : 503;

    return reply.status(code).send({
      status,
      service: 'lexia-api',
      preflight,
      checkedAt: new Date(),
    });
  });
};
```

- [ ] **Step 6: Escribir failing test**

Crear `apps/api/tests/deepHealth.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('GET /api/health/deep', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with preflight ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health/deep' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
    expect(response.json().preflight.ok).toBe(true);
  });
});
```

- [ ] **Step 7: Registrar deepHealthRoute en `apps/api/src/server.ts`**

```ts
import { deepHealthRoute } from './routes/deepHealth.js';
// ...
await app.register(deepHealthRoute);
```

- [ ] **Step 8: Correr tests API**

```powershell
pnpm --filter @lexia/api test
```

Expected: todos PASS.

- [ ] **Step 9: Actualizar `.github/workflows/ci.yml`**

Añadir el siguiente job después del job `test`:

```yaml
preflight:
  name: Preflight verticals
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: ${{ env.PNPM_VERSION }}
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'pnpm'
    - run: pnpm install --frozen-lockfile
    - name: Run preflight check
      run: node --input-type=module <<'EOF'
        import { runPreflight } from './packages/core/src/vertical/preflight.js';
        const result = runPreflight();
        if (!result.ok) {
        console.error('Preflight FAILED:', JSON.stringify(result.checks, null, 2));
        process.exit(1);
        }
        console.log('Preflight OK:', result.checks.length, 'checks passed');
        EOF
```

- [ ] **Step 10: Commit**

```powershell
git add packages/core apps/api .github
git commit -m "feat(core): add preflight check; feat(api): add /health/deep; ci: add preflight job"
```

---

## Task 12: Web — shadcn/ui + auth client + login + layout

**Files:**

- Modify: `apps/web/package.json`
- Create: `apps/web/.env.local`
- Modify: `apps/web/next.config.mjs`
- Create: `apps/web/lib/auth-client.ts`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/app/(app)/layout.tsx`

**Tiempo estimado:** 2.5h

- [ ] **Step 1: Añadir better-auth a `apps/web/package.json`**

En `dependencies`:

```json
"better-auth": "1.1.7"
```

Run:

```powershell
pnpm install
```

- [ ] **Step 2: Crear `apps/web/.env.local`**

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

- [ ] **Step 3: Actualizar `apps/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Inicializar shadcn/ui**

Run desde `apps/web`:

```powershell
cd apps/web
npx shadcn@latest init --defaults
```

Cuando pregunte "Would you like to use CSS variables?", elegir `yes`. Estilo: `Default`. Color: `Slate`.

Luego instalar los componentes necesarios:

```powershell
npx shadcn@latest add button input card separator scroll-area
```

Volver al root:

```powershell
cd ../..
```

- [ ] **Step 5: Crear `apps/web/lib/auth-client.ts`**

```ts
'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  basePath: '/api/auth',
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

- [ ] **Step 6: Crear `apps/web/app/(auth)/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const result = await signUp.email({ email, password, name });
        if (result.error) {
          setError(result.error.message ?? 'Error al registrarse');
        } else {
          setInfo('Revisá tu email para verificar tu cuenta antes de iniciar sesión.');
        }
      } else {
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message ?? 'Credenciales incorrectas');
        } else {
          router.push('/chat');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === 'signin' ? 'Iniciá sesión' : 'Crear cuenta'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <Input
                placeholder="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Contraseña (mín. 12 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-green-700">{info}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Cargando...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
            </Button>
            <button
              type="button"
              className="text-sm text-gray-500 underline"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin'
                ? '¿No tenés cuenta? Registrate'
                : '¿Ya tenés cuenta? Iniciá sesión'}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 7: Crear `apps/web/app/(app)/layout.tsx`**

```tsx
'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  if (isPending)
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <Link href="/chat" className="font-semibold text-lg">
          Lexia
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut().then(() => router.push('/login'))}
          >
            Salir
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 8: Build smoke**

```powershell
pnpm --filter @lexia/web build
```

Expected: Next compila sin errores de TypeScript.

- [ ] **Step 9: Dev smoke**

```powershell
pnpm --filter @lexia/api dev
# En otra terminal:
pnpm --filter @lexia/web dev
```

Verificar en `http://localhost:3000/login`: debe mostrarse el formulario de login/registro. Intentar registrarse y ver el email en mailhog (`http://localhost:8025`).

- [ ] **Step 10: Commit**

```powershell
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add shadcn/ui, auth client, login page, and app layout"
```

---

## Task 13: Web — chat UI (echo)

**Files:**

- Create: `apps/web/components/Disclaimer.tsx`
- Create: `apps/web/components/chat/MessageList.tsx`
- Create: `apps/web/components/chat/MessageInput.tsx`
- Create: `apps/web/app/(app)/chat/page.tsx`

**Tiempo estimado:** 2h

- [ ] **Step 1: Crear `apps/web/components/Disclaimer.tsx`**

```tsx
export function Disclaimer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
      ℹ️ <strong>Lexia</strong> es un asistente informativo. No sustituye el asesoramiento jurídico
      de un abogado/gestor habilitado. Para casos complejos, consultá un profesional.
    </div>
  );
}
```

- [ ] **Step 2: Crear `apps/web/components/chat/MessageList.tsx`**

```tsx
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="flex flex-col gap-3 max-w-2xl mx-auto">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Hacé tu primera consulta sobre nacionalidad por residencia.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-4 py-2 max-w-[80%] text-sm ${
              msg.role === 'user'
                ? 'self-end bg-blue-600 text-white'
                : 'self-start bg-gray-100 text-gray-800'
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 3: Crear `apps/web/components/chat/MessageInput.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue('');
    await onSend(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Escribí tu consulta..."
        disabled={disabled}
        className="flex-1"
      />
      <Button type="submit" disabled={disabled || !value.trim()}>
        Enviar
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Crear `apps/web/app/(app)/chat/page.tsx`**

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { Disclaimer } from '@/components/Disclaimer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Create conversation on mount
  useEffect(() => {
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nueva consulta' }),
    })
      .then((r) => r.json())
      .then((data: { id: string }) => setConversationId(data.id))
      .catch(console.error);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!conversationId) return;
    setLoading(true);

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content }]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = (await res.json()) as {
        userMessage: Message;
        assistantMessage: Message;
      };

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="px-4 pt-3">
        <Disclaimer />
      </div>
      <MessageList messages={messages} />
      <div ref={bottomRef} />
      <MessageInput onSend={handleSend} disabled={loading || !conversationId} />
    </div>
  );
}
```

- [ ] **Step 5: Dev smoke del chat**

```powershell
pnpm --filter @lexia/api dev
pnpm --filter @lexia/web dev
```

1. Ir a `http://localhost:3000/login`.
2. Crear cuenta (verificar email en `http://localhost:8025` y clicar el enlace).
3. Iniciar sesión → redirección a `/chat`.
4. Enviar un mensaje → debe aparecer el eco "Lexia [eco]: {mensaje}".
5. El disclaimer debe estar visible en todo momento.

- [ ] **Step 6: Build check**

```powershell
pnpm --filter @lexia/web build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/web
git commit -m "feat(web): add chat UI with echo mode and persistent disclaimer"
```

---

## Task 14: Compliance docs

**Files:**

- Create: `docs/legal/privacy_policy.md`
- Create: `docs/legal/terms_of_service.md`
- Create: `docs/legal/aviso_legal.md`
- Create: `docs/compliance/subprocessors.md`
- Create: `docs/compliance/records_of_processing.md`

**Tiempo estimado:** 1.5h

- [ ] **Step 1: Crear `docs/legal/aviso_legal.md`**

```markdown
# Aviso Legal — Lexia

| Campo             | Valor                                                     |
| ----------------- | --------------------------------------------------------- |
| Titular           | Facundo Herrera (Capstone Máster IA Generativa)           |
| Email de contacto | facundhfed@gmail.com                                      |
| Domicilio         | España                                                    |
| Actividad         | Asistente informativo de extranjería (proyecto académico) |
| Marco legal       | LSSI-CE (Ley 34/2002), RGPD (UE 2016/679)                 |

## 1. Condiciones de uso

Lexia es un **asistente informativo** de carácter académico sobre procedimientos de
extranjería en España. Su uso implica la aceptación de estas condiciones.

**Lexia NO es un despacho jurídico** y **NO presta asesoramiento legal**. Toda información
proporcionada tiene carácter meramente informativo y no constituye consejo jurídico.

## 2. Limitación de responsabilidad

El titular no se hace responsable de:

- Decisiones tomadas en base a la información proporcionada por Lexia.
- Errores u omisiones en la información (la normativa de extranjería cambia con frecuencia).
- Daños derivados del uso del servicio.

## 3. Propiedad intelectual

El código fuente es propiedad del titular y está sujeto a la licencia especificada
en el repositorio. Las fuentes citadas en las respuestas (BOE, Código Civil, etc.)
son de dominio público o uso permitido.

## 4. Ley aplicable

Este aviso legal se rige por la legislación española. Para cualquier controversia,
las partes se someten a los juzgados de España.
```

- [ ] **Step 2: Crear `docs/legal/privacy_policy.md`**

```markdown
# Política de Privacidad — Lexia

**Versión:** 0.1.0  
**Fecha:** 2026-05-14  
**Estado:** Draft (revisión obligatoria antes de deploy en producción)

## 1. Responsable del tratamiento

Facundo Herrera — facundhfed@gmail.com (Capstone académico, no empresa registrada).

## 2. Datos que recopilamos

| Categoría          | Datos                                               | Finalidad                 | Base legal (RGPD)                    |
| ------------------ | --------------------------------------------------- | ------------------------- | ------------------------------------ |
| Cuenta             | Email, nombre, contraseña (hash)                    | Autenticación             | Art. 6(1)(b) — ejecución de contrato |
| Caso               | País de origen, fecha llegada, situación residencia | Personalización asistente | Art. 6(1)(b)                         |
| Conversaciones     | Mensajes de texto                                   | Prestación del servicio   | Art. 6(1)(b)                         |
| Documentos         | Archivos PDF/DOCX subidos                           | Indexación para RAG       | Art. 6(1)(b)                         |
| Registros técnicos | IP (hasheada), user-agent                           | Seguridad y auditoría     | Art. 6(1)(f) — interés legítimo      |

**Datos de categoría especial (Art. 9 RGPD):** Lexia puede recibir información sobre
situaciones de vulnerabilidad. Se aplica minimización: no se persiste el contenido
plano cuando los guardrails de input detectan datos especiales.

## 3. Subprocesadores

Ver `docs/compliance/subprocessors.md` para la lista completa.

Los modelos de lenguaje (Anthropic Claude, OpenAI) procesan los mensajes del usuario.
Las transferencias internacionales están cubiertas por las SCCs de cada proveedor.

## 4. Derechos del usuario

Bajo el RGPD tenés derecho a:

- **Acceso** (Art. 17): endpoint `/api/me/export`
- **Supresión** (Art. 17): endpoint `/api/me/account` (DELETE)
- **Portabilidad** (Art. 20): endpoint `/api/me/export`
- **Oposición / Limitación** (Arts. 21-22): contactar a facundhfed@gmail.com

## 5. Retención

- Datos de cuenta y caso: hasta que el usuario elimine su cuenta.
- Audit log: 1 año (en forma parcialmente hasheada).
- Conversaciones: hasta que el usuario las elimine o cierre su cuenta.

## 6. Seguridad

- Contraseñas: hash bcrypt gestionado por Better Auth.
- Datos sensibles en DB: cifrado field-level con pgcrypto (Fase 3).
- Transporte: HTTPS en producción.
- Auditoría: toda acción queda registrada en `audit_log`.

## 7. Cookies

Lexia utiliza una cookie de sesión (`better-auth.session`) estrictamente necesaria
para la autenticación. No utiliza cookies de seguimiento ni publicidad.

## 8. Menores

Lexia no está dirigido a menores de 18 años. Si tenés menos de 18, no uses el servicio.

## 9. Cambios en esta política

Se notificará por email ante cambios materiales. La fecha de versión se actualiza en
cada revisión.

## 10. Contacto DPO

No se requiere DPO según el Art. 37 RGPD (procesamiento no a gran escala). Para
consultas de privacidad: facundhfed@gmail.com.
```

- [ ] **Step 3: Crear `docs/legal/terms_of_service.md`**

```markdown
# Términos de Servicio — Lexia

**Versión:** 0.1.0  
**Fecha:** 2026-05-14  
**Estado:** Draft

## 1. Aceptación

Al registrarte y usar Lexia aceptás estos términos. Si no estás de acuerdo, no uses el servicio.

## 2. Descripción del servicio

Lexia es un asistente informativo sobre extranjería en España (proyecto académico).
Proporciona información basada en fuentes oficiales (BOE, Código Civil, instrucciones DGRN).
**No sustituye asesoramiento jurídico profesional.**

## 3. Uso permitido

Podés usar Lexia para:

- Informarte sobre procedimientos de extranjería.
- Simular el examen CCSE.
- Consultar requisitos y plazos documentales.

Queda prohibido:

- Usar el servicio para actividades ilegales.
- Intentar eludir los controles de seguridad (prompt injection, jailbreak).
- Usar el servicio de forma automatizada o masiva sin consentimiento escrito.

## 4. Cuentas

Sos responsable de mantener la seguridad de tu cuenta. Usá una contraseña fuerte
y verificá tu email. Notificá inmediatamente cualquier acceso no autorizado.

## 5. Limitación de responsabilidad

Lexia es un proyecto académico sin garantías de disponibilidad o exactitud.
El titular no se responsabiliza por daños derivados del uso de la información proporcionada.

## 6. Terminación

El titular puede suspender o eliminar cuentas que violen estos términos sin previo aviso.
Podés eliminar tu cuenta en cualquier momento desde la configuración.

## 7. Modificaciones

El titular puede modificar estos términos. Los cambios materiales se notificarán por email
con al menos 7 días de antelación.

## 8. Ley aplicable

Estos términos se rigen por la legislación española. Jurisdicción: España.
```

- [ ] **Step 4: Crear `docs/compliance/subprocessors.md`**

```markdown
# Subprocesadores — Lexia

**Versión:** 0.1.0  
**Fecha:** 2026-05-14  
**Estado:** Draft — pendiente validación de SCCs antes de deploy en producción

## Lista de subprocesadores

| Subprocesador           | País / Región         | Finalidad                                   | Transferencia internacional | SCC / Mecanismo                                     |
| ----------------------- | --------------------- | ------------------------------------------- | --------------------------- | --------------------------------------------------- |
| **Anthropic, PBC**      | EE.UU.                | LLM primario (Claude Sonnet 4.6, Haiku 4.5) | Sí — EE.UU. → UE            | SCCs vigentes (Anthropic Data Processing Agreement) |
| **OpenAI, LLC**         | EE.UU.                | LLM fallback + embeddings                   | Sí — EE.UU. → UE            | SCCs vigentes (OpenAI Data Processing Agreement)    |
| **Hetzner Online GmbH** | Alemania (EU)         | Hosting VPS (Fase 8)                        | No (EU-only)                | RGPD Art. 3 — sede en UE                            |
| **Backblaze, Inc.**     | EE.UU. (región EU B2) | Backups (Fase 8)                            | Sí (si región EU)           | SCCs / EU region clause                             |
| **Resend / Postmark**   | TBD — decidir en F1   | Email transaccional                         | Posible                     | Verificar DPA del proveedor elegido                 |

## Notas de cumplimiento

1. **Anthropic SCCs**: verificar que el DPA de Anthropic cubre a proyectos académicos
   y que las SCCs actuales (post-Schrems II) están en vigor. URL: anthropic.com/privacy

2. **OpenAI SCCs**: ídem. URL: openai.com/policies/privacy-policy

3. **Email transaccional**: se debe elegir entre Resend y Postmark antes del primer
   deploy con usuarios reales. Priorizar proveedor con sede o región de procesamiento en EU.
   Resend tiene servidores EU; Postmark ofrece región EU.

4. **Subprocesadores de Chroma** (self-hosted en Docker): no aplica — no hay transferencia
   de datos a terceros.

## Pendiente (antes de producción)

- [ ] Firmar / verificar DPA con Anthropic
- [ ] Firmar / verificar DPA con OpenAI
- [ ] Elegir y documentar proveedor de email transaccional
- [ ] Añadir cláusula de subprocesadores a la Privacy Policy publicada
- [ ] Transfer Impact Assessment para Anthropic y OpenAI (ver spec §9.2 Art. 44-49)
```

- [ ] **Step 5: Crear `docs/compliance/records_of_processing.md`**

```markdown
# Registro de Actividades de Tratamiento — Lexia

**Responsable:** Facundo Herrera (facundhfed@gmail.com)  
**Marco legal:** RGPD Art. 30  
**Versión:** 0.1.0  
**Fecha:** 2026-05-14

## Actividades de tratamiento

### 1. Gestión de cuentas de usuario

| Campo                          | Detalle                                                |
| ------------------------------ | ------------------------------------------------------ |
| Finalidad                      | Autenticación y gestión de acceso                      |
| Categorías de datos            | Email, nombre, contraseña (hash), fecha registro       |
| Categorías de afectados        | Usuarios registrados (mayores de 18)                   |
| Destinatarios                  | Anthropic/OpenAI (modelos LLM para procesar consultas) |
| Transferencias internacionales | EE.UU. (Anthropic, OpenAI) — SCCs                      |
| Plazo de supresión             | Hasta eliminación de cuenta                            |
| Medidas técnicas               | Hash bcrypt, HTTPS, sesiones con expiración, audit log |

### 2. Procesamiento de consultas (chat)

| Campo                          | Detalle                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Finalidad                      | Proporcionar asistencia informativa sobre extranjería                                        |
| Categorías de datos            | Texto libre del usuario, historial conversación, datos del caso (país origen, fecha llegada) |
| Posibles categorías especiales | Situación migratoria, potencialmente salud/vulnerabilidad — minimización activa              |
| Categorías de afectados        | Usuarios autenticados                                                                        |
| Destinatarios                  | Anthropic (Claude Sonnet/Haiku) — procesamiento del mensaje                                  |
| Transferencias internacionales | EE.UU. — SCCs                                                                                |
| Plazo de supresión             | Hasta eliminación de cuenta; audit log 1 año                                                 |
| Medidas técnicas               | Guardrails input/output, cifrado field-level (F3), redacción de PII en logs                  |

### 3. Documentos subidos por usuarios

| Campo                   | Detalle                                                     |
| ----------------------- | ----------------------------------------------------------- |
| Finalidad               | Indexación para RAG personalizado del usuario               |
| Categorías de datos     | Archivos PDF/DOCX (pueden contener PII)                     |
| Categorías de afectados | Usuarios autenticados                                       |
| Almacenamiento          | MinIO (self-hosted)                                         |
| Plazo de supresión      | Hasta eliminación del documento o de la cuenta              |
| Medidas técnicas        | Sanitización pre-indexación (F4), ACL por usuario en Chroma |

### 4. Audit log

| Campo               | Detalle                                                        |
| ------------------- | -------------------------------------------------------------- |
| Finalidad           | Seguridad, detección de incidentes, cumplimiento RGPD          |
| Categorías de datos | actor_id (user ID), acción, timestamp, trace_id; IPs hasheadas |
| Plazo de supresión  | 1 año                                                          |
| Medidas técnicas    | Append-only en DB, acceso restringido a admin                  |

## DPIA requerida?

Sí — el tratamiento de datos migratorios y potenciales datos especiales (Art. 9 RGPD)
para una audiencia vulnerable requiere DPIA. Ver `docs/compliance/dpia.md` (creado en F4).
```

- [ ] **Step 6: Commit**

```powershell
git add docs/legal docs/compliance
git commit -m "docs(compliance): add privacy policy, ToS, aviso legal, subprocessors, and records of processing"
```

---

## Task 15: Pre-flight final

**Tiempo estimado:** 30min

- [ ] **Step 1: Lockfile coherente**

```powershell
pnpm install --frozen-lockfile
```

Expected: PASS sin diff.

- [ ] **Step 2: Format check**

```powershell
pnpm format:check
```

Si falla, correr `pnpm format` y commitear el diff.

- [ ] **Step 3: Typecheck recursivo**

```powershell
pnpm typecheck
```

Expected: PASS en todos los paquetes (api, web, mcp, core, db).

- [ ] **Step 4: Tests con Postgres**

```powershell
docker compose -f docker-compose.dev.yml up -d postgres minio
pnpm --filter @lexia/db db:migrate
pnpm test
```

Expected: todos los tests PASS.

- [ ] **Step 5: Audit**

```powershell
pnpm audit --audit-level=high
```

Expected: 0 vulnerabilidades high/critical.

- [ ] **Step 6: Smoke completo dev**

```powershell
docker compose -f docker-compose.dev.yml up -d
pnpm --filter @lexia/api dev
pnpm --filter @lexia/web dev
```

Verificar:

- `http://localhost:4000/health` → `{status: ok}`
- `http://localhost:4000/api/health/deep` → `{status: ok, preflight: {ok: true}}`
- `http://localhost:3000/login` → formulario de login
- Registrar usuario → email en mailhog → verificar → login → chat → enviar mensaje → ver eco

- [ ] **Step 7: Tag**

```powershell
git tag -a fase-1-complete -m "Fase 1 (Foundations) complete — auth hardened, API routes, chat UI, compliance docs"
git log --oneline | Select-Object -First 20
```

---

## Criterios de éxito de Fase 1

Para considerar Fase 1 cerrada, **todos** estos puntos deben cumplirse:

- ✅ Email verification mandatoria (en producción; desactivada en test env).
- ✅ HIBP check rechaza contraseñas pwned en sign-up.
- ✅ Rate limit 5 intentos/15min en sign-in, 10/hora en sign-up.
- ✅ `/api/me`, `/api/cases`, `/api/conversations`, `/api/conversations/:id/messages`, `/api/documents/upload` — todos protegidos con `requireAuth`.
- ✅ Eco puro: POST mensaje → `role=assistant`, `content` contiene "[eco]".
- ✅ Chroma client + MinIO client en `packages/core` con tests unitarios (mocked).
- ✅ `nationalidad_residencia` manifest skeleton válido según `VerticalDefinitionSchema`.
- ✅ `runPreflight()` devuelve `ok: true` con la registry por defecto.
- ✅ `/api/health/deep` devuelve 200 + preflight ok.
- ✅ CI job `preflight` pasa en verde.
- ✅ Web: login, verificación de email, acceso al chat funcionales en dev.
- ✅ Chat UI muestra eco y disclaimer siempre visible.
- ✅ `pnpm typecheck` PASS en todos los paquetes.
- ✅ `pnpm test` PASS — al menos 15 tests en total.
- ✅ Documentos: Privacy Policy, ToS, Aviso Legal, Subprocessors, Records of Processing creados.
- ✅ Tag `fase-1-complete` aplicado.
- ✅ M5 con tutor: demo foundations + chat eco preparada.

---

## Lo que NO se hace en Fase 1 (intencional)

| Ítem                                   | Fase               |
| -------------------------------------- | ------------------ |
| LLM real en chat (reemplazar eco)      | F2                 |
| Ingestion pipeline (BOE, Código Civil) | F2                 |
| NormativaAgent + RAG                   | F2                 |
| Input/Output guardrails                | F2                 |
| Field-level encryption pgcrypto        | F3                 |
| Disclosure "soy IA" (primer mensaje)   | F2                 |
| Per-user budget / throttle de tokens   | F4                 |
| DPIA draft                             | F4                 |
| 2FA / OAuth (Google)                   | F1+ (según tiempo) |
| Verificación de colegiación MCP        | F6                 |

---

## Próximo paso

Cuando todo lo de arriba esté ✅ y M5 con tutor confirmado:

> "Generá el plan de Fase 2 (Single-agent + RAG MVP) usando writing-plans, basado en spec §8.2 Fase 2."
