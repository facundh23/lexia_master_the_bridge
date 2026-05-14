# Lexia — Plan de implementación · Fase 0 (Setup)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el chasis del monorepo Lexia (apps/web · apps/api · apps/mcp · packages/core · packages/db) con Docker Compose dev, Drizzle inicial, Better Auth básico, CI con audit/trivy y documentos de compliance esqueleto, dejando la base lista para que Fase 1 (Foundations) construya features encima.

**Architecture:** Monorepo pnpm workspaces. Cuatro servicios en Docker Compose dev (postgres+pgcrypto, chroma, minio, mailhog). API Fastify expone `/health` y rutas Better Auth. Web Next.js 15 sirve landing placeholder. Compliance docs y iBOM esqueleto creados en este momento para poder versionar desde el commit 1.

**Tech Stack:** Node.js 20 LTS · pnpm 9 · TypeScript 5 · Fastify 4 · Next.js 15 (App Router) · Drizzle ORM · Better Auth · Postgres 16 + pgcrypto · Chroma · MinIO · Docker Compose · GitHub Actions · vitest · Caddy (config solo, deploy en F8).

**Spec base:** `docs/superpowers/specs/2026-05-01-lexia-design.md` §8.2 Fase 0.

**Tiempo objetivo:** ~15h sobre semana 1.

---

## Estructura de archivos resultante

```
lexia-capstone/
├── .github/workflows/ci.yml
├── .editorconfig
├── .eslintrc.cjs
├── .gitignore                                # actualizado
├── .prettierrc.json
├── .nvmrc
├── package.json                              # root, scripts y devDeps compartidos
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docker-compose.dev.yml
├── .env.example
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.mjs
│   │   ├── postcss.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── app/layout.tsx
│   │   ├── app/page.tsx
│   │   └── app/globals.css
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/index.ts                      # entrypoint
│   │   ├── src/server.ts                     # buildServer()
│   │   ├── src/auth.ts                       # Better Auth init
│   │   ├── src/routes/health.ts
│   │   └── tests/server.test.ts
│   └── mcp/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/index.ts                      # stub (Fase 6 lo completa)
│       └── README.md                         # marca explícita: stub
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts                      # placeholder export
│   └── db/
│       ├── package.json
│       ├── tsconfig.json
│       ├── drizzle.config.ts
│       ├── src/client.ts
│       ├── src/schema/index.ts
│       ├── src/schema/auth.ts                # users, sessions, accounts, verifications (Better Auth)
│       ├── src/schema/audit.ts               # audit_log
│       └── migrations/                       # generadas, gitignored excepto el .sql
├── docs/
│   ├── compliance/
│   │   └── ai_act_risk_classification.md
│   ├── superpowers/
│   │   ├── specs/2026-05-01-lexia-design.md  # ya existe
│   │   └── plans/2026-05-01-lexia-fase0-setup.md   # este archivo
│   └── adrs/
│       └── 0001-monorepo-pnpm-workspaces.md
├── artifacts/
│   └── lexia.cdx.yaml                        # iBOM esqueleto (firmado en F7)
├── runbooks/.gitkeep                         # se llenan en F8
└── README.md                                 # actualizado con quickstart
```

**Responsabilidades:**

- `packages/db`: única fuente del schema Drizzle. Apps importan `@lexia/db` para hablar con Postgres. No expone HTTP — solo client + schema + migraciones.
- `packages/core`: lógica compartida (orchestrator, RAG, guardrails). Vacío en F0; se llena desde F2.
- `apps/api`: Fastify + Better Auth + rutas. En F0 solo `/health` + auth handler montado.
- `apps/web`: Next.js 15 App Router. En F0 solo landing.
- `apps/mcp`: stub con README explicando que se implementa en F6.
- CI valida lint/typecheck/test/audit/trivy en cada PR. Sin tests significa "build verde sin tests" — no es una opción válida; el smoke test del API server es obligatorio en F0.

---

## Convenciones del plan

- Todos los comandos asumen working dir `C:\Users\facun\Desktop\facu\lexia-capstone` salvo nota explícita.
- Shell por defecto: PowerShell 7. Donde sea relevante uso `pnpm` (cross-platform). Para Docker, los comandos son idénticos en pwsh y bash.
- Cada Task termina en commit. Mensajes en inglés, formato Conventional Commits (`feat:`, `chore:`, `docs:`, `test:`, `ci:`).
- TDD donde hay comportamiento real (Tasks 5, 6). Para scaffolding puro (Tasks 1, 2, 3) no hay test posible — el "test" es que el comando del paso siguiente no falle.

---

## Task 1: Repo scaffolding (monorepo pnpm)

**Files:**

- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `.nvmrc`
- Create: `.editorconfig`
- Modify: `.gitignore`

**Tiempo estimado:** 30 min

- [ ] **Step 1: Verificar Node y pnpm versions**

Run:

```powershell
node --version
pnpm --version
```

Expected: Node `v20.x` o superior, pnpm `9.x` o superior. Si falta pnpm, instalar con `corepack enable; corepack prepare pnpm@9.15.0 --activate`.

- [ ] **Step 2: Crear `.nvmrc`**

Crear archivo `.nvmrc`:

```
20.18.0
```

- [ ] **Step 3: Crear `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 4: Crear `package.json` root**

```json
{
  "name": "lexia",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.18.0"
  },
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\""
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "eslint": "^9.15.0",
    "@typescript-eslint/eslint-plugin": "^8.15.0",
    "@typescript-eslint/parser": "^8.15.0",
    "prettier": "^3.3.3",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 5: Crear `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 6: Crear `.editorconfig`**

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 7: Actualizar `.gitignore`**

Reemplazar el contenido (o crear si no existe) con:

```
# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
.next/
.turbo/
*.tsbuildinfo

