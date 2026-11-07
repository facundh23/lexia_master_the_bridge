# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Lexia: informational assistant for Spanish nationality by residence. pnpm monorepo, TS/ESM (`.js` import extensions), Node ≥ 20.18. Text and specs are in Spanish; identifiers are in English. Setup is described in @README.md.

## Commands

- `pnpm typecheck` and `pnpm format:check`: CI gates. CI does not run eslint.
- `pnpm test`: runs tests in `packages/core` (everything mocked) and `apps/api` (real Postgres via the root `.env`).
- Single test: `cd packages/core && npx vitest run <file> -t "<name>"`.
- Migrations: edit `packages/db/src/schema/*`, then run `pnpm --filter @lexia/db db:generate` and `db:migrate`.
- Full CI pipeline: `.github/workflows/ci.yml`. Eval scripts: `scripts/`.

## Architecture

Full design: `docs/superpowers/specs/2026-05-01-lexia-design.md`. ADRs: `docs/adrs/`.

- **Pipeline**: `packages/core/src/lexiaCore.ts`. Order: budget → crisis → `guardrails/input` → orchestrator → `guardrails/output`.
- **Orchestrator**: `agents/orchestrator/graph.ts`.
  - Triage routes to `normativa`, `eligibility` or `out_of_scope`.
  - Every answer passes through `agents/validator`, with one retry; if that fails, the response is `VALIDATOR_REJECTION_RESPONSE`. Fail-secure: never show unvalidated text.
  - ⚠️ The validator picks its prompt with a ternary, so any new route must be handled there.
- **CCSE** (`agents/ccse`): reachable only through `/api/ccse/*`, not through the chat.
- **NHI**: `logAgentAction` rejects scopes not declared in `nhi/agentIdentities.ts`.
- **SSE**: `apps/api/src/routes/messages.ts`, consumed by `apps/web/app/(app)/chat/page.tsx`. `replace` exists because crisis handling and the output pipeline change the text after the orchestrator.
- **Security and compliance**:
  - Design: `docs/superpowers/specs/2026-08-02-security-compliance-hardening-design.md`.
  - Compliance: `docs/compliance/` (DPIA, AI Act).
  - Eval and thresholds: `docs/MODEL_CARD.md`.

## Workflow

- Specs live in `specs/NN-slug.md` and are implemented on a branch named `spec-NN-slug`, following each spec's plan.
- Write the test first.
