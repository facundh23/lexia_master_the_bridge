# Security & compliance hardening — diseño

**Fecha:** 2026-08-02
**Origen:** sesiones 11-18 de la revisión de código de LEXIA (`packages/core/src/nhi`, `crypto`, `observability`), que identificaron tres controles de seguridad/compliance que existen en el código pero se degradan en silencio en vez de fallar de forma segura.

## Contexto

La revisión encontró un patrón repetido: varios controles de seguridad tienen un "fail-open" implícito — si falta configuración o algo no matchea lo esperado, el sistema sigue funcionando como si el control no existiera, sin avisar. Este spec cubre tres instancias concretas de ese patrón, agrupadas porque son del mismo tema (seguridad/compliance), tocan archivos independientes entre sí, y son lo suficientemente chicas como para resolverse en una sola pasada de implementación.

Antes de diseñar se releyeron los 4 archivos involucrados (`fieldEncryption.ts`, `langfuse.ts`, `agentIdentities.ts`, `auditLogger.ts`) y sus call sites reales (`cases.ts`, `lexiaCore.ts`, `triage.ts`, `normativa/agent.ts`, `eligibility/agent.ts`, `ccse/agent.ts`), lo que corrigió dos supuestos de la revisión original:

- `PII_ENCRYPTION_KEY` ya es obligatoria al arrancar en producción (`server.ts::validateEnv()` throws si falta). El fallback a texto plano en `cases.ts` solo es alcanzable hoy en dev/staging/test — sigue valiendo la pena endurecerlo como defensa en profundidad, pero no es un agujero abierto en producción.
- La fuga de PII hacia Langfuse es solo del lado de entrada. El `trace.end()` final ya recibe la respuesta post-guardrails de salida (`outputResult.text`); el problema es únicamente que `startTrace()` manda `input.content` crudo al crear el trace, antes de que corra `runInputPipeline()`.
- `logAgentAction()` se llama **después** de que el agente ya ejecutó su trabajo (ver `normativa/agent.ts`, línea 91 vs. 98) — es un registro de auditoría posterior al hecho, no un gate de autorización previo. Esto acota qué puede significar realmente "bloquear" en el fix de scopes (ver Sección 3).

## Sección 1 — Cifrado de PII: fail-closed en producción

**Archivo:** `apps/api/src/routes/cases.ts`

**Problema:** `encryptPII()` devuelve el valor en texto plano sin avisar si `PII_ENCRYPTION_KEY` no está seteada (`if (!key) return value;`).

**Diseño:** mismo criterio que ya usa `fieldEncryption.ts` para `FIELD_ENCRYPTION_SALT` (throw solo en producción, warning + fallback en el resto de entornos):

```ts
function encryptPII(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENCRYPTION_KEY no está configurada — no se puede persistir un campo PII');
    }
    console.warn(
      '[cases] PII_ENCRYPTION_KEY no seteada — guardando campo PII en texto plano (solo permitido fuera de producción).',
    );
    return value;
  }
  return encryptField(value, key);
}
```

El throw no necesita try/catch nuevo en la ruta — el error handler global de Fastify (`server.ts`) ya normaliza cualquier excepción no capturada a un 500 genérico.

**`decryptPII()` no se modifica.** Si el valor no está cifrado (`isEncrypted()` da `false`), seguir devolviéndolo tal cual es correcto — cubre datos legítimos de entornos no-prod o anteriores a este cambio.

**Fuera de alcance (decidido explícitamente):** `messages.ts` tiene su propia copia de la lógica de descifrado, pero solo lee/descifra — no escribe PII nueva, así que no comparte el riesgo de fail-open en escritura que motiva este fix. Unificar ambas implementaciones en un helper compartido es un refactor de limpieza legítimo, pero se deja fuera de este spec para no mezclar un fix de seguridad con una refactorización no esencial.

## Sección 2 — Langfuse deja de recibir input crudo

**Archivos:** `packages/core/src/observability/langfuse.ts`, `packages/core/src/lexiaCore.ts`

**Problema:** `startTrace()` manda `input.content` (el mensaje del usuario tal cual llega, sin pasar por el guardrail de PII) al crear el trace en Langfuse.

**Diseño:**

1. `startTrace()` deja de recibir/usar `content` en la creación del trace. La llamada a `lf.trace({...})` no incluye el campo `input` — solo `id`, `userId`, `metadata`. Así el texto crudo nunca se serializa hacia la llamada de creación, ni siquiera transitoriamente.
2. Se agrega un método nuevo a `TraceHandle`:
   ```ts
   setInput(content: string): void
   ```
   que internamente hace `trace.update({ input: { content } })` — mismo mecanismo que ya usa `end()` para patchear el output.
3. En `lexiaCore.ts` (`runLexiaCore` y `runLexiaCoreStream`), inmediatamente después de:
   ```ts
   const inputResult = await runInputPipeline(input.content);
   ```
   se agrega:
   ```ts
   trace.setInput(inputResult.sanitized);
   ```
   Esto ocurre **antes** del chequeo `if (inputResult.blocked)`, así que tanto los mensajes bloqueados (jailbreak, PII, categoría especial) como los que pasan el guardrail quedan en Langfuse con el texto ya sanitizado — nunca el crudo.

El `traceId` (usado para correlacionar spans y el audit log) se sigue generando igual que hoy, independiente del contenido — nada más del pipeline cambia.

## Sección 3 — Enforcement de scopes de NHI (throw post-hoc)

**Archivos:** `packages/core/src/nhi/auditLogger.ts`, `packages/core/src/nhi/agentIdentities.ts`, `packages/core/src/lexiaCore.ts`

