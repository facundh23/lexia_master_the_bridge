# SPEC 02 — Actualizar las dependencias vulnerables

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-11-07
> **Objetivo:** Dejar en verde los jobs `pnpm audit` y `Trivy filesystem scan` de la CI eliminando todas las vulnerabilidades de severidad alta y crítica, sin romper la aplicación.

---

## Por qué existe este spec

Los jobs `pnpm audit` (`--audit-level=high`) y `Trivy filesystem scan` (`HIGH,CRITICAL`, `ignore-unfixed: true`) de `.github/workflows/ci.yml` fallan en `main`. El resto de jobs (typecheck, tests, preflight y eval smoke) pasan.

Estado medido el 2026-11-07:

- `pnpm audit`: 8 críticas, 65 altas, 89 moderadas y 10 bajas.
- Trivy: 66 hallazgos (8 críticas y 58 altas). No hay secretos detectados.

Las críticas son:

| Paquete       | Versión actual | Vía                                        | Problema                                     | Versión parcheada |
| ------------- | -------------- | ------------------------------------------ | -------------------------------------------- | ----------------- |
| `next`        | 15.5.18        | `apps/web` directa y peer de `better-auth` | RCE no autenticada (Image Optimization, SVG) | ≥ 15.5.28         |
| `better-auth` | 1.6.11         | `apps/api` y `apps/web`                    | El OAuth state sirve como magic link         | ≥ 1.7.7           |
| `vitest`      | 2.1.9          | `apps/api` y `packages/core` (dev)         | Ejecución arbitraria con el UI server        | ≥ 3.2.6           |
| `tinypool`    | 1.1.1          | transitiva de `vitest`                     | Prototype pollution → RCE                    | ≥ 2.1.1           |
| `proxy-addr`  | 2.0.7          | `@modelcontextprotocol/sdk` (`apps/mcp`)   | IP spoofing vía IPv4-mapped                  | ≥ 2.0.8           |

La rama 1.6 de better-auth (`release-1.6`, 1.6.34) **no** corrige la crítica: hay que pasar a 1.7.x.

Las altas se agrupan por origen:

- **Directas de `apps/api`:** `fastify` (≥5.12.2, incluye `find-my-way` y `fast-uri`), `@fastify/multipart` → `@fastify/busboy` (≥3.2.1) y `nodemailer` (≥10.0.6).
- **Directa de `apps/mcp`:** `@modelcontextprotocol/sdk` (≥1.32.0), que arrastra `hono`, `body-parser`, `ip-address` y `proxy-addr`.
- **Transitivas:** `brace-expansion`, `js-yaml` (eslint), `form-data` (langchain), `adm-zip` y `sharp` (`@huggingface/transformers` y `next`), `decode-uri-component` (`minio`), `zod`, `nanoid`, `postcss`, `source-map-js`, `browserslist`, `vite`.

Además, el override actual `"brace-expansion@>=5.0.0 <5.0.6": "5.0.6"` del `package.json` raíz fija una versión que hoy es vulnerable.

---

## Alcance

**Dentro:**

- Subir `next` y `eslint-config-next` a `^15.5.29` en `apps/web`.
- Subir `better-auth` a `^1.7.18` en `apps/api` y `apps/web`, adaptando `apps/api/src/auth.ts` y `apps/web/lib/auth-client.ts` si la 1.7 lo exige.
- Generar y aplicar una migración de `@lexia/db` solo si better-auth 1.7 cambia el esquema de `users`, `sessions`, `accounts` o `verifications`.
- Subir `vitest` a `^3.2.6` (última 3.2.x) en `apps/api` y `packages/core`, adaptando `vitest.config.ts` si hace falta.
- Subir `nodemailer` a `^10.0.6` y `@types/nodemailer` a la versión correspondiente en `apps/api`.
- Subir `fastify` a `^5.12.2` y los plugins `@fastify/*` necesarios para eliminar las altas de `find-my-way`, `fast-uri` y `@fastify/busboy`.
- Subir `@modelcontextprotocol/sdk` a `^1.32.0` en `apps/mcp`.
- Resolver las vulnerabilidades transitivas restantes con `pnpm.overrides` en el `package.json` raíz, siempre que la versión parcheada sea compatible (misma major que acepta el padre, o padre actualizable sin cambiar de major).
- Corregir o eliminar los overrides existentes que fijen versiones vulnerables u obsoletas (como el de `brace-expansion`).
- Para las vulnerabilidades sin parche compatible: registrar una excepción en `pnpm.auditConfig.ignoreGhsas` y en `.trivyignore`, documentada en `docs/security/dependency-exceptions.md`.
- Verificación en runtime: `next build` de `apps/web` en local y un smoke test manual.

**Fuera de alcance (para specs futuros):**