# Env files
.env
.env.local
.env.production
.env.*.local
!.env.example

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Test
coverage/
.nyc_output/

# Drizzle
packages/db/drizzle/
!packages/db/migrations/

# Docker volumes (locales)
.docker-data/
```

- [ ] **Step 8: Instalar deps root**

Run:

```powershell
pnpm install
```

Expected: crea `pnpm-lock.yaml`, instala devDeps en `node_modules/`.

- [ ] **Step 9: Commit**

```powershell
git add pnpm-workspace.yaml package.json tsconfig.base.json .nvmrc .editorconfig .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold monorepo with pnpm workspaces"
```

---

## Task 2: Tooling raíz (eslint, prettier)

**Files:**

- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `.eslintrc.cjs`
- Create: `.eslintignore`

**Tiempo estimado:** 30 min

- [ ] **Step 1: Crear `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 2: Crear `.prettierignore`**

```
node_modules
dist
.next
coverage
pnpm-lock.yaml
packages/db/drizzle
artifacts
```

- [ ] **Step 3: Crear `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    '.next',
    'coverage',
    'packages/db/drizzle',
    '**/*.config.{js,mjs,cjs,ts}',
  ],
};
```

- [ ] **Step 4: Crear `.eslintignore`**

```
node_modules
dist
.next
coverage
packages/db/drizzle
artifacts
```

- [ ] **Step 5: Verificar formatter sobre archivos existentes**

Run:

```powershell
pnpm format:check
```

Expected: PASS (puede que se queje del README existente — si pasa, correr `pnpm format` y volver a verificar).

- [ ] **Step 6: Commit**

```powershell
git add .prettierrc.json .prettierignore .eslintrc.cjs .eslintignore
git commit -m "chore: add prettier and eslint configuration"
```

---

## Task 3: docker-compose.dev.yml (postgres, chroma, minio, mailhog)

**Files:**

- Create: `docker-compose.dev.yml`
- Create: `.env.example`
- Create: `infra/postgres/init.sql`

**Tiempo estimado:** 1.5h

**Justificación de servicios en F0:**

- Postgres (con pgcrypto): necesario para Drizzle + Better Auth en Tasks 4-6.
- Chroma: incluido aunque F0 no lo usa, así Fase 2 lo encuentra ya levantando.
- MinIO: ídem, F1 lo usa para uploads.
- Mailhog: SMTP local para que Better Auth pueda mandar verification email desde Fase 1 sin mocks.
- Langfuse: NO en F0 (lo monto en F7 cuando lo uso de verdad — añadir un servicio que no se observa por 6 meses es ruido).

- [ ] **Step 1: Crear `infra/postgres/init.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

- [ ] **Step 2: Crear `.env.example`**

```bash
# === Database ===
DATABASE_URL=postgresql://lexia:lexia_dev_password@localhost:5432/lexia
POSTGRES_USER=lexia
POSTGRES_PASSWORD=lexia_dev_password
POSTGRES_DB=lexia

# === Chroma ===
CHROMA_URL=http://localhost:8000

# === MinIO ===
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=lexia_dev_access
MINIO_SECRET_KEY=lexia_dev_secret_change_me
MINIO_BUCKET=lexia-uploads

# === SMTP (mailhog dev) ===
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@lexia.local

# === API ===
API_PORT=4000
API_HOST=0.0.0.0
NODE_ENV=development

# === Better Auth ===
BETTER_AUTH_SECRET=replace_me_with_64_random_chars_in_real_envs_only
BETTER_AUTH_URL=http://localhost:4000

# === Field-level encryption (Fase 3 lo usa de verdad) ===
PII_ENCRYPTION_KEY=replace_me_with_pgcrypto_compatible_key

# === LLM providers (Fase 2+) ===
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

- [ ] **Step 3: Crear `docker-compose.dev.yml`**

```yaml
name: lexia-dev

services:
  postgres:
    image: postgres:16-alpine
    container_name: lexia-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-lexia}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-lexia_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-lexia}
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-lexia}']
      interval: 5s
      timeout: 5s
      retries: 10

  chroma:
    image: chromadb/chroma:0.5.20
    container_name: lexia-chroma
    restart: unless-stopped
    ports:
      - '8000:8000'
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      ANONYMIZED_TELEMETRY: 'false'
      ALLOW_RESET: 'true'

  minio:
    image: minio/minio:RELEASE.2024-11-07T00-52-20Z
    container_name: lexia-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-lexia_dev_access}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-lexia_dev_secret_change_me}
    ports:
      - '9000:9000'
      - '9001:9001'
    volumes:
      - minio_data:/data
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 10s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog:v1.0.1
    container_name: lexia-mailhog
    restart: unless-stopped
    ports:
      - '1025:1025'
      - '8025:8025'

volumes:
  postgres_data:
  chroma_data:
  minio_data:
```

- [ ] **Step 4: Levantar el stack y verificar**

Run:

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.dev.yml up -d
```

Expected: 4 contenedores `Up`. Verificar con `docker compose -f docker-compose.dev.yml ps`.

- [ ] **Step 5: Smoke check de cada servicio**

Run en pwsh:

```powershell
# Postgres
docker exec lexia-postgres pg_isready -U lexia
# Chroma
Invoke-RestMethod http://localhost:8000/api/v2/heartbeat
# MinIO
Invoke-WebRequest http://localhost:9000/minio/health/live -UseBasicParsing | Select-Object -ExpandProperty StatusCode
# Mailhog
Invoke-WebRequest http://localhost:8025 -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected: postgres `accepting connections`, chroma JSON con timestamp, MinIO `200`, Mailhog `200`.

- [ ] **Step 6: Verificar pgcrypto cargado**

Run:

```powershell
docker exec lexia-postgres psql -U lexia -d lexia -c "SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';"
```

Expected: una fila con `pgcrypto`.

