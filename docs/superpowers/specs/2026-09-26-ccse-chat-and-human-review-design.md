# CCSE en el chat + revisión humana automática — diseño

**Fecha:** 2026-09-26
**Origen:** cierre de LEXIA como proyecto de portfolio. Hallazgos de las sesiones 15 (agente CCSE con tools huérfanas) y 16 (`requestHumanReview` desconectado de los guardrails) de la revisión de código. El diseño de alto nivel se acordó en la sesión del 2026-09-19; este spec lo formaliza tras releer el código real.

## Contexto

Dos hilos pendientes, agrupados porque ambos tocan el orquestador (`agents/orchestrator/graph.ts`) y el tipo `Route`:

- **(d) CCSE ↔ chat:** el simulacro CCSE solo existe vía `/api/ccse/*`. El orquestador no lo conoce, así que en la demo "sistema multi-agente" son en realidad dos agentes con LLM + un endpoint aparte.
- **(c) `requestHumanReview` ↔ guardrails:** la derivación a revisión humana solo se dispara si el usuario llama a mano a `/api/me/request-review`. El agente de eligibility emite un `isEligible: false` sin que ninguna persona lo revise (relevante para RGPD Art. 22).

Se implementan en ese orden y en commits separados: (d) primero, (c) después. (b) RAGAS ↔ `preflight` queda fuera, ya declarado como trabajo futuro en `docs/informe_capstone.md`.

### Correcciones al diseño del 2026-09-19 tras releer el código

1. **El validator no es el problema inmediato que parecía.** `graph.ts` llama a `runValidatorAgent` con rutas literales (`'normativa'`, `'eligibility'`), así que el ternario de `validator/index.ts` solo muerde si alguien llama con `'ccse'`. Sigue siendo una trampa latente (cualquier ruta desconocida cae en el prompt de normativa) y se arregla igual, pero la causa es "default implícito", no "rechazo garantizado hoy".
2. **Un intento sin terminar no guarda sus preguntas.** `generateCcseQuiz` inserta en `ccse_attempts` pero **no** en `ccse_attempt_questions`; esas filas recién se escriben en `evaluateCcseAnswers`. Sin cambiar esto, "resolver el intento activo contra la DB" (decisión del 19/09) es imposible: la DB sabe que hay un intento abierto, pero no qué preguntas tiene.
3. **El orquestador no ve `isEligible`.** `runEligibilityAgent` devuelve solo `{ response, citations }` (texto). El resultado estructurado de `computeEligibility` queda enterrado en un `ToolMessage` dentro de `result.messages`, y el trigger de (c) no tiene de dónde leerlo.
4. **`conversationId` no llega al core.** `LexiaCoreInput` no lo tiene, así que una derivación automática quedaría en `human_review_requests` con `conversation_id = NULL`, y quien revise no sabría qué conversación mirar.

## Parte 1 — (d) CCSE en el chat

### 1.1 Persistir las preguntas del intento al generarlo

**Archivos:** `packages/db/src/schema/ccse.ts`, nueva migración, `packages/core/src/agents/ccse/agent.ts`

- Agregar `position integer NOT NULL` a `ccse_attempt_questions` (orden de presentación; los `uuid` no sirven para ordenar).
- `generateCcseQuiz` inserta una fila por pregunta con `selectedOption = NULL`, `isCorrect = NULL`, en la misma transacción que el `ccse_attempts`.
- `evaluateCcseAnswers` pasa de `INSERT` a `UPDATE` sobre esas filas. Solo acepta `questionId` que pertenezcan al intento, sin duplicados, y `maxScore` sale de `ccse_attempts.maxScore`, no de `answers.length`. Hoy el cálculo es `score / answers.length`: mandar 25 veces la misma pregunta fácil con la respuesta correcta da 25/25 "APROBADO". El puntaje puede terminar leyéndolo un tercero (por ejemplo un profesional verificado), así que no es un problema que afecte solo al usuario.
- Mantener compatibilidad con `/api/ccse/*`: el frontend actual sigue funcionando sin cambios.

### 1.2 Nuevas funciones de estado

