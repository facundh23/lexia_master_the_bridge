# @lexia/db

Schema de base de datos Lexia (Drizzle ORM + PostgreSQL 16).

## Uso

```typescript
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL!);

// Insertar
await db.insert(schema.conversations).values({ userId, vertical: 'nacionalidad_residencia' });

// Query
const convs = await db.select().from(schema.conversations).where(eq(schema.conversations.userId, userId));
```

## Tablas principales

| Tabla | Descripción |
|---|---|
| `users` | Usuarios (Better Auth + role: user/admin/professional) |
| `conversations` | Conversaciones por usuario |
| `messages` | Mensajes individuales |
| `cases` | Datos del caso del usuario (cifrados parcialmente) |
| `documents` | Documentos subidos (PDF sanitizado) |
| `audit_log` | Log inmutable de acciones (surface: web/mcp) |
| `ccse_attempts` | Intentos de simulacro CCSE |
| `reminders` | Recordatorios programados |
| `personal_access_tokens` | PATs para surface MCP |
| `professional_verifications` | Verificación de colegiación |
| `eval_runs` | Resultados del pipeline de eval |

## Migraciones

```powershell
# Aplicar migraciones pendientes
pnpm --filter @lexia/db db:migrate

# Generar nueva migración tras cambio de schema
pnpm --filter @lexia/db db:generate
```

## Variables de entorno

- `DATABASE_URL`: `postgresql://user:pass@host:5432/lexia`