- [ ] **Step 7: Commit**

```powershell
git add docker-compose.dev.yml .env.example infra/postgres/init.sql
git commit -m "chore: add docker compose dev stack (postgres, chroma, minio, mailhog)"
```

---

## Task 4: packages/db con Drizzle (schema inicial)

**Files:**

- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/schema/auth.ts`
- Create: `packages/db/src/schema/audit.ts`
- Create: `packages/db/migrations/.gitkeep`

**Tiempo estimado:** 2h

**Decisión de scope:** F0 declara solo schemas que F1 va a usar inmediatamente: tablas Better Auth (users/sessions/accounts/verifications) + audit*log. Las tablas de dominio (cases, conversations, messages, ccse*\*) las añade Fase 1+ cuando hay código que las consume. YAGNI.

- [ ] **Step 1: Crear `packages/db/package.json`**

```json
{
  "name": "@lexia/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./client": "./src/client.ts"
  },
  "scripts": {
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.4",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.1",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Crear `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear `packages/db/src/schema/auth.ts`**

Schema compatible con Better Auth core (los nombres de columna son los que Better Auth espera por defecto):

```ts
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: Crear `packages/db/src/schema/audit.ts`**

```ts
import { pgTable, text, timestamp, jsonb, uuid, index } from 'drizzle-orm/pg-core';

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    surface: text('surface').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    details: jsonb('details'),
    traceId: text('trace_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorIdx: index('audit_log_actor_idx').on(table.actorType, table.actorId),
    createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
    traceIdIdx: index('audit_log_trace_id_idx').on(table.traceId),
  }),
);
```

- [ ] **Step 5: Crear `packages/db/src/schema/index.ts`**

```ts
export * from './auth';
export * from './audit';
```

- [ ] **Step 6: Crear `packages/db/src/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

export { schema };
```

- [ ] **Step 7: Crear `packages/db/src/index.ts`**

```ts
export * from './client';
export * as schema from './schema';
```

- [ ] **Step 8: Crear `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for drizzle-kit');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 9: Crear `packages/db/migrations/.gitkeep`**

Archivo vacío. Las migraciones generadas se commitean — el `.gitkeep` asegura que el directorio existe antes de la primera generación.

- [ ] **Step 10: Instalar deps del workspace**

Run:

```powershell
pnpm install
```

- [ ] **Step 11: Generar primera migración**

Run desde la raíz, cargando .env:

```powershell
$env:DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').ToString().Split('=', 2)[1]
pnpm --filter @lexia/db db:generate
```

Expected: crea archivos en `packages/db/migrations/0000_*.sql` con `CREATE TABLE` para users, sessions, accounts, verifications, audit_log.

- [ ] **Step 12: Aplicar migración a la DB dev**

Run:

```powershell
pnpm --filter @lexia/db db:migrate
```

Expected: aplica sin error. Verificar con:

```powershell
docker exec lexia-postgres psql -U lexia -d lexia -c "\dt"
```

Expected: lista las 5 tablas + `__drizzle_migrations`.

- [ ] **Step 13: Typecheck del paquete**

Run:

```powershell
pnpm --filter @lexia/db typecheck
```

Expected: PASS sin errores.

- [ ] **Step 14: Commit**

```powershell
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): add drizzle schema for auth and audit log"
```

---

## Task 5: apps/api con Fastify y `/health` (TDD)

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/tests/server.test.ts`

**Tiempo estimado:** 1.5h

- [ ] **Step 1: Crear `apps/api/package.json`**

```json
{
  "name": "@lexia/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@lexia/db": "workspace:*",
    "fastify": "^4.28.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/helmet": "^11.1.1",
    "@fastify/sensible": "^5.6.0"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5",
    "@types/node": "^20.14.0"
  }
}
```

- [ ] **Step 2: Crear `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear `apps/api/vitest.config.ts`**

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

- [ ] **Step 4: Instalar deps**

Run:

```powershell
pnpm install
```

- [ ] **Step 5: Escribir el failing test PRIMERO**

Crear `apps/api/tests/server.test.ts`:

```ts
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'lexia-api',
    });
  });
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run:

```powershell
pnpm --filter @lexia/api test
```

Expected: FAIL con error de import (`server.js` no existe todavía).

- [ ] **Step 7: Implementación mínima — `apps/api/src/server.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { healthRoute } from './routes/health.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);
  await app.register(healthRoute);

  return app;
}
```

- [ ] **Step 8: Implementación mínima — `apps/api/src/routes/health.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'lexia-api',
  }));
};
```

- [ ] **Step 9: Implementación mínima — `apps/api/src/index.ts`**

```ts
import { buildServer } from './server.js';

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';

const app = await buildServer();
await app.listen({ port, host });
app.log.info(`lexia-api listening on http://${host}:${port}`);
```

- [ ] **Step 10: Correr el test y verificar PASS**

Run:

```powershell
pnpm --filter @lexia/api test
```

Expected: 1 test PASS.

- [ ] **Step 11: Smoke en runtime real**

Run en una terminal:

```powershell
pnpm --filter @lexia/api dev
```

En otra:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

Expected: `status: ok, service: lexia-api`. Cerrar el dev server (Ctrl+C).

- [ ] **Step 12: Typecheck**

Run:

```powershell
pnpm --filter @lexia/api typecheck
```

Expected: PASS.

- [ ] **Step 13: Commit**

```powershell
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add fastify server with /health endpoint"
```

---

## Task 6: Better Auth en apps/api (email/password básico)

**Files:**

- Modify: `apps/api/package.json` (añadir better-auth)
- Create: `apps/api/src/auth.ts`
- Modify: `apps/api/src/server.ts` (montar handler)
- Create: `apps/api/tests/auth.test.ts`

**Tiempo estimado:** 2h

**Scope F0:** sign-up + sign-in funcionales con email/password en memoria de Better Auth + DB Drizzle. Sin email verification (eso es Tier 0 pero entra en F1, ver §8.2). Sin OAuth (entra en F1).

- [ ] **Step 1: Añadir deps**

Editar `apps/api/package.json` para añadir en `dependencies`:

```json
"better-auth": "1.1.7"
```

Y en `devDependencies`:

```json
"dotenv": "^16.4.5"
```

Run:

```powershell
pnpm install
```

- [ ] **Step 2: Cargar `.env` en vitest antes de escribir el test**

Reemplazar `apps/api/vitest.config.ts` por:

```ts
import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Verificar que `.env` tiene `BETTER_AUTH_SECRET` con un valor real (≥32 chars). Si está con el placeholder de Task 3, generar uno y reemplazar:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

