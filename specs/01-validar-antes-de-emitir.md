# SPEC 01 — Validar la respuesta antes de mostrarla en el chat

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-10-25
> **Objetivo:** Que el chat en streaming nunca muestre una respuesta que el validator todavía no aprobó, informando al usuario en todo momento en qué etapa está su consulta.

---i

## Por qué existe este spec

Hoy `runOrchestratorStream` (`packages/core/src/agents/orchestrator/graph.ts`) transmite token a token la respuesta de normativa o eligibility **antes** de pasarla por `runValidatorAgent`.

Si el validator la rechaza, `apps/api/src/routes/messages.ts` detecta que el texto final difiere de lo transmitido y emite un evento SSE `replace`. Entonces `apps/web/app/(app)/chat/page.tsx` sustituye el texto en pantalla.

Resultado: el usuario lee una respuesta legal completa que no pasó la validación (sin citas, con consejo jurídico o con PII) y después la ve reemplazada. Esto contradice la postura fail-secure del sistema y es un mal momento de UX.

Además, eligibility no tiene reintento: un rechazo del validator termina directo en `VALIDATOR_REJECTION_RESPONSE`, mientras que normativa reintenta con un recordatorio de citas.

Validar antes de emitir alarga la espera sin texto. Para que eso no se sienta como un cuelgue, el usuario ve en todo momento en qué etapa está su consulta, y la respuesta validada aparece progresivamente, no de golpe.

---

## Alcance

**Dentro:**

- `runOrchestratorStream` genera la respuesta completa, la valida (con reintento si hace falta) y recién después la emite por `onToken`, **una sola vez**.
- Un callback opcional `onStatus` que informa la etapa actual, propagado de orquestador → `runLexiaCoreStream` → ruta SSE de la API.
- Etapas: `analyzing`, `searching` (normativa), `evaluating` (eligibility), `validating` y `retrying`.
- Un evento SSE nuevo `{ type: 'status', stage }`.
- En la web, el `TypingIndicator` muestra el texto de la etapa actual junto a los puntos animados.
- En la web, la respuesta validada se revela progresivamente en el cliente (efecto de escritura) en lugar de aparecer entera de una vez.
- Eligibility reintenta igual que normativa: un segundo intento con recordatorio de cita legal (`forceRetryWithCitationReminder`) antes de caer en `VALIDATOR_REJECTION_RESPONSE`.
- Eliminar `runNormativaAgentStream` y `runEligibilityAgentStream`, que quedan sin uso.
- Tests unitarios (core) y de integración (ruta SSE de la API).

**Fuera de alcance (para specs futuros):**

- Ruta `ccse` en el orquestador y revisión humana automática (cubiertas por `docs/superpowers/specs/2026-09-26-ccse-chat-and-human-review-design.md`).
- Validación incremental o por fragmentos mientras se genera.
- Etapas más finas dentro del agente (por ejemplo, una por cada llamada a tool).
- Mejorar `VALIDATOR_REJECTION_RESPONSE` para que explique el motivo del rechazo.
- Ampliar el contexto del triage (hoy usa los últimos 2 mensajes).
- Cambios en el bloque de crisis (`CRISIS_RESOURCES_BLOCK`) o en el output pipeline, que siguen modificando la respuesta después del orquestador y siguen usando el evento `replace`.
- Tests automatizados del frontend web.

---

## Modelo de datos

No hay tablas ni persistencia nuevas. Cambian tipos y firmas:

```ts
// packages/core/src/agents/orchestrator/state.ts
export type StreamStatus = 'analyzing' | 'searching' | 'evaluating' | 'validating' | 'retrying';

export interface OrchestratorHooks {
  onStatus?: (status: StreamStatus) => void;
}
```