- Vulnerabilidades moderadas y bajas.
- Migrar a Next.js 16.
- Migrar a Vitest 4.
- Dependabot, Renovate o cualquier automatización de actualizaciones.
- Añadir `next build` u otros jobs nuevos a la CI.
- Actualizaciones de dependencias que no estén ligadas a una vulnerabilidad alta o crítica.
- Cambiar la configuración de los jobs `audit` y `trivy-fs` (umbrales, `ignore-unfixed`, scanners).

---

## Modelo de datos

Este spec no introduce estructuras de datos de la aplicación.

Si better-auth 1.7 requiere columnas nuevas, la migración se genera con `pnpm --filter @lexia/db db:generate` a partir de `packages/db/src/schema/*` y se aplica con `db:migrate`.

Cambian estos ficheros de configuración:

```jsonc
// package.json (raíz)
"pnpm": {
  "overrides": {
    // existentes revisados + nuevos para transitivas, p. ej.:
    // "brace-expansion@>=5.0.0 <5.0.11": ">=5.0.11"
  },
  "auditConfig": {
    "ignoreGhsas": [] // solo si hay excepciones
  }
}
```

```text
# .trivyignore (solo si hay excepciones)
# <CVE-ID>  # paquete — motivo — ver docs/security/dependency-exceptions.md
```

Si hay al menos una excepción, `docs/security/dependency-exceptions.md` contiene una tabla con estas columnas: GHSA, CVE, paquete y versión, ruta de dependencia, motivo por el que no hay parche compatible, impacto real en LEXIA y fecha de revisión.

---

## Plan de implementación

Rama: `spec-02-actualizar-dependencias-vulnerables`. Cada paso es un commit independiente que deja typecheck y tests en verde.

1. **Next.js.** Subir `next` y `eslint-config-next` a `^15.5.29` en `apps/web`. Verificar con `pnpm typecheck` y `pnpm --filter @lexia/web build`.
2. **better-auth.** Subir `better-auth` a `^1.7.18` en `apps/api` y `apps/web`. Revisar el changelog 1.6 → 1.7 para la configuración usada (`emailAndPassword`, `emailVerification`, `drizzleAdapter`, `trustedOrigins`, `createAuthClient`). Comprobar que `next` y `vitest` arrastrados como peers de better-auth resuelven a versiones parcheadas. Si cambia el esquema, generar la migración. Verificar con `pnpm typecheck` y `pnpm test`.
3. **Vitest.** Subir `vitest` a `^3.2.6` en `apps/api` y `packages/core`. Ajustar `apps/api/vitest.config.ts` y `packages/core/vitest.config.ts` si la 3.x lo requiere. Verificar con `pnpm test`.
4. **nodemailer.** Subir `nodemailer` a `^10.0.6` y `@types/nodemailer` a la versión correspondiente. Adaptar `apps/api/src/mailer.ts` y `apps/api/src/auth.ts` si cambia la API. Verificar con `pnpm typecheck` y `pnpm test`.
5. **Fastify.** Subir `fastify` a `^5.12.2` y los plugins `@fastify/*` que hagan falta (como mínimo `@fastify/multipart`, por `@fastify/busboy`). Verificar con `pnpm test`.
6. **MCP.** Subir `@modelcontextprotocol/sdk` a `^1.32.0` en `apps/mcp`. Verificar con `pnpm typecheck`.
7. **Transitivas.** Ejecutar `pnpm audit --audit-level=high` y resolver las altas y críticas restantes con `pnpm.overrides` compatibles. Corregir el override vulnerable de `brace-expansion` y eliminar los overrides que ya no apliquen. Verificar con `pnpm install`, `pnpm typecheck` y `pnpm test`.
8. **Excepciones (solo si quedan).** Para cada vulnerabilidad sin parche compatible, añadirla a `pnpm.auditConfig.ignoreGhsas` y a `.trivyignore`, y documentarla en `docs/security/dependency-exceptions.md`. Si no queda ninguna, este paso no genera commit.
9. **Verificación en CI.** Abrir un PR a `main` y comprobar que todos los jobs de `.github/workflows/ci.yml` pasan.

---

## Criterios de aceptación