- [ ] **Step 3: Escribir failing test — sign-up crea user row**

Crear `apps/api/tests/auth.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

describe('Better Auth integration', () => {
  let app: FastifyInstance;
  const db = createDb(TEST_DB_URL);
  const testEmail = `test-${Date.now()}@lexia.local`;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('signs up a new user via /api/auth/sign-up/email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: testEmail,
        password: 'CorrectHorseBatteryStaple9!',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(200);

    const rows = await db.select().from(schema.users).where(eq(schema.users.email, testEmail));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe(testEmail);
  });
});
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run:

```powershell
pnpm --filter @lexia/api test
```

Expected: FAIL — el módulo `./auth.js` no existe todavía o la ruta `/api/auth/sign-up/email` devuelve 404. La causa de fallo debe ser claramente "código no escrito", no "env mal configurado". Si el error apunta a `BETTER_AUTH_SECRET` o `DATABASE_URL` ausentes, volver al Step 2 y arreglar `.env` antes de continuar.

- [ ] **Step 5: Implementar `apps/api/src/auth.ts`**

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb, schema } from '@lexia/db';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error('BETTER_AUTH_SECRET is required');
}

const db = createDb(databaseUrl);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: false, // F1 lo activa
  },
  trustedOrigins: ['http://localhost:3000', 'http://localhost:4000'],
});
```

- [ ] **Step 6: Montar handler en `apps/api/src/server.ts`**

Modificar `buildServer` para añadir, después de los plugins existentes y antes de `healthRoute`:

```ts
import { auth } from './auth.js';

// ...dentro de buildServer, después de sensible y antes de healthRoute:
app.route({
  method: ['GET', 'POST'],
  url: '/api/auth/*',
  async handler(request, reply) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) headers.set(key, value.join(', '));
      else if (value !== undefined) headers.set(key, value);
    }
    const init: RequestInit = {
      method: request.method,
      headers,
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = JSON.stringify(request.body ?? {});
    }
    const webRequest = new Request(url, init);
    const response = await auth.handler(webRequest);
    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(await response.text());
  },
});
```

El archivo completo `apps/api/src/server.ts` queda así:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { healthRoute } from './routes/health.js';
import { auth } from './auth.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) headers.set(key, value.join(', '));
        else if (value !== undefined) headers.set(key, value);
      }
      const init: RequestInit = {
        method: request.method,
        headers,
      };
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = JSON.stringify(request.body ?? {});
      }
      const webRequest = new Request(url, init);
      const response = await auth.handler(webRequest);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(await response.text());
    },
  });

  await app.register(healthRoute);

  return app;
}
```

- [ ] **Step 7: Correr tests y verificar PASS**

Run:

```powershell
pnpm --filter @lexia/api test
```

Expected: 2 tests PASS (health + sign-up).

- [ ] **Step 8: Smoke en runtime**

Run dev server, en otra terminal:

```powershell
$body = @{ email='smoke@lexia.local'; password='LongEnoughPwd123!'; name='Smoke' } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri http://localhost:4000/api/auth/sign-up/email -Body $body -ContentType 'application/json'
```

Expected: respuesta JSON con `user` y `token`.

Verificar:

```powershell
docker exec lexia-postgres psql -U lexia -d lexia -c "SELECT email FROM users;"
```

Expected: aparece `smoke@lexia.local`. (Limpiar después: `DELETE FROM users WHERE email='smoke@lexia.local';`)

- [ ] **Step 9: Typecheck**

Run:

```powershell
pnpm --filter @lexia/api typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): integrate better-auth with email/password and drizzle adapter"
```

---

## Task 7: apps/web — Next.js 15 landing placeholder

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/next-env.d.ts`

**Tiempo estimado:** 1h

- [ ] **Step 1: Crear `apps/web/package.json`**

```json
{
  "name": "@lexia/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.0.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "eslint-config-next": "^15.0.3",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Crear `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Crear `apps/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 4: Crear `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Crear `apps/web/postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Crear `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Crear `apps/web/app/layout.tsx`**

```tsx
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Lexia',
  description: 'Asistente informativo de extranjería',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Crear `apps/web/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-4">
      <h1 className="text-4xl font-bold">Lexia</h1>
      <p className="text-lg text-gray-600">Asistente informativo de extranjería</p>
      <p className="text-sm text-amber-700 max-w-md text-center">
        ⚠️ Lexia es un asistente informativo. No sustituye asesoramiento jurídico profesional.
      </p>
    </main>
  );
}
```

- [ ] **Step 9: Crear `apps/web/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 10: Instalar deps**

Run:

```powershell
pnpm install
```

- [ ] **Step 11: Build smoke**

Run:

```powershell
pnpm --filter @lexia/web build
```

Expected: Next compila sin errores.

- [ ] **Step 12: Dev smoke**

Run:

```powershell
pnpm --filter @lexia/web dev
```

Abrir `http://localhost:3000`, debe verse el título "Lexia" + disclaimer. Ctrl+C para cerrar.

- [ ] **Step 13: Typecheck**

Run:

```powershell
pnpm --filter @lexia/web typecheck
```

Expected: PASS.

- [ ] **Step 14: Commit**

```powershell
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold next.js 15 landing with disclaimer"
```

---

## Task 8: apps/mcp — stub explícito

**Files:**

- Create: `apps/mcp/package.json`
- Create: `apps/mcp/tsconfig.json`
- Create: `apps/mcp/src/index.ts`
- Create: `apps/mcp/README.md`

**Tiempo estimado:** 15 min

**Justificación:** la spec exige que F0 cree `apps/mcp` para reservar el namespace del workspace y dejar explícito que existe en el monorepo. Implementación real es Fase 6.

- [ ] **Step 1: Crear `apps/mcp/package.json`**

```json
{
  "name": "@lexia/mcp",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^20.14.0"
  }
}
```

- [ ] **Step 2: Crear `apps/mcp/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear `apps/mcp/src/index.ts`**

```ts
// Lexia MCP server — STUB.
// Implementación real en Fase 6 (sem 20-23) según
// docs/superpowers/specs/2026-05-01-lexia-design.md §8.2.
//
// En este stub, el binario simplemente reporta su estado y termina.

console.log('lexia-mcp: stub. Implementation scheduled for Fase 6.');
process.exit(0);
```

- [ ] **Step 4: Crear `apps/mcp/README.md`**

```markdown
# @lexia/mcp — STUB

Placeholder package. La implementación del servidor MCP (gestores y abogados con
clientes IA tipo Claude Desktop / Cursor) ocurre en **Fase 6** según la spec en
`docs/superpowers/specs/2026-05-01-lexia-design.md` §8.2.

Hasta entonces este paquete reserva el namespace y el tooling. No tiene rutas,
no tiene auth, no tiene tools — está intencionalmente vacío.
```

- [ ] **Step 5: Instalar deps**

Run:

```powershell
pnpm install
```

- [ ] **Step 6: Typecheck**

Run:

```powershell
pnpm --filter @lexia/mcp typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/mcp pnpm-lock.yaml
git commit -m "chore(mcp): scaffold stub package (real impl in fase 6)"
```

---

## Task 9: packages/core stub

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`

**Tiempo estimado:** 10 min

- [ ] **Step 1: Crear `packages/core/package.json`**

```json
{
  "name": "@lexia/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Crear `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear `packages/core/src/index.ts`**

```ts
// Lexia core — shared building blocks (orchestrator, RAG, guardrails).
// Empty in Fase 0; populated from Fase 2 onwards.
export const LEXIA_CORE_VERSION = '0.0.0';
```

- [ ] **Step 4: Instalar y typecheck**

Run:

```powershell
pnpm install
pnpm --filter @lexia/core typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/core pnpm-lock.yaml
git commit -m "chore(core): scaffold shared package (populated from fase 2)"
```

---

## Task 10: CI scaffolding (.github/workflows/ci.yml)

**Files:**

- Create: `.github/workflows/ci.yml`

**Tiempo estimado:** 1.5h

**Scope F0:** lint, typecheck, test:unit (sin DB), pnpm audit, trivy. El test de Better Auth necesita Postgres — lo monto via service container de GitHub Actions.

- [ ] **Step 1: Crear `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20.18.0'
  PNPM_VERSION: '9.15.0'

jobs:
  lint-and-typecheck:
    name: Lint & Typecheck
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
      - run: pnpm format:check
      - run: pnpm typecheck

  test:
    name: Tests (with Postgres)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: lexia
          POSTGRES_PASSWORD: lexia_ci_password
          POSTGRES_DB: lexia
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://lexia:lexia_ci_password@localhost:5432/lexia
      BETTER_AUTH_SECRET: ci_secret_replace_in_real_envs_with_64_random_chars_xx
      BETTER_AUTH_URL: http://localhost:4000
      NODE_ENV: test
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
      - name: Enable pgcrypto
        run: |
          PGPASSWORD=lexia_ci_password psql -h localhost -U lexia -d lexia \
            -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
      - name: Run migrations
        run: pnpm --filter @lexia/db db:migrate
      - name: Run tests
        run: pnpm test

  audit:
    name: pnpm audit
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
      - run: pnpm audit --audit-level=high

  trivy-fs:
    name: Trivy filesystem scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@0.28.0
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
          exit-code: '1'
          ignore-unfixed: true
```

- [ ] **Step 2: Verificar que el lockfile está commiteado**

Run:

```powershell
git ls-files | Select-String -Pattern 'pnpm-lock.yaml'
```

Expected: una línea con `pnpm-lock.yaml`.

- [ ] **Step 3: Commit**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: add lint/typecheck/test/audit/trivy workflow"
```

- [ ] **Step 4: (Opcional) Verificar CI cuando se push-eee**

Cuando se haga push a main o se abra PR, verificar en la pestaña Actions de GitHub que los 4 jobs pasan en verde. Si fallan, **diagnosticar la causa raíz** (no añadir `continue-on-error`). Errores comunes:

- Lockfile out of date → `pnpm install` local + commit.
- Postgres service no levanta a tiempo → ya tiene healthcheck, esperar; si persiste, subir `health-retries`.
- Trivy bloquea por CVE conocido en deps → evaluar upgrade vs `.trivyignore` con justificación documentada.

---

## Task 11: AI Act risk classification doc

**Files:**

- Create: `docs/compliance/ai_act_risk_classification.md`

**Tiempo estimado:** 45 min

- [ ] **Step 1: Crear el documento**

```markdown
# Lexia — AI Act Risk Classification

| Campo                 | Valor                                                  |
| --------------------- | ------------------------------------------------------ |
| Sistema               | Lexia — Asistente informativo de extranjería           |
| Versión del documento | 0.1.0                                                  |
| Fecha                 | 2026-05-01                                             |
| Estado                | Draft (revisión obligatoria antes de Fase 8 / defensa) |
| Autor                 | Facundo Herrera                                        |