**Archivo:** `packages/core/src/agents/ccse/agent.ts`

- `getActiveCcseAttempt(userId)`: último intento con `completedAt IS NULL`, con sus preguntas en orden y cuáles ya tienen respuesta.
- `answerCcseQuestion(attemptId, questionId, selectedOption)`: guarda una sola respuesta. Cuando no quedan preguntas pendientes, cierra el intento (`score`, `completedAt`).
- `abandonCcseAttempt(attemptId)`: marca `completedAt` con `score = NULL` (un abandono se distingue de un intento terminado porque no tiene puntaje).

Todas verifican que el intento sea del `userId`, por la misma razón que el chequeo de propiedad de `/api/ccse/attempts/:id/submit`.

### 1.3 `runCcseAgent`

**Archivo nuevo:** `packages/core/src/agents/ccse/chatAgent.ts` (y la variante `Stream`)

Mismo patrón que `runEligibilityAgent`: `createReactAgent` + Haiku + prompt propio. Las tools están atadas al `userId` del request, nunca a un `userId` que proponga el LLM:

| Tool | Qué hace |
|---|---|
| `get_active_ccse_attempt` | Estado del intento abierto (o ninguno) |
| `start_ccse_quiz` | Crea intento nuevo. **Falla** si ya hay uno abierto (ver 1.4) |
| `answer_ccse_question` | Registra una respuesta y devuelve si fue correcta + la siguiente pregunta |
| `abandon_ccse_attempt` | Cierra el intento abierto sin puntaje |

**Dinámica:** una pregunta por mensaje. 25 preguntas juntas en un mensaje de chat son ilegibles y obligan a parsear respuestas como "1a 2c 3b…", con errores silenciosos.

**Corrección de respuestas:** la dice la tool (`correctOption` sale de la DB), no el LLM. El prompt le prohíbe al agente decidir si una respuesta es correcta por su cuenta.

**Explicación fundamentada:** `answer_ccse_question` devuelve también `ccse_questions.source` (el seed lo completa, por ejemplo "Constitución Española, art. 14" o "Manual CCSE, Bloque 1"). El agente muestra la opción correcta y esa fuente. No agrega una explicación libre que no esté respaldada por la fuente, y si `source` es `NULL` muestra solo la respuesta correcta. Así se acota el riesgo de no pasar por el validator (1.6): el contenido factual sale de la DB, no de la memoria del modelo.

Las tools actuales de `ccse/tools.ts` (`createGenerateCcseQuizTool`, `createEvaluateCcseAnswerTool`) se reemplazan por estas. No tienen otros usos.

### 1.4 Concurrencia de intentos (decisión del 19/09)

Si hay un intento abierto y el usuario pide uno nuevo, `start_ccse_quiz` devuelve un error explícito (`ACTIVE_ATTEMPT_EXISTS`, con el progreso). El prompt obliga al agente a preguntarle al usuario si retoma o abandona. Nunca se pisa un intento en silencio.

### 1.5 Triage

**Archivos:** `agents/orchestrator/triage.ts`, `state.ts`

- Agregar `'ccse'` al enum y a `Route`: "el usuario quiere practicar/hacer un simulacro del examen CCSE o está respondiendo una pregunta del simulacro".
- `"¿qué es el CCSE?"` / `"¿cuántas preguntas tiene?"` siguen siendo `normativa`. Se agregan ejemplos al prompt para marcar el límite.
- **Trampa de mitad de simulacro:** si el usuario responde `"b"`, el triage ve un mensaje de una letra y hoy lo mandaría a `out_of_scope`. Se agrega un flag `hasActiveCcseAttempt` a `OrchestratorInput`, consultado antes del triage, que se inyecta en su prompt como contexto. Un mensaje corto con un intento abierto se enruta a `ccse`, pero una pregunta normativa explícita en medio del simulacro sigue yendo a `normativa` (o a `eligibility`).
- El historial no alcanza: si el usuario hace una pregunta de otro tema a mitad del examen y después vuelve con `"b"`, los últimos 2 mensajes ya no hablan del simulacro. Además, que exista un intento abierto es un dato de la DB, y no conviene que un LLM lo infiera.
- **No se saltea el triage con un intento abierto** (descartado). Mandaría las preguntas legales hechas a mitad del examen al agente CCSE, que no tiene RAG ni validator: sería un bypass de los guardrails de contenido.
- El intento abierto no obliga a salir del examen para preguntar otra cosa. Sigue guardado y se retoma después.