```ts
// Firmas
runOrchestrator(input: OrchestratorInput, hooks?: OrchestratorHooks): Promise<OrchestratorOutput>;
runOrchestratorStream(
  input: OrchestratorInput,
  onToken: (token: string) => void,
  onStatus?: (status: StreamStatus) => void,
): Promise<OrchestratorOutput>;
runLexiaCoreStream(
  input: LexiaCoreInput,
  onToken: (token: string) => void,
  onStatus?: (status: StreamStatus) => void,
): Promise<LexiaCoreResult>;
```

```ts
// packages/core/src/agents/eligibility/agent.ts
export interface EligibilityAgentInput {
  // ...campos actuales
  forceRetryWithCitationReminder?: boolean;
}
```

```ts
// Evento SSE nuevo (apps/api/src/routes/messages.ts y apps/web/app/(app)/chat/page.tsx)
{
  type: 'status';
  stage: StreamStatus;
}
```

Textos de la web por etapa (`apps/web/app/(app)/chat/page.tsx`):

| `stage`      | Texto                     |
| ------------ | ------------------------- |
| `analyzing`  | Analizando tu pregunta…   |
| `searching`  | Buscando en la normativa… |
| `evaluating` | Evaluando tu caso…        |
| `validating` | Verificando la respuesta… |
| `retrying`   | Ajustando la respuesta…   |

Invariante: en el camino de streaming, el texto emitido por `onToken` desde `runLexiaCoreStream` es exactamente `LexiaCoreResult.response` (ya validado y con output pipeline y bloque de crisis aplicados). Ver _Cambios durante la implementación_.

Secuencia de etapas por ruta:

- normativa / eligibility válida al primer intento: `analyzing` → `searching`|`evaluating` → `validating`.
- con reintento: … → `validating` → `retrying` → `validating`.
- `out_of_scope` o error de triage: solo `analyzing`.

---

## Plan de implementación

1. **Reintento en el agente de eligibility.** Agregar `forceRetryWithCitationReminder` a `EligibilityAgentInput`. Cuando es `true`, `runEligibilityAgent` agrega al mensaje del usuario el mismo recordatorio de cita que usa normativa. Test en `packages/core/tests/agents/eligibility.test.ts`: con el flag, el `HumanMessage` final contiene el recordatorio; sin el flag, no.
2. **Igualar eligibility en `runOrchestrator`.** Si el validator rechaza, reintentar con `forceRetryWithCitationReminder: true` y volver a validar. Si el segundo intento también falla, devolver `VALIDATOR_REJECTION_RESPONSE`. Tests en `packages/core/tests/agents/orchestrator.test.ts`: (a) rechazo y luego reintento válido devuelve el reintento; (b) doble rechazo devuelve el mensaje de rechazo.
3. **`onStatus` en `runOrchestrator`.** Agregar el parámetro `hooks?: OrchestratorHooks` y emitir las etapas según la secuencia del modelo de datos:
   - `analyzing` antes del triage;
   - `searching` o `evaluating` antes de llamar al agente;
   - `validating` antes de cada `runValidatorAgent`;
   - `retrying` antes del reintento.

   Tests que verifican la secuencia exacta para normativa válida, eligibility con reintento y `out_of_scope`.

4. **Reescribir `runOrchestratorStream` como envoltorio.** Llama a `runOrchestrator(input, { onStatus })` y después hace `onToken(result.response)` una sola vez. Esto cubre también `out_of_scope` y el error de triage, que hoy no emiten tokens. Eliminar `runNormativaAgentStream` y `runEligibilityAgentStream`. Tests de stream:
   - camino feliz: `onToken` se llama 1 vez con la respuesta validada, después de `validating`;
   - rechazo seguido de reintento válido: `onToken` recibe solo el reintento y el texto rechazado nunca se emite;
   - doble rechazo: `onToken` recibe solo `VALIDATOR_REJECTION_RESPONSE`;
   - `out_of_scope`: `onToken` recibe `OUT_OF_SCOPE_RESPONSE`;
   - error del triage: `onToken` recibe el mensaje de rechazo.
