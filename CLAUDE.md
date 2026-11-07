# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Lexia is an informational assistant for Spanish nationality-by-residence (extranjería), built as a pnpm monorepo (TypeScript, Node ≥ 20.18, pnpm 9). User-facing text, specs, docs and most commit messages are in Spanish; code identifiers are in English.

## Commands

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # postgres, chroma, minio, mailhog, langfuse (+ its db)
pnpm --filter @lexia/db db:migrate
pnpm dev                                         # api :4000, web :3000

pnpm typecheck          # tsc --noEmit in every package (CI gate)
pnpm format:check       # prettier (CI gate — CI does NOT run eslint)
pnpm test               # vitest in @lexia/core and @lexia/api

# Single file / single test (run from the package directory)
cd packages/core && npx vitest run tests/agents/orchestrator.test.ts
cd packages/core && npx vitest run -t "eligibility reintenta"

pnpm --filter @lexia/db db:generate              # new migration after editing packages/db/src/schema/*
pnpm eval:smoke                                  # 5-case eval (needs ANTHROPIC_API_KEY + DB)
tsx scripts/ingest-corpus.ts                     # load the RAG corpus into Chroma
```

- `apps/api/tests` hit a **real Postgres** (`DATABASE_URL` from the root `.env`, loaded by `apps/api/vitest.config.ts`); CI also enables the `pgcrypto` and `uuid-ossp` extensions before migrating.
- `packages/core/tests` mock LLMs, LangChain and DB with `vi.mock`, so they need no external services.
- CI (`.github/workflows/ci.yml`) also runs `pnpm audit`, a Trivy scan, the vertical preflight (`runPreflight()` in `packages/core/src/vertical/preflight.ts`) and, when the secret exists, the eval smoke plus `scripts/eval-check-thresholds.ts`.

## Architecture

**Packages.**
- `packages/core` (`@lexia/core`): the AI logic, consumed as TS source with no build step. Its `exports` point at `src/*.ts`.
- `packages/db`: the Drizzle schema and client.
- `apps/api`: the Fastify server plus Better Auth.
- `apps/web`: the Next.js 15 chat.
- `apps/mcp`: an MCP server for verified professionals, authenticated with a PAT.

Imports inside core use explicit `.js` extensions (ESM).

**Request pipeline** (`packages/core/src/lexiaCore.ts`). `runLexiaCore` and `runLexiaCoreStream` run these steps in order:
1. Token budget check (`budget/`).
2. Crisis detection on the raw input.
3. **Input guardrails** (`guardrails/input/`): keyword blocklist, regex PII redaction, GDPR Art. 9 special-category minimizer, LLM jailbreak judge. A block returns a canned response.
4. **Orchestrator**.
5. **Output guardrails** (`guardrails/output/`): citation enforcer, legal-advice detector, PII output redactor, disclaimer injector.
6. Crisis resources prepended if needed, then usage recorded.

Everything is traced to Langfuse (`observability/`), which only receives the post-guardrail sanitized input, never the raw input.

**Orchestrator** (`agents/orchestrator/graph.ts`). `triageQuery` routes each query to `normativa` (RAG over the legal corpus), `eligibility` (residence-years computation plus extended thinking) or `out_of_scope`. Every agent answer then passes through `runValidatorAgent` (`agents/validator/`), a second LLM forming the dual-LLM pattern. If validation fails, the agent gets one retry with `forceRetryWithCitationReminder`; if that also fails, the response becomes `VALIDATOR_REJECTION_RESPONSE`. The system is fail-secure: never surface unvalidated text.

The validator picks its prompt with a binary ternary on the route. Any **new route must be handled there explicitly**, or it silently gets the normativa prompt, which demands legal citations.

**CCSE agent.** `agents/ccse/` is currently reachable only through `/api/ccse/*`, not through the chat orchestrator.

**RAG** (`rag/`). Hybrid retrieval: BM25 sparse plus dense embeddings (local via `@huggingface/transformers` or a provider, per `EMBEDDING_PROVIDER`), fused with RRF, then re-ranked with Cohere. Retrieval goes through `retrieveWithACL`.

**Verticals.** A legal domain is a manifest (`verticals/<name>/manifest.ts`) registered in `vertical/registry.ts` and checked by preflight in CI. Only `nacionalidad_residencia` exists today.

**NHI (agent identities).** Each agent has an identity with declared scopes in `nhi/agentIdentities.ts`. `logAgentAction` (`nhi/auditLogger.ts`) **rejects** undeclared scopes and unknown identities, so new agent actions need their scope declared first.

**Streaming.** `apps/api/src/routes/messages.ts` exposes SSE with `token`, `replace`, `done` and `error` events. `replace` exists because the crisis block and the output pipeline can change the text after the orchestrator. `apps/web/app/(app)/chat/page.tsx` consumes these events.

**Security invariants.**
- Case PII is encrypted at rest. In production it fails closed when `PII_ENCRYPTION_KEY` is missing.
- Persisted chat history is sanitized before it is reused (`guardrails/input/sanitizeHistory.ts`).

## Workflow

Substantial changes follow a spec-first flow:
- Numbered specs live in `specs/NN-slug.md` and are implemented on a branch named `spec-NN-slug`. Each spec has an ordered implementation plan and acceptance criteria.
- Older design specs and plans live in `docs/superpowers/`.
- Work is test-first: write the vitest case, watch it fail, then implement.