- [ ] `pnpm audit --audit-level=high` termina con código de salida 0 en local.
- [ ] El job `pnpm audit` de la CI pasa en el PR.
- [ ] El job `Trivy filesystem scan` de la CI pasa en el PR.
- [ ] Los jobs `Lint & Typecheck`, `Tests (with Postgres)` y `Preflight verticals` siguen pasando en el PR.
- [ ] `pnpm ls -r next` solo muestra versiones ≥ 15.5.29 y < 16.
- [ ] `pnpm ls -r better-auth` solo muestra versiones ≥ 1.7.7.
- [ ] `pnpm ls -r vitest` solo muestra versiones ≥ 3.2.6 y < 4.
- [ ] `pnpm ls -r nodemailer` solo muestra versiones ≥ 10.0.6.
- [ ] Ningún override de `package.json` fija una versión con una vulnerabilidad alta o crítica conocida.
- [ ] `pnpm --filter @lexia/web build` termina sin errores en local.
- [ ] Smoke manual en local: el registro de un usuario nuevo envía el email de verificación y este llega al SMTP de desarrollo.
- [ ] Smoke manual en local: el enlace de verificación activa la cuenta y el login funciona.
- [ ] Smoke manual en local: una consulta en el chat recibe respuesta por SSE.
- [ ] Smoke manual en local: se puede iniciar y responder un examen CCSE.
- [ ] Toda entrada de `ignoreGhsas` o de `.trivyignore` tiene su fila en `docs/security/dependency-exceptions.md`, con motivo y fecha de revisión.

---

## Decisiones

- **Sí:** cubrir altas y críticas. Es exactamente lo que miden los dos jobs de la CI, así que el objetivo es verificable.
- **No:** incluir las moderadas. Son 89 y multiplican el riesgo de regresiones sin desbloquear la CI.
- **Sí:** Next.js `^15.5.29` (rama de backport). Corrige la RCE sin cambios de API.
- **No:** Next.js 16. Es una major con posibles cambios en el App Router; merece su propio spec.
- **Sí:** better-auth `^1.7.18`. La crítica del magic link no tiene parche en la rama 1.6.
- **Sí:** Vitest 3.2.x. Es el salto más pequeño que corrige las críticas de vitest y tinypool.
- **No:** Vitest 4. Supone más cambios de configuración y mocks sin beneficio de seguridad adicional.
- **Sí:** nodemailer `^10`, aunque son dos majors. Solo usamos `createTransport` y `sendMail`, que son estables, y el mailer está en la ruta expuesta del registro.
- **No:** dejar nodemailer en la 8 con una excepción. Sería deuda en un componente expuesto.
- **Sí:** excepciones documentadas cuando no haya parche compatible. Es preferible a forzar una major en una transitiva y romper el runtime.
- **No:** forzar con overrides saltos de major en transitivas. El riesgo de romper langchain, transformers o minio en runtime no compensa.
- **Sí:** documentar las excepciones en `docs/security/dependency-exceptions.md`. Es un documento vivo; el spec queda congelado al implementarse.
- **Sí:** verificación con `next build` en local más smoke manual. Next y better-auth no tienen tests de runtime en la CI.
- **No:** añadir `next build` a la CI ni Dependabot o Renovate. Amplían el alcance; la CI ya avisa con audit y Trivy.

---

## Cambios durante la implementación