5. **Propagar `onStatus` en `runLexiaCoreStream`** (`packages/core/src/lexiaCore.ts`) como tercer parámetro opcional que se pasa al orquestador. Exportar el tipo `StreamStatus` desde `@lexia/core`. Test en `packages/core/tests/lexiaCore.test.ts`: el callback recibido llega al orquestador mockeado.
6. **Evento SSE en la API.** En `apps/api/src/routes/messages.ts`, pasar `(stage) => sendEvent({ type: 'status', stage })` como `onStatus`. Test de integración nuevo en `apps/api/tests/messages.stream.test.ts`, con el patrón de `conversations.test.ts` (DB real y `@lexia/core` mockeado):
   - el mock emite varias etapas y después el token: los eventos SSE llegan en el mismo orden (`status`… → `token` → `done`), sin `replace`;
   - el mensaje del asistente persistido es igual al texto emitido;
   - si la respuesta final difiere de lo emitido (caso crisis/output pipeline), sigue llegando `replace` antes de `done`;
   - si el core lanza un error, llega `error`.
7. **Etapas en la web.** En `chat/page.tsx`, agregar el tipo `status` a `SseEvent` y un estado `statusLabel` con los textos de la tabla. `token`, `done` y `error` lo limpian. `MessageList` recibe `statusLabel` y lo pasa a `TypingIndicator`, que lo muestra como texto gris junto a los puntos.
8. **Revelado progresivo en la web.** El contenido del mensaje del asistente se revela a ritmo constante en el cliente: unos pocos caracteres por frame, con todo el texto visible en ≤ 3 segundos sin importar el largo. `replace` y `error` muestran el texto final de inmediato. El `TypingIndicator` sigue visible hasta que termina el revelado. Verificación manual en el navegador.

---

## Criterios de aceptación

- [ ] `pnpm --filter @lexia/core test` pasa, incluidos los tests nuevos de los pasos 1–5.
- [ ] `apps/api/tests/messages.stream.test.ts` existe y pasa con `DATABASE_URL` configurada.
- [ ] Los tests existentes de `apps/api/tests` y `packages/core/tests` siguen pasando.
- [ ] El typecheck del monorepo no reporta errores.
- [ ] Un test verifica que, ante un rechazo del validator en el camino de streaming, el texto rechazado **nunca** se pasa a `onToken`.
- [ ] Un test verifica la secuencia exacta de etapas `analyzing` → `evaluating` → `validating` → `retrying` → `validating` en eligibility con reintento.
- [ ] Un test verifica que eligibility reintenta con `forceRetryWithCitationReminder: true` ante el primer rechazo.
- [ ] `runNormativaAgentStream` y `runEligibilityAgentStream` ya no existen en el código (`grep` sin resultados).
- [ ] En el chat web, durante una consulta de normativa se ven en orden "Analizando tu pregunta…", "Buscando en la normativa…" y "Verificando la respuesta…" junto a los puntos.
- [ ] En el chat web, la respuesta aparece progresivamente (no entera en un frame) y termina de mostrarse en ≤ 3 segundos.
- [ ] En el chat web, nunca aparece un texto que después sea reemplazado por un rechazo del validator.

---

## Decisiones