## 1. Clasificación

**Lexia se clasifica como sistema de IA de RIESGO LIMITADO** bajo el AI Act
(Reglamento UE 2024/1689), Article 50 — _Transparency obligations for
providers and deployers of certain AI systems_.

## 2. Justificación de NO ser high-risk (Annex III)

Annex III ítem 7 lista AI systems "intended to be used by competent public
authorities... in the management of migration, asylum and border control".

Lexia **no cae en este supuesto** porque:

- Lexia es un sistema **B2C** dirigido a personas que están en proceso
  migratorio en España — no es operado por autoridades públicas.
- La superficie B2B (servidor MCP) está dirigida a **gestores y abogados
  privados**, no a autoridades públicas.
- Lexia **no toma decisiones administrativas** ni emite actos formales.
  Es estrictamente informativa: explica procedimientos, requisitos y plazos
  con citas a fuentes oficiales.
- Lexia no automatiza concesión, denegación o tramitación de expedientes.

## 3. Roles bajo AI Act

| Rol                         | Quién                                    | Obligaciones aplicables                                                                 |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Provider                    | Lexia (Facundo Herrera, capstone)        | Article 50 transparency · technical documentation · post-market monitoring proporcional |
| Deployer of upstream models | Lexia, al usar Anthropic Claude / OpenAI | No fine-tuning sustancial — no se promueve a Provider de un nuevo modelo                |

## 4. Article 50 — Cumplimiento

| Obligación                                                                              | Implementación en Lexia                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Disclosure clara de que el usuario interactúa con IA                                    | Primer mensaje de cada conversación; onboarding pre-chat; privacy policy              |
| Marca de contenido sintético en outputs (cuando aplica)                                 | Lexia produce solo respuestas conversacionales — no genera media sintética; no aplica |
| Notificación de uso de sistemas de reconocimiento emocional / categorización biométrica | No aplica — Lexia no hace ninguno de los dos                                          |

## 5. Otros frameworks alineados

- **GDPR**: ver `docs/compliance/dpia.md` (creado en Fase 4).
- **LSSI-CE**: aviso legal en `docs/legal/aviso_legal.md` (Fase 1).
- **OWASP LLM Top 10 (2025)**: cobertura técnica en spec §4.
- **OWASP Agentic Top 10 (Dec 2024)**: cobertura técnica en spec §4.4.

## 6. Decisión revisable

Esta clasificación se reabre si en el futuro:

- Lexia comienza a tomar decisiones automatizadas con efecto jurídico.
- Lexia es operado o licenciado a una autoridad pública.
- Lexia añade reconocimiento emocional, biométrico o profiling sustancial.

En tales casos, reconsiderar Annex III y re-clasificar antes del cambio.
```

- [ ] **Step 2: Commit**

```powershell
git add docs/compliance/ai_act_risk_classification.md
git commit -m "docs(compliance): add ai act risk classification (limited risk, art. 50)"
```

---

## Task 12: iBOM esqueleto (CycloneDX)

**Files:**

- Create: `artifacts/lexia.cdx.yaml`

**Tiempo estimado:** 30 min

**Scope F0:** documento esqueleto que enumera componentes principales conocidos hoy. Generación automatizada en CI ocurre en Fase 7.

- [ ] **Step 1: Crear `artifacts/lexia.cdx.yaml`**

```yaml
bomFormat: CycloneDX
specVersion: '1.6'
serialNumber: urn:uuid:00000000-0000-0000-0000-000000000000
version: 1
metadata:
  timestamp: '2026-05-01T00:00:00Z'
  tools:
    - vendor: lexia
      name: manual-skeleton
      version: '0.0.1'
  authors:
    - name: Facundo Herrera
  component:
    type: application
    'bom-ref': lexia@0.0.0
    name: lexia
    version: '0.0.0'
    description: Asistente informativo de extranjería
components:
  # === Models (LLM providers) ===
  - type: machine-learning-model
    'bom-ref': model:claude-sonnet-4-6
    name: claude-sonnet-4-6
    version: '4.6'
    supplier:
      name: Anthropic
    description: Primary LLM for Planner and Specialist agents
    properties:
      - name: lexia:role
        value: primary
      - name: lexia:hosting
        value: external-saas
  - type: machine-learning-model
    'bom-ref': model:claude-haiku-4-5
    name: claude-haiku-4-5
    version: '4.5'
    supplier:
      name: Anthropic
    description: Judge LLM for guardrails and eval
    properties:
      - name: lexia:role
        value: judge
  - type: machine-learning-model
    'bom-ref': model:gpt-fallback
    name: gpt-4o-or-equivalent
    version: tbd
    supplier:
      name: OpenAI
    description: Fallback LLM and embedding model
    properties:
      - name: lexia:role
        value: fallback-and-embeddings

  # === Datasets (corpus) ===
  - type: data
    'bom-ref': data:corpus-nacionalidad-residencia
    name: lexia-corpus-nacionalidad-residencia
    version: 'v1-skeleton'
    description: Corpus público RAG (BOE, Código Civil, instrucciones DGRN, manual CCSE)
    properties:
      - name: lexia:classification
        value: public
      - name: lexia:vertical
        value: nacionalidad_residencia
      - name: lexia:status
        value: skeleton-fase0

  # === Libraries (top-level, populated by CI in Fase 7) ===
  - type: library
    'bom-ref': lib:fastify
    name: fastify
    purl: pkg:npm/fastify@4.28.1
  - type: library
    'bom-ref': lib:next
    name: next
    purl: pkg:npm/next@15.0.3
  - type: library
    'bom-ref': lib:drizzle-orm
    name: drizzle-orm
    purl: pkg:npm/drizzle-orm@0.36.4
  - type: library
    'bom-ref': lib:better-auth
    name: better-auth
    purl: pkg:npm/better-auth@1.1.7