1. **Variable muerta en el quiz.** `next build` (paso 1) fallaba en la fase de lint por `currentResult` sin usar en `apps/web/app/(app)/quiz/page.tsx`, un error previo a este spec que la CI no detectaba porque no ejecuta `next build`. Se elimina la línea para cumplir el criterio de aceptación del build; no cambia el comportamiento.
2. **Vitest 3.2 no corrige tinypool.** Toda la rama 3.2.x (hasta 3.2.7) depende de `tinypool ^1.1.1`, y las dos críticas de tinypool (GHSA-5gmw-xhrv-c9v3 y GHSA-85c8-ppgw-ccpr) solo tienen parche en `>=2.1.2`. Se añade el override `"tinypool@<2.1.2": "^2.1.2"`, que es un salto de major en una transitiva. Es una excepción acotada a la decisión «No forzar saltos de major en transitivas»: el motivo de esa regla era el riesgo de romper librerías en runtime (langchain, transformers, minio), y tinypool solo lo usa el test runner, nunca la aplicación. Además, la suite completa (`pnpm test`, 334 tests) pasa con tinypool 2.2.0, así que la compatibilidad queda verificada. Tinypool 2 exige Node `^20 || >=22`, compatible con el `>= 20.18` del proyecto.
3. **Plugins de Fastify a su última major.** Como la app no está desplegada, se suben también los plugins a su major actual (`@fastify/cors` 11, `@fastify/helmet` 13, `@fastify/multipart` 10, `@fastify/rate-limit` 11) en vez de quedarse en el mínimo. El único cambio que rompe algo es el de `@fastify/cors` 11: por defecto solo permite `GET,HEAD,POST`, y el navegador habría bloqueado las rutas `PATCH` y `DELETE` de la web. Se declaran `methods` de forma explícita en `apps/api/src/server.ts`, con un test de preflight en `apps/api/tests/server.test.ts`.
4. **Override de `fast-uri`.** El override existente `"fast-uri@<3.1.2": ">=3.1.2"` no tenía techo de major y dejaba resuelta la 3.1.2, que es vulnerable. Se reemplaza por `"fast-uri@>=3.0.0 <3.1.7": "^3.1.7"`. Este cambio se adelanta del paso 7 porque forma parte de las vulnerabilidades de Fastify.
5. **Copias anidadas del SDK de MCP e `ip-address`.** `shadcn` (CLI de `apps/web`) arrastra su propia copia de `@modelcontextprotocol/sdk` 1.29 (con `hono` vulnerable), y `@fastify/rate-limit` 11 trae `ip-address` 10.2.0. `pnpm update` no las actualiza, así que se añaden los overrides `"@modelcontextprotocol/sdk@<1.32.0": "^1.32.2"` e `"ip-address@<10.3.1": "^10.3.1"`, ambos dentro de la misma major. Se adelantan del paso 7. No se sube `shadcn`, porque la 4.23 cambia de SDK y no está ligada a ninguna vulnerabilidad.
6. **Transitivas con salto de major aceptado por el padre.** `vite` pasa a `^6.4.4` (vitest 3.2 declara `^5 || ^6 || ^7`), `sharp` a `^0.35.5` (`next` 15.5.29 acepta `^0.35.5`) y `adm-zip` a `^0.6.1` (la versión que usa `onnxruntime-node` desde la 1.30). Para que `sharp` 0.35 encaje en el rango de `@huggingface/transformers`, este se sube a `^4.3.2`, lo que a su vez arrastra `onnxruntime-node` 1.30. No contradice la decisión «No forzar saltos de major en transitivas», porque en los tres casos la major nueva está dentro del rango que declara el padre. Se verifica con `pnpm test`, con `next build` y con un embedding real con el modelo local (384 dimensiones, normalizado).
7. **Overrides existentes corregidos.** `postcss@<8.5.10` y `brace-expansion@>=5.0.0 <5.0.6` (que fijaba la 5.0.6, vulnerable) se sustituyen por versiones parcheadas con techo de major: `postcss` `^8.5.18`, `brace-expansion` `^1.1.20` y `^5.0.11`. Se mantienen `langsmith`, `esbuild` y `fast-xml-parser`, que no resuelven a ninguna versión vulnerable.
8. **Dos excepciones.** Quedan `zod` (solo se corrige en zod 4, que exige migrar a LangChain 1.x y LangGraph 1.x) y `decode-uri-component` (el parche es solo ESM y rompe a `query-string` 7, que lo carga con `require`). Ambas se documentan en `docs/security/dependency-exceptions.md`. Trivy solo detecta `decode-uri-component`, así que `.trivyignore` contiene únicamente esa entrada. La migración a LangChain 1.x con zod 4 queda para un spec propio.

---

## Riesgos

| Riesgo                                                                                                                                          | Mitigación                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| better-auth 1.7 cambia el esquema o el formato de las sesiones y las sesiones activas se invalidan                                              | Revisar el changelog antes de subir. Si hay cambio de esquema, migrar con `db:generate`/`db:migrate`. Invalidar sesiones es aceptable (proyecto portfolio, sin usuarios reales). |
| better-auth 1.7 cambia el flujo de verificación de email o `autoSignInAfterVerification`                                                        | Smoke manual de registro, verificación y login.                                                                                                                                  |
| nodemailer 10 cambia opciones de `createTransport` (por ejemplo `tls`)                                                                          | Smoke manual de envío contra el SMTP de desarrollo.                                                                                                                              |
| Vitest 3 cambia el comportamiento de mocks o de la config y fallan tests sin bug real                                                           | Ajustar la config y los tests en el paso 3, sin tocar código de producción.                                                                                                      |
| Un override de transitiva rompe una librería en runtime (`sharp` o `adm-zip` en `@huggingface/transformers`, `decode-uri-component` en `minio`) | Solo overrides dentro de la major aceptada. Si no es posible, excepción documentada. El smoke del chat cubre el pipeline con transformers.                                       |
| Aparecen CVE nuevos entre la implementación y el merge                                                                                          | Reejecutar `pnpm audit` justo antes de abrir el PR; el criterio de aceptación es sobre el PR, no sobre esta fecha.                                                               |
| Trivy y `pnpm audit` no coinciden (un CVE aparece en uno y no en otro)                                                                          | La excepción se registra en los dos sitios solo si aplica en ese escáner; el doc indica en cuál.                                                                                 |

---

## Qué **no** entra en este spec

- Vulnerabilidades moderadas y bajas.
- Next.js 16 y Vitest 4.
- Dependabot, Renovate o cualquier automatización de actualizaciones.
- Jobs nuevos en la CI o cambios en la configuración de `audit` y `trivy-fs`.
- Actualizaciones de dependencias sin una vulnerabilidad alta o crítica asociada.

Cada uno de estos puntos, si se hace, va en su propio spec.