- **Sí:** generar, validar y recién después emitir (opción a). Nunca se muestra texto sin validar, que es coherente con el fail-secure del validator.
- **No:** mantener el streaming y emitir un `reset` si hay rechazo (opción b). El texto sin validar se seguiría mostrando unos segundos.
- **No:** dejarlo como está y avisar "respuesta corregida" en la UI (opción c). No cierra el problema de cumplimiento.
- **Sí:** varias etapas visibles (`analyzing`, `searching`/`evaluating`, `validating`, `retrying`). El usuario pidió saber en todo momento que su pregunta y su respuesta se están procesando; un solo estado deja largos tramos sin información.
- **No:** etapas por cada llamada a tool dentro del agente. Requiere instrumentar los callbacks de LangGraph y no cambia lo que percibe el usuario.
- **Sí:** el revelado progresivo se hace en el cliente. El servidor emite el texto validado una vez y la web lo anima.
- **No:** trocear el texto en el servidor con demoras artificiales. Alarga la conexión SSE, complica los tests y es un efecto puramente visual.
- **Sí:** tope de ≤ 3 segundos para el revelado. Las respuestas legales pueden ser largas y no se debe hacer esperar al usuario por una animación.
- **Sí:** `runOrchestratorStream` como envoltorio de `runOrchestrator`. Elimina la lógica duplicada entre las dos funciones, que hoy ya divergían (logs, manejo de `out_of_scope`).
- **Sí:** eliminar `runNormativaAgentStream` y `runEligibilityAgentStream`. Quedan sin uso y no se exportan desde `@lexia/core`.
- **Sí:** igualar eligibility a normativa con un único reintento con recordatorio de cita.
- **Sí:** tests de integración sobre la ruta SSE de la API (`@lexia/core` mockeado), porque prueban lo que el cliente realmente recibe. El comportamiento ante rechazo se cubre con los unitarios del orquestador.
- **Sí:** mantener el evento `replace`. Sigue siendo necesario porque el bloque de crisis y el output pipeline modifican la respuesta después del orquestador. _(Revisado durante la implementación: queda solo como red de seguridad, ver abajo.)_

---

## Cambios durante la implementación

La verificación manual en el navegador encontró dos problemas que el plan no anticipaba:

1. **El proxy de Next.js acumulaba el SSE.** En dev, el rewrite `/api/*` comprime con gzip y retenía todos los eventos hasta el final, así que las etapas nunca se veían. Se resolvió con `Cache-Control: no-cache, no-transform` en la ruta SSE (test incluido). En producción no ocurre porque Caddy envía `/api/*` directo a la API.
2. **`replace` anulaba el revelado progresivo.** El output pipeline modifica casi todas las respuestas (por ejemplo, el disclaimer), así que casi siempre llegaba `replace` a los ~100 ms del token y el texto aparecía de golpe. Decisión: `runLexiaCoreStream` llama a `runOrchestrator` y emite `onToken` **una sola vez, después** del output pipeline y del bloque de crisis. `runOrchestratorStream` queda sin uso y se elimina. `replace` se mantiene en la API solo como red de seguridad.

---

## Riesgos

| Riesgo                                                                                                         | Mitigación                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Más tiempo sin ver texto, sobre todo en eligibility (thinking extendido + validator + posible reintento).      | Las etapas visibles dejan claro que el sistema está trabajando. Medir a mano el tiempo de eligibility en la verificación final. |
| Un proxy (nginx/Next.js) corta la conexión SSE por inactividad durante la espera.                              | Los eventos `status` envían datos entre etapas. Si aparece el corte, un heartbeat SSE va en otro spec.                          |
| La etapa `evaluating` puede durar mucho (thinking extendido) sin cambios visibles.                             | Los puntos animados siguen en movimiento. Etapas más finas quedan fuera de alcance.                                             |
| Conflicto con el trabajo de CCSE + revisión humana, que también toca `graph.ts` y el validator.                | Implementar este spec en una rama propia desde `main` y mergearlo antes de retomar (d)+(c), que se rebasa encima.               |
| `messages.stream.test.ts` necesita una Postgres real (`DATABASE_URL`), igual que el resto de `apps/api/tests`. | Seguir el mismo setup que `conversations.test.ts`.                                                                              |

---

## Qué **no** entra en este spec

- Ruta CCSE en el chat y revisión humana automática.
- Validación incremental mientras se genera.
- Etapas por cada llamada a tool.
- Mensaje de rechazo explicativo.
- Más contexto para el triage.
- Tests automatizados del frontend.

Cada uno de esos, si se hace, va en su propio spec.