### 1.6 Validator: sin default implícito

**Archivo:** `agents/validator/index.ts`

- El ternario pasa a un `switch` exhaustivo sobre `Route`. `ccse` y `out_of_scope` devuelven `skipped`, y una ruta desconocida hace **throw**. Si mañana se agrega una vertical nueva, el compilador y los tests lo marcan en vez de aplicarle en silencio el prompt de normativa.
- El `switch` va **antes** del `try/catch`. Si quedara adentro, el `throw` de una ruta sin configurar lo atraparía el `catch` fail-secure y se vería como un rechazo normal del validator (`validator_error_fail_secure`), escondiendo un bug de configuración. Fuera del `try`, el error se propaga al error handler global de Fastify: el usuario recibe un 500 genérico, sin detalles internos, y el error queda registrado como error, no disfrazado de rechazo.
- **Por qué CCSE no se valida:** sus respuestas no son asesoramiento legal ni citan normativa. El contenido factual (qué opción es correcta) sale del banco de preguntas, no del LLM. El pipeline de salida (PII, disclaimer, detector de consejo legal) sí corre.

### 1.7 Orquestador

**Archivo:** `agents/orchestrator/graph.ts`

Nuevo `case 'ccse'` en `runOrchestrator` y `runOrchestratorStream`, sin validator (ver 1.6).

## Parte 2 — (c) Revisión humana automática en eligibility

### 2.1 Exponer el resultado estructurado

**Archivo:** `agents/eligibility/agent.ts`

`EligibilityAgentResult` suma `eligibility?: EligibilityResult`: el resultado del **último** `ToolMessage` de `compute_eligibility` en `result.messages`, o `undefined` si el agente no llamó a la tool. `OrchestratorOutput` lo propaga.

### 2.2 Trigger

**Archivo:** `lexiaCore.ts` (después del output pipeline, para que el aviso no pase por el detector de consejo legal)

Se deriva cuando la tool corrió, `isEligible === false` y `yearsElapsed >= 1`.

- **Por qué `false` puede estar mal:** `computeEligibility` solo modela 10/5/2 años. Los regímenes de 1 año del Art. 22.2 CC (casado/a con español/a, nacido/a en España, viudo/a de español/a, etc.) no están: `specialCase: 'other_special'` está declarado pero nunca se asigna, y `caseData.hasChildren` se ignora. Ejemplo: alguien casado con una española, con 3 años de residencia, recibe "te faltan 7" cuando en realidad ya puede solicitar.
- **Por qué el umbral es `yearsElapsed >= 1`:** es el mínimo de todos los regímenes de residencia. Con menos de 1 año, el "no" es correcto sin importar el régimen y revisarlo no aporta nada. Con 1 año o más, algún régimen no modelado podría darlo vuelta.
- **Por qué ausencias y conducta cívica no entran en este trigger:** solo pueden empeorar el resultado, así que no cambian un `false`. Afectan al `true` (gap 2.5).
- **`undefined` no deriva** (revisa lo acordado el 19/09, confirmado el 2026-09-27). `undefined` significa "falta la fecha de llegada", y en ese turno el agente le está pidiendo el dato al usuario. No hay ninguna decisión que revisar, y derivar crearía una solicitud por cada turno de recolección de datos.

**Deduplicación:** como mucho una solicitud `pending` por `(userId, conversationId)`. Si ya existe una `pending`, se **actualiza su `reason`** con la del cálculo más reciente (por ejemplo, el usuario corrigió una fecha mal cargada) y el aviso se muestra igual. Si la existente ya no está `pending` (un revisor la tomó), se crea una nueva: cambiarle la razón a un caso mientras alguien lo revisa sería peor. Pisar la razón vieja no pierde información, porque la solicitud guarda el `conversationId` y el revisor ve la conversación completa.