dependencies:
  - ref: lexia@0.0.0
    dependsOn:
      - model:claude-sonnet-4-6
      - model:claude-haiku-4-5
      - model:gpt-fallback
      - data:corpus-nacionalidad-residencia
      - lib:fastify
      - lib:next
      - lib:drizzle-orm
      - lib:better-auth
```

- [ ] **Step 2: Commit**

```powershell
git add artifacts/lexia.cdx.yaml
git commit -m "docs: add ibom skeleton (cyclonedx 1.6, automated in fase 7)"
```

---

## Task 13: ADR 0001 + actualizar README

**Files:**

- Create: `docs/adrs/0001-monorepo-pnpm-workspaces.md`
- Modify: `README.md`
- Create: `runbooks/.gitkeep`

**Tiempo estimado:** 30 min

- [ ] **Step 1: Crear `docs/adrs/0001-monorepo-pnpm-workspaces.md`**

```markdown
# ADR 0001 — Monorepo con pnpm workspaces

- **Status:** Accepted
- **Date:** 2026-05-01
- **Deciders:** Facundo Herrera

## Context

Lexia tiene 3 superficies (web, api, mcp) que comparten un core (orchestrator,
guardrails, RAG, eval). La spec §6.1 define una estructura de directorios con
`apps/*` y `packages/*` y un `core` compartido. Necesitamos un esquema de
workspace que evite duplicación de código y permita refactor seguro.

## Decision

Monorepo con **pnpm workspaces**. Una sola raíz git, tres apps (`apps/web`,
`apps/api`, `apps/mcp`) y dos paquetes (`packages/core`, `packages/db`)
inicialmente. Versionado interno con `workspace:*` en `pnpm-lock.yaml`.

## Consequences

- ✅ Refactor cross-package atómico en un único commit/PR.
- ✅ Tests de integración pueden importar `@lexia/db` y `@lexia/core` sin
  publicar paquetes.
- ✅ Toolchain única (eslint, prettier, tsconfig base) sin duplicación.
- ⚠️ Build pipeline necesita conocer dependencias entre workspaces; mitigado
  con `pnpm -r --filter` en scripts CI.
- ⚠️ Si en el futuro un paquete se publica a npm, hay que extraer su
  toolchain — riesgo bajo a estos efectos.

## Rejected alternatives

- **Multirepo (1 repo por app)**: añade fricción para refactor compartido y
  versioning.
- **npm workspaces**: pnpm es más rápido y maneja mejor el deduping; el
  master-content del programa también lo usa.
- **Turborepo / Nx**: añaden complejidad innecesaria para 5 paquetes y un
  solo desarrollador.
```

- [ ] **Step 2: Crear `runbooks/.gitkeep`**

Archivo vacío, para que `runbooks/` exista en git desde ya. Los runbooks (incident response, breach 72h, disaster recovery) los completa Fase 8.

- [ ] **Step 3: Actualizar `README.md`**

Reemplazar el contenido por:

````markdown
# Lexia

Asistente informativo de extranjería. Capstone del Máster de IA Generativa.

> ⚠️ Lexia es un asistente informativo. **No sustituye** asesoramiento jurídico profesional.

## Estado

🟢 **Fase 0 completada** — chasis del monorepo levantado.
🟡 **Fase 1 (Foundations)** — siguiente.

## Quickstart (dev)

Requisitos: Node 20+, pnpm 9+, Docker Desktop.

```powershell
# 1. Clonar y configurar env
Copy-Item .env.example .env
# (editar BETTER_AUTH_SECRET y otros si hace falta)

# 2. Instalar deps
pnpm install

# 3. Levantar infra
docker compose -f docker-compose.dev.yml up -d

# 4. Migrar DB
pnpm --filter @lexia/db db:migrate

# 5. Arrancar servicios
pnpm dev
```
````

API en `http://localhost:4000`, web en `http://localhost:3000`.

## Layout

| Path            | Qué                                                  |
| --------------- | ---------------------------------------------------- |
| `apps/web`      | Next.js 15 — chat B2C                                |
| `apps/api`      | Fastify — orchestrator HTTP + Better Auth            |
| `apps/mcp`      | MCP server (stub hasta Fase 6)                       |
| `packages/core` | Orchestrator, RAG, guardrails (poblado desde Fase 2) |
| `packages/db`   | Drizzle schema y client                              |

## Documentación

- [Design specification](./docs/superpowers/specs/2026-05-01-lexia-design.md) — diseño completo del sistema
- [Plan Fase 0 — Setup](./docs/superpowers/plans/2026-05-01-lexia-fase0-setup.md)
- [AI Act risk classification](./docs/compliance/ai_act_risk_classification.md)
- [ADRs](./docs/adrs/)

## Comandos útiles

```powershell
pnpm dev                            # arranca todos los servicios en paralelo
pnpm typecheck                      # tsc --noEmit en todos los paquetes
pnpm test                           # vitest en todos los paquetes
pnpm --filter @lexia/db db:studio   # Drizzle Studio sobre la DB dev
docker compose -f docker-compose.dev.yml down -v   # destruye volúmenes locales
```

````

- [ ] **Step 4: Commit**

