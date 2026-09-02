# Lexia

Asistente informativo de extranjería. Capstone del Máster de IA Generativa.

> ⚠️ Lexia es un asistente informativo. **No sustituye** asesoramiento jurídico profesional.

## Estado

🟢 **Fase 8 completada** — proyecto capstone completo.

| Fase | Descripción                        | Estado |
| ---- | ---------------------------------- | ------ |
| 0    | Scaffold monorepo                  | ✅     |
| 1    | Foundations (auth, DB, RAG base)   | ✅     |
| 2    | LLM + RAG + guardrails             | ✅     |
| 3    | Multi-agente (LangGraph)           | ✅     |
| 4    | Security hardening + dual-LLM      | ✅     |
| 5    | CCSE simulator + vertical completo | ✅     |
| 6    | MCP server + professional surface  | ✅     |
| 7    | Eval rigurosa + observabilidad     | ✅     |
| 8    | Polish + deploy + defensa          | ✅     |

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
- [AI Act risk classification](./docs/compliance/ai_act_risk_classification.md)
- [Model Card](./docs/MODEL_CARD.md) — AI Act, thresholds de eval, sesgos conocidos
- [DPIA v1.0](./docs/compliance/dpia.md) — evaluación de impacto en protección de datos
- [Runbooks](./docs/runbooks/) — incident response, breach notification, disaster recovery
- [ADRs](./docs/adrs/)
- [Defensa](./docs/defensa.md) — script y checklist de defensa del capstone

## Comandos útiles

```powershell
pnpm dev                            # arranca todos los servicios en paralelo
pnpm typecheck                      # tsc --noEmit en todos los paquetes
pnpm test                           # vitest en todos los paquetes
pnpm --filter @lexia/db db:studio   # Drizzle Studio sobre la DB dev
docker compose -f docker-compose.dev.yml down -v   # destruye volúmenes locales
```