### 2.3 `conversationId` hasta el core

`LexiaCoreInput.conversationId?: string`. `messages.ts` ya lo tiene en ambas rutas (stream y no-stream) y lo pasa.

### 2.4 Transparencia (requisito)

- Aviso explícito al final de la respuesta: que el caso fue derivado a revisión, por qué (el cálculo automático de plazos no puede verificar requisitos como integración o ausencias) y la recomendación de consultar a un profesional.
- **Solo si el insert funcionó.** `requestHumanReview` se traga los errores y devuelve `requestId: ''`. Con `''` se muestra la recomendación de consultar a un profesional, pero **no** se dice "tu caso fue derivado". Afirmar una derivación que no existe es peor que no derivar: el usuario espera una revisión que nunca llega y deja de buscar ayuda por su cuenta, en un trámite con plazos.
- Por qué el aviso no puede pasar por `legalAdviceDetector`: si matchea un patrón, el pipeline reemplaza **toda** la respuesta por `LEGAL_ADVICE_CANNED`, y se perderían el cálculo de elegibilidad y el propio aviso.
- Streaming: el aviso se emite con `onToken` después del contenido, para que el usuario lo vea sin recargar.
- El texto del aviso no puede matchear los patrones de `legalAdviceDetector.ts` (se agrega un test). Aunque se agregue después del pipeline, así queda a salvo si alguien cambia el orden.

### 2.5 Gap aceptado (documentar, no resolver)

`isEligible === true` con factores no verificables (ausencias de más de 6 meses, conducta cívica, Art. 22.4 CC) **no** deriva. `computeEligibility` no recibe esos datos como input. Resolverlo requiere preguntas de intake nuevas, que es otra mejora. Queda documentado en `docs/informe_capstone.md` (trabajo futuro) y en un comentario en el trigger.

**Segundo gap:** `computeEligibility` no modela los regímenes de 1 año del Art. 22.2 CC. Arreglarlo requiere preguntar en el intake por matrimonio, lugar de nacimiento, etc., que es la misma mejora de intake de arriba. Hasta entonces, la derivación de 2.2 hace de colchón para los `false` que podrían estar mal. Se documenta junto al gap anterior.

## Tests

- **(d)** Generar un intento persiste N filas con `position`. Un intento abierto se recupera tras "reiniciar" (sin `attemptId` en el historial). `start_ccse_quiz` con un intento abierto devuelve `ACTIVE_ATTEMPT_EXISTS`. Responder con un `questionId` ajeno al intento se rechaza. Las funciones de estado respetan la propiedad por `userId`. Un validator con ruta desconocida hace throw. Triage (con LLM mockeado según el patrón de los tests existentes): el flag `hasActiveCcseAttempt` llega al prompt.
- **(c)** Extracción del último `ToolMessage`: sin tool da `undefined`, y con varias llamadas gana la última. `false` con `yearsElapsed >= 1` deriva. `false` con `yearsElapsed = 0`, `true` y `undefined` no derivan. Dedupe por conversación. `requestId: ''` no dice "derivado". El aviso no matchea `LEGAL_ADVICE_PATTERNS`. Paths stream y no-stream.

## Fuera de alcance

- (b) RAGAS ↔ `preflight`.
- Preguntas de intake para ausencias y antecedentes (gap 2.5).
- Panel de admin para gestionar `human_review_requests` (ya existe la tabla, y la gestión queda como está).
- Quick replies (botones con las opciones que mandan `"b"` como mensaje) en el frontend: mejora de UX futura. El core tiene que funcionar con texto igual, porque el canal MCP no tiene UI.
- Expiración automática de intentos abiertos (job programado + notificación). Un intento viejo se resuelve cuando el usuario vuelve, con la regla de 1.4 (retomar o abandonar).
- Unificar los `getCoreDb()` duplicados entre `ccse/agent.ts` y `requestHumanReview.ts`.

## Decisiones cerradas (2026-09-27)

- `undefined` no deriva.
- `false` deriva solo con `yearsElapsed >= 1` (ver 2.2).
- Quick replies y expiración automática de intentos: fuera de alcance.