```powershell
git add docs/adrs/0001-monorepo-pnpm-workspaces.md runbooks/.gitkeep README.md
git commit -m "docs: add adr-0001 and refresh readme with quickstart"
````

---

## Task 14: Pre-flight final — todo verde + tag F0

**Tiempo estimado:** 30 min

Validación completa del estado de Fase 0 antes de cerrarla.

- [ ] **Step 1: Lockfile coherente**

Run:

```powershell
pnpm install --frozen-lockfile
```

Expected: PASS sin diff. Si pide actualizar el lockfile, hay drift — corregir y commitear.

- [ ] **Step 2: Format check**

Run:

```powershell
pnpm format:check
```

Expected: PASS.

- [ ] **Step 3: Typecheck recursivo**

Run:

```powershell
pnpm typecheck
```

Expected: PASS en los 5 paquetes.

- [ ] **Step 4: Tests**

Levantar Postgres si no está, aplicar migraciones, correr tests:

```powershell
docker compose -f docker-compose.dev.yml up -d postgres
pnpm --filter @lexia/db db:migrate
pnpm test
```

Expected: 2 tests PASS (health + sign-up).

- [ ] **Step 5: Audit + (opcional local) trivy**

Run:

```powershell
pnpm audit --audit-level=high
```

Expected: 0 vulnerabilidades high/critical.

- [ ] **Step 6: Smoke completo dev**

En terminales separadas:

```powershell
pnpm --filter @lexia/api dev
pnpm --filter @lexia/web dev
```

Verificar:

- `http://localhost:4000/health` → JSON `{status: ok}`.
- `http://localhost:3000/` → landing con título "Lexia" y disclaimer.
- Sign-up via curl/Invoke-RestMethod crea fila en `users`.

Cerrar ambos servidores.

- [ ] **Step 7: Tag y push**

Run:

```powershell
git tag -a fase-0-complete -m "Fase 0 (Setup) complete — chassis ready for Fase 1"
git log --oneline | Select-Object -First 15
```

Expected: ver los ~13 commits de Fase 0 listados, el más reciente con el commit del ADR/README.

> Push y tag remoto solo cuando confirmes con el tutor (M1 — Sem 1 según §8.3 de la spec).

- [ ] **Step 8: Comunicación con tutor (M1)**

Antes de pasar a Fase 1, según spec §8.3:

- Compartir spec doc + plan F0 + URL del repo.
- Pedir aprobación.
- **Confirmar deadline real** (R7 en spec §11). Si la respuesta cambia el plazo, abrir issue y considerar matriz de recorte (§8.4).

---

## Criterios de éxito de Fase 0

Para considerar Fase 0 cerrada, **todos** estos puntos deben cumplirse:

- ✅ `pnpm install --frozen-lockfile` PASS sin drift.
- ✅ `pnpm typecheck` PASS en `web`, `api`, `mcp`, `core`, `db`.
- ✅ `pnpm test` PASS — al menos 2 tests (health + sign-up).
- ✅ `docker compose -f docker-compose.dev.yml up -d` levanta los 4 servicios saludables.
- ✅ Migraciones Drizzle aplican limpio: 5 tablas (users, sessions, accounts, verifications, audit_log) + `__drizzle_migrations`.
- ✅ Sign-up via Better Auth crea fila en `users` con email único.
- ✅ Workflow CI definido y los 4 jobs pasan en verde en una PR de prueba o push a main.
- ✅ Documentos creados: AI Act risk classification, iBOM skeleton, ADR 0001, README quickstart.
- ✅ `apps/mcp/README.md` aclara explícitamente que es stub para Fase 6.
- ✅ Tag `fase-0-complete` aplicado.
- ✅ M1 con tutor completado (deadline confirmado, aprobación de spec).

---

## Lo que NO se hace en Fase 0 (intencional)

Para evitar scope creep, estos ítems están explícitamente fuera de F0 y se hacen en fases posteriores. Si alguien los reclama "ahora que tocamos esto, ¿no deberíamos también...?", la respuesta es **no, lo hace la fase X**.

| Ítem                                     | Fase                          |
| ---------------------------------------- | ----------------------------- |
| Email verification mandatoria            | F1                            |
| Password policy + HIBP check + throttle  | F1                            |
| API routes principales (chat, /me, etc.) | F1                            |
| Web chat UI (eco fake)                   | F1                            |
| Privacy Policy + ToS + Aviso Legal       | F1                            |
| Subprocessors.md + análisis SCCs         | F1                            |
| Ingestion pipeline + corpus indexado     | F2                            |
| NormativaAgent y RAG                     | F2                            |
| Guardrails (input/output)                | F2 (básicos) → F4 (completos) |
| Disclaimer injection y citation enforcer | F2                            |
| LangGraph multi-agent                    | F3                            |
| Field-level encryption con pgcrypto      | F3                            |
| Dual-LLM pattern                         | F4                            |
| Crisis detection                         | F4                            |
| Per-user budget                          | F4                            |
| CCSE bank y simulator                    | F5                            |
| MCP server real                          | F6                            |
| Eval con 4 jueces + DeepTeam             | F7                            |
| Langfuse self-host                       | F7                            |
| Deploy a VPS EU                          | F8                            |
| Backups                                  | F8                            |

---

## Riesgos específicos de Fase 0

| ID    | Riesgo                                            | Mitigación                                                                                               |
| ----- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| F0-R1 | Better Auth API cambia entre 1.x.y minor releases | Pin exacto en `package.json` (`"better-auth": "1.1.7"` sin caret)                                        |
| F0-R2 | Drizzle Kit 0.28 cambia formato de migraciones    | Pin exacto; commitear migraciones generadas                                                              |
| F0-R3 | Trivy falla CI por CVE en imagen base             | Si bloqueante, upgrade de imagen primero; si no se puede, `.trivyignore` con justificación firmada en PR |
| F0-R4 | Windows + Docker Desktop performance lenta        | Tolerable; backup plan: WSL2 con compose corriendo en Linux                                              |

---

## Próximo paso después de Fase 0

Cuando todo lo de arriba esté ✅ y M1 con tutor confirmado, pedirle al asistente:

> "Generá el plan de Fase 1 (Foundations) usando writing-plans, basado en spec §8.2 Fase 1."

Eso producirá `docs/superpowers/plans/<fecha>-lexia-fase1-foundations.md`.