**Problema:** `logAgentAction()` acepta un `scopeUsed: string` libre que nunca se valida contra los `scopes` declarados en `AGENT_IDENTITIES` — es documentación, no un control real.

**Restricción arquitectónica encontrada:** el logging ocurre después de que el agente ya ejecutó su trabajo (LLM call, RAG, etc.), no antes. Por eso el "bloqueo" que tiene sentido acá es un throw post-hoc que actúa como guardia de regresión (detecta inmediatamente si se introduce una acción con un scope no declarado), no una prevención de la ejecución en curso — el costo de esa ejecución particular ya se pagó. Dado que hoy los scopes son estáticos y viven hardcodeados en el propio código (no vienen de un actor externo variable en runtime), el valor de seguridad real de este control es atrapar bugs/regresiones de forma inmediata y ruidosa, no interceptar un ataque en curso. Un gate real pre-ejecución (chequear el scope antes de invocar cada agente) se descartó por desproporcionado para ese nivel de riesgo — tocaría 4+ archivos de agentes para un beneficio marginal sobre el throw post-hoc.

**Diseño:**

1. **`agentIdentities.ts`** — se agrega una identidad nueva para cubrir un caller que hoy no está registrado:
   ```ts
   crisisDetector: {
     id: 'agent:crisis_detector:v1',
     name: 'crisis_detector',
     scopes: ['read:input'],
     version: 'v1',
   },
   ```

2. **`auditLogger.ts`** — `logAgentAction()` valida el scope **antes** del try/catch que envuelve el insert a la DB (así el throw de validación no queda tragado por el fail-open de infraestructura existente, que es un problema distinto: DB caída vs. scope inválido).

   ```ts
   function findIdentityById(agentId: string) {
     return Object.values(AGENT_IDENTITIES).find((identity) => identity.id === agentId);
   }

   function assertValidScope(entry: AgentAuditEntry): void {
     const identity = findIdentityById(entry.agentId);
     if (!identity) {
       throw new Error(`NHI scope violation: identidad de agente desconocida "${entry.agentId}"`);
     }
     const usedScopes = entry.scopeUsed.split(',').map((s) => s.trim()).filter(Boolean);
     const invalid = usedScopes.filter((s) => !identity.scopes.includes(s));
     if (invalid.length > 0) {
       throw new Error(
         `NHI scope violation: el agente "${identity.name}" usó scope(s) no declarado(s): ${invalid.join(', ')}`,
       );
     }
   }

   export async function logAgentAction(entry: AgentAuditEntry): Promise<void> {
     assertValidScope(entry);

     const db = getDb();
     if (!db) return;
     try {
       await db.insert(schema.auditLog).values({ /* ... sin cambios ... */ });
     } catch {
       // fail-open: si la DB no está disponible, no interrumpir el flujo principal
     }
   }
   ```

   El split por comas soporta tanto un scope único como varios (caso real de `triage.ts`: `scopeUsed: 'read:user_context,read:conversation_history'`), validando que cada fragmento esté contenido en el array `scopes` declarado.

3. **`lexiaCore.ts`** — las 2 llamadas a `logAgentAction` para el crisis detector (una en `runLexiaCore`, otra en `runLexiaCoreStream`) cambian:
   ```ts
   agentId: 'system:crisis_detector:v1'
   ```
   por:
   ```ts
   agentId: AGENT_IDENTITIES.crisisDetector.id
   ```
   consistente con cómo el resto de los agentes referencia su propia identidad.

**Fuera de alcance (decidido explícitamente):** la identidad `guardrail` (`agent:guardrail:v1`) queda declarada en `AGENT_IDENTITIES` sin ningún caller real hoy. No se toca — nadie la usa, no hay nada que este fix pueda romper ni arreglar ahí.

## Testing

- **Sección 1:** test que simule `NODE_ENV=production` sin `PII_ENCRYPTION_KEY` seteada y verifique que `encryptPII` (vía el endpoint de creación/actualización de `cases`) lanza y el request responde 500, en vez de persistir texto plano. Test complementario en modo no-producción verificando que el fallback con warning se preserva sin cambios.
- **Sección 2:** test unitario de `startTrace`/`setInput` verificando que ningún texto crudo se pasa al mock del cliente Langfuse en el momento de creación del trace, y que `setInput` recibe el texto sanitizado. Test de integración liviano sobre `runLexiaCore` con un input que dispare el guardrail de PII, verificando que el trace mockeado nunca ve el valor original.
- **Sección 3:** tests unitarios de `logAgentAction`/`assertValidScope` cubriendo: (a) scope único válido, (b) múltiples scopes válidos separados por coma (caso triage), (c) scope no declarado → throw, (d) `agentId` inexistente en el catálogo → throw, (e) confirmar que el throw ocurre incluso sin `DATABASE_URL` seteada (la validación es independiente de la disponibilidad de la DB). Test de regresión que ejercite las 4 llamadas reales existentes (`triage.ts`, `normativa/agent.ts`, `eligibility/agent.ts`, `ccse/agent.ts`) más el nuevo caller de `crisisDetector`, confirmando que ninguna rompe con el enforcement activado.

## Fuera de alcance (global, para todo este spec)

- Unificar la lógica de cifrado duplicada entre `cases.ts` y `messages.ts`.
- Gate de autorización pre-ejecución para scopes de NHI (chequeo antes de invocar cada agente).
- Cablear la identidad `guardrail` a algún caller real.
- Cualquiera de las otras mejoras propuestas en la revisión (deuda técnica de verticales, footgun de `requireProfessional`, conectar `requestHumanReview`, destino de las tools huérfanas de CCSE) — quedan para specs futuros.
