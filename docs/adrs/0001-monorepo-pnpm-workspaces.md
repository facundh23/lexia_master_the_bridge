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
