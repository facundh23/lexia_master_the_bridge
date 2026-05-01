# Lexia — Design Specification

| Campo | Valor |
|---|---|
| **Proyecto** | Lexia — Asistente informativo de extranjería |
| **Tipo de documento** | Design specification (output de brainstorming) |
| **Versión** | 1.0.0 |
| **Fecha** | 2026-05-01 |
| **Autor** | Facundo Herrera |
| **Contexto** | Capstone del Máster de IA Generativa |
| **Estado** | Approved (pending spec review loop) |
| **Próximo paso** | Implementation plan vía writing-plans skill |

---

## 0. Resumen ejecutivo

**Lexia** es un asistente conversacional informativo, dirigido al **público general (B2C)**, que ayuda a personas en proceso de obtener la **nacionalidad española por residencia** a entender el procedimiento, sus requisitos, plazos, documentación y exámenes (CCSE).

Lexia **no sustituye** asesoramiento jurídico profesional. Esta restricción está implementada arquitectónicamente (no es solo un disclaimer): guardrails de salida detectan intentos de generar consejo legal accionable y derivan a abogado/gestor.

Lexia se expone también como **servidor MCP** para que abogados y gestores especializados en extranjería lo consuman desde sus clientes IA (Claude Desktop, Cursor) como herramienta profesional, con autenticación obligatoria mediante PAT.

El sistema implementa una **arquitectura vertical-deep + extensible**: profundidad completa en el vertical "nacionalidad por residencia" (con simulador CCSE como bonus), pero diseñada con un contrato de extensión drop-in que permite añadir verticales nuevos (arraigo, reagrupación, etc.) como Future Work.

**Stack**: Node.js + TypeScript, Next.js 15 (App Router), Fastify, Postgres + Drizzle, Chroma, MinIO, LangGraph, Anthropic Claude (primario) + OpenAI (fallback), Better Auth, Langfuse self-host, Docker Compose, Caddy.

**Cobertura del máster**: arquitectura cubre los pilares centrales — RAG con ACL, agentes con tools, orquestación multi-agente con LangGraph, MCP server, LLM-as-judge para eval, governance/security clase 4.4 (LLMSecOps, NHIs, dual-LLM pattern, Lethal Trifecta análisis, iBOM), guardrails clase 4.3 P3, Docker, observabilidad, red teaming automatizado.

**Plazo objetivo**: 7 meses (~30 semanas) — pendiente confirmación con coordinación del máster. Existe matriz de recorte para escenarios de menor bandwidth.

---

## 1. Decisiones de producto

| Decisión | Valor | Razón |
|---|---|---|
| Audiencia primaria | B2C — público general (inmigrantes y aspirantes a nacionalidad) | Casos reales, vulnerabilidad alta, mostrar guardrails es defendible |
| Audiencia secundaria | B2B — gestores y abogados via MCP | Doble surface gratis si el core está bien diseñado |
| Vertical MVP | Nacionalidad por residencia (con simulador CCSE) | Volumen alto, corpus claro, plazo 2 años para iberoamericanos da diferencial |
| Idioma | Español-only (MVP) | Cubre ~95% del caso real; CCSE solo en español; multilingüe es Future Work |
| Persistencia | Auth obligatoria + caso del usuario persistente | Showcase identity governance + GDPR + ACL + audit log |
| Disclaimer | Persistente, inyectado por outputPipeline | No removible vía prompt injection |
| Postura legal | Asistente informativo, NUNCA consejo jurídico | Guardrails detectan y derivan a abogado |
| Hosting | EU-only (Hetzner Alemania o equivalente) | GDPR + transferencias internacionales |

**Domain knowledge nota** (de Facundo, validador del proyecto):
> "Tus hijos al momento de obtener la nacionalidad por residencia debes incluirlos antes de hacer la jura, al momento de presentar todos los papeles, sino te pueden rechazar la solicitud."

Esta nota se traduce en:
- **Test case** del golden set: pregunta sobre cuándo incluir hijos → respuesta debe mencionar "antes de la jura, al presentar la documentación" + cita
- **Reminder template** activado cuando `case.has_children = true` y status = "preparando documentación"
- **Checklist tool**: cuando `has_children = true`, incluye ítem destacado

---

## 2. Sección 1 — Arquitectura de alto nivel

### 2.1 Topología — tres surfaces, un core

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SURFACES (entrypoints)                       │
│   ┌──────────────┐       ┌──────────────┐      ┌──────────────┐     │
│   │  Web B2C     │       │  MCP Server  │      │  N8N         │     │
│   │  React +     │       │  for gestores│      │  WhatsApp /  │     │
│   │  Next.js 15  │       │  (Claude     │      │  Telegram    │     │
│   │  (App Router)│       │  Desktop /   │      │  (opcional   │     │
│   │              │       │   Cursor)    │      │   Future W.) │     │
│   └──────┬───────┘       └──────┬───────┘      └──────┬───────┘     │
└──────────┼──────────────────────┼─────────────────────┼─────────────┘
           │                      │                     │
           └──────────────────────┼─────────────────────┘
                                  ▼
              ┌────────────────────────────────────┐
              │   API Gateway (Fastify + TS)       │
              │   • Better Auth middleware         │
              │   • Rate limiting (per IP + user)  │
              │   • Audit log + Trace ID injection │
              └────────────────┬───────────────────┘
                               ▼
              ┌────────────────────────────────────┐
              │   GUARDRAIL — input layer          │
              │   ① Regex (PII redaction)          │
              │   ② Keyword blocklist              │
              │   ③ LLM-judge (jailbreak/abuse)    │
              │   ④ Special category minimization  │
              └────────────────┬───────────────────┘
                               ▼
              ┌────────────────────────────────────┐
              │   LANGGRAPH ORCHESTRATOR           │
              │     ┌──────────────────┐           │
              │     │  TriageAgent     │ → routea  │
              │     └────────┬─────────┘           │
              │              ▼                     │
              │   ┌──────────┼──────────┐          │
              │   ▼          ▼          ▼          │
              │ Normativa  CCSE     Eligibility    │
              │ Agent      Agent    Agent          │
              └────────────────┬───────────────────┘
                               ▼
              ┌────────────────────────────────────┐
              │   GUARDRAIL — output layer         │
              │   ① Citation enforcer              │
              │   ② Legal advice detector          │
              │   ③ PII output redaction           │
              │   ④ Disclaimer injection           │
              └────────────────┬───────────────────┘
                               ▼
                          Response (con disclaimer)

   Persistence:
   ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌────────────┐
   │ Postgres │  │ Chroma      │  │ Langfuse │  │ MinIO      │
   │ +        │  │ (corpus +   │  │ (traces, │  │ (uploads   │
   │ pgcrypto │  │  user docs, │  │  eval,   │  │  cifrados) │
   │ (ENC PII)│  │  ACL chunks)│  │  metrics)│  │            │
   └──────────┘  └─────────────┘  └──────────┘  └────────────┘

   LLM providers:
   ┌────────────────────┐    ┌──────────────────┐
   │ Anthropic Claude   │    │ OpenAI (fallback │
   │ Sonnet 4.6 primary │    │ + embeddings)    │
   │ + Haiku 4.5 judges │    │                  │
   └────────────────────┘    └──────────────────┘
```

### 2.2 Stack — decisiones y justificación

| Capa | Elección | Razón |
|---|---|---|
| Frontend | React + Next.js 15 (App Router) + Tailwind + shadcn/ui | Empleabilidad post-Clio + SSR/streaming gratis para chat |
| Backend | Fastify + TypeScript | Performance + TS-first + plugins maduros |
| Auth | Better Auth | TypeScript-first, sesiones, OAuth, rate-limit nativo |
| DB relacional | Postgres 16 + Drizzle ORM | TS-first sin overhead de Prisma |
| Cifrado de PII | pgcrypto field-level | Defense in depth; campos sensibles cifrados a nivel de fila |
| Vector DB | Chroma | Self-hosted, dockerizable; Pinecone rompería el "todo en Docker" |
| Orquestación | LangGraph (Node) | Master content directo; state graph + multi-agent |
| LLM provider | Anthropic Claude Sonnet 4.6 (primario) + OpenAI (fallback + embeddings) | Claude es mejor en razonamiento legal y citas; multi-provider muestra abstracción |
| MCP | `@modelcontextprotocol/sdk` (Node) | SDK oficial en TS |
| Observability | Langfuse self-host | Master content; dockerizable; traces con seguridad |
| N8N | Opcional, entry point WhatsApp/Telegram | Pilar N8N del máster sin bloquear core |
| Object storage | MinIO (S3-compat) en Docker | Uploads separados de DB |
| Reverse proxy | Caddy 2 | TLS automático con Let's Encrypt |
| Container | Docker Compose | Cubre Docker, suficiente para demo |

### 2.3 Diferenciación de superficies

- **Web B2C**: usuario público autenticado. Tono accesible. Disclaimer omnipresente. Tools "user-facing" (save mi caso, simulacro CCSE, recordame plazo, dame checklist).
- **MCP server**: gestores/abogados profesionales con su cliente IA. Tools "professional-facing" (search_corpus_with_citations, compute_eligibility, get_procedure_requirements). Tono técnico, autenticación obligatoria con PAT + verificación de colegiación.
- **N8N (Future Work)**: webhook que recibe WhatsApp/Telegram, los pasa al mismo agente.

**Punto clave de arquitectura**: el `LangGraph orchestrator` es el mismo para las 3 superficies. Se invoca vía cliente Node común `LexiaCore.run(input, context)`. El doble surface es prácticamente gratis una vez que el core está bien diseñado.

---

## 3. Sección 2 — Modelo de datos

### 3.1 División de almacenamiento

| Almacén | Qué guarda | Razón |
|---|---|---|
| Postgres | usuarios, casos, conversaciones, audit log, CCSE bank, recordatorios | Datos transaccionales con relaciones; ACID; queries SQL |
| Chroma | embeddings + chunks de corpus + chunks de docs subidos por usuarios | RAG — búsqueda semántica con metadata filtering por ACL |
| MinIO | archivos PDF/DOCX subidos por usuarios | Object storage, separado de DB |

### 3.2 Esquema relacional principal (Postgres)

Entidades clave (ver detalle de campos en `docs/db/schema.md` cuando se cree):

- **users** — gestionado por Better Auth + extensiones (role: user/admin/professional, locale)
- **cases** — caso del usuario (country_origin, arrival_date, residence_status, vertical_slug, notes)
  - Campos `notes` y `country_origin` cifrados con pgcrypto
- **conversations** — sesiones de chat (puede no tener case_id para usuarios sin caso aún)
- **messages** — role/content/tool_calls/citations/trace_id
- **documents** — registro de docs subidos (FSM: pending → sanitized → indexed → rejected)
- **ccse_questions** — banco de preguntas (verified_by_human flag)
- **ccse_attempts** + **ccse_attempt_questions** — historial de simulacros
- **reminders** — fechas de cumplimiento (con notified_at)
- **audit_log** — actor_type/actor_id/surface/action/target/details/trace_id/created_at
- **verticals** (registry) — slug/name/enabled/corpus_namespace/version
- **corpus_documents** — catálogo de docs en el corpus público
- **professional_verifications** — para role=professional, registro de colegiación
- **token_usage** — tracking de tokens consumidos por usuario

### 3.3 Esquema Chroma (vector DB)

Una sola colección `lexia_corpus`. Separación por **metadata + namespaces**:

```
namespaces:
  "vertical:nacionalidad_residencia"  ← corpus público del MVP
  "vertical:arraigo"                  ← futuro
  "private:user:<user_id>"            ← uploads del usuario

metadata por chunk:
  vertical, visibility (public|private), user_id?, case_id?,
  source_type (BOE, codigo_civil, instruccion_dgrn, manual_ccse, user_upload),
  source_url, document_id, chunk_idx, chunk_hash,
  classification (public|pii_personal), published_date
```

### 3.4 Patrón retrieve con ACL (defense in depth)

Tres capas de control sobre cada búsqueda:

1. **Pre-filter por metadata**: query Chroma con `where` que combina visibility + vertical + user_id
2. **Sobre-recuperación + post-filter**: traer 2x chunks y validar acceso fila por fila
3. **Audit log**: cada retrieve loggea qué chunks vio el usuario

Implementación detallada en `src/core/rag/retrieve.ts`.

### 3.5 GDPR-aware design

- **PII en logs**: IPs hasheadas; queries con PII pasan por `redactPII()` antes de persistir
- **Soft delete + retention**: usuarios borran su cuenta (GDPR Art. 17) → cascade soft delete; audit log se mantiene 1 año en forma hasheada
- **Data export** (`/me/export`): JSON con todos los datos del usuario (GDPR Art. 20)
- **Document deletion**: borra de MinIO + Chroma + soft-delete `documents`
- **Rejected query content**: cuando un guardrail bloquea, `details.query_redacted` se trunca a 50 chars + hash

---

## 4. Sección 3 — Arquitectura de seguridad

### 4.1 Capas (defense in depth)

```
1. Network/Transport: HTTPS · CSP · CORS estricto · HSTS
2. Authentication (Better Auth): email/password + Google OAuth
   • Email verification OBLIGATORIA antes de primer chat
   • Password policy: min 12 chars + check vs HIBP + 5/15min throttle
   • Session invalidation en password change
   • 2FA opcional (mandatory para admin/professional)
3. Authorization: RBAC + ABAC; cada query lleva user.id como contexto inviolable
4. Input Guardrails (4 filtros en cascada):
   ① Regex PII redaction
   ② Keyword blocklist
   ③ LLM-judge (jailbreak/abuse) — Haiku 4.5
   ④ Special category data minimization (GDPR Art. 9)
5. Dual-LLM pattern (Simon Willison): Planner privilegiado ↔ Specialists cuarentenados ↔ Validator
6. Tool execution determinístico: TS puro, scopes por agente, sin LLM en ejecutor
7. Output Guardrails (4 filtros):
   ① Citation enforcer
   ② Legal advice detector → derivación a abogado
   ③ PII output redaction
   ④ Disclaimer injection (no removible)

Audit log persistente atraviesa TODAS las capas con trace_id propagado.
```

### 4.2 Análisis Lethal Trifecta aplicado

| Vértice | ¿Lo cumple Lexia? | Mitigación |
|---|---|---|
| 1. Datos sensibles | Sí — `cases.country_origin`, `cases.notes` (PII), docs en RAG privado | ACL por chunk + namespace por usuario + cifrado at-rest pgcrypto |
| 2. Contenido no confiable | Sí — uploads, mensajes, MCP queries | Sanitización en ingest + guardrails de input |
| 3. Acción externa | **Limitada por diseño** — solo escribe en namespace del usuario autenticado | Vértice 3 capado arquitectónicamente; no hay tools que escriban fuera del scope |

**Declaración de diseño** (en spec, defendible en tribunal):
> Lexia no expone tools que escriban fuera del namespace del usuario autenticado. Esta restricción es parte del contrato de seguridad y no es modificable por configuración ni por administradores.

### 4.3 Dual-LLM pattern (Capa 5)

Pseudo-código del orchestrator:

```
1. Planner LLM (privilegiado) — recibe system prompt + user input + history.
   No ve chunks crudos. Output: structured plan { route, subQuery }.
2. Specialist LLM (cuarentenado) — recibe chunks crudos pero output tipado
   con response_format obligatorio. No puede "decidir tomar acciones".
3. Validator LLM (otro aislamiento) — recibe el output del Specialist y
   valida que cumpla las reglas (citations, no legal advice, no PII leak).
4. Si valida → format final response con disclaimer inyectado.
   Si no valida → canned response.
```

**Defense en tribunal**: si preguntan "¿qué pasa si meto un PDF con instrucciones inyectadas?":
1. PDF sanitizado en ingest
2. Aún si pasa, sus chunks solo entran al Specialist, no al Planner
3. Specialist tiene response_format schema — no puede "decidir tomar acciones"
4. Validator (otro LLM) revisa output antes de mostrarlo

### 4.4 Identidad de agentes (NHIs — los 5 principios)

```
agent:planner:v1       scopes: [read:user_context, read:conversation_history]
agent:normativa:v1     scopes: [read:rag_chunks, read:corpus_metadata]
agent:eligibility:v1   scopes: [read:user_case]
agent:ccse:v1          scopes: [read:ccse_bank, write:ccse_attempts]
agent:guardrail:v1     scopes: [read:agent_output]
```

Cada llamada al LLM lleva la identity como metadata en Langfuse trace + audit_log row con: `actorType=agent`, `actorId=AGENT_IDENTITIES.X.id`, `details.scope_used`, `details.delegated_by_user`.

**Principio cubierto**:
- ✅ 1. Cuenta rastreable (cada agente tiene `id` único)
- ✅ 2. Delegación con scopes
- ✅ 3. Acciones pre-autorizadas (set de tools por agente fijo en código)
- ⚠️ 4. Credenciales efímeras — API keys del LLM provider rotables manualmente cada 90d (Future Work: Vault con rotación automática). **Documentado como gap conocido.**
- ✅ 5. Cadena auditable

### 4.5 Add-ons de seguridad aprobados

#### A. iBOM con CycloneDX
Generado en CI cada release. Componentes incluidos: modelos (Claude Sonnet, embeddings), datasets (corpus público), librerías (LangGraph, etc.), datos (corpus por vertical con classification).

Archivo: `artifacts/lexia.cdx.yaml`

#### B. Red teaming en CI con DeepTeam
- 50 ataques baseline en cada PR (~3-5 min)
- 500 ataques nightly (regresión completa)
- Vulnerabilities testadas: PromptInjection, PIILeakage, JailbreakAttempts, LegalAdviceTrap, OffVerticalManipulation
- Threshold: si protection_rate baja >5% vs baseline, falla merge

#### C. Auth + scopes obligatorios en MCP
- Role `professional` con verificación **obligatoria** vía colegiación (manual, email a colegio profesional)
- PAT (personal access token) para configurar el MCP
- Audit log diferencia surface (`web` vs `mcp`)
- Scope `professional` permite ciertos endpoints más permisivos pero nunca acceso a datos de otros usuarios

#### D. Field-level encryption con pgcrypto
- Campos cifrados: `cases.notes`, `cases.country_origin`, `documents.filename`
- Clave en variable de entorno (rotable manualmente)
- Si filtra el dump del DB, no se leen PII

#### E. Crisis detection
Patrones que disparan modo "vulnerabilidad alta":
- Deportación inminente / expulsión en N días
- Violencia de género / maltrato
- Menor sin documentación / solo
- Sin alojamiento

Acciones automáticas:
- Tono más cálido
- Inserta recursos: CEAR, Cruz Roja, 016, abogado de oficio
- Suspende modo "informativo neutro"
- Audit log marca caso como `escalation_risk`

#### G. Per-user budget (anti-abuse + cost control)
- Free: 50k tokens/mes (~30-40 conversaciones)
- Después: respuesta enlatada con cooldown
- Endpoint `/me/usage` muestra consumo
- Detector worker alerta si user excede X%

### 4.6 Add-ons de compliance aprobados

#### G1. Canary tokens en system prompt
Tokens secretos únicos en system prompts. Job cron diario busca canaries en `audit_log.details` y outputs (Future Work: posts públicos). Si aparecen → señal de exfiltración.

#### G2. Dependency + container scanning en CI (Tier 0)
- `pnpm audit --audit-level=high` bloquea PR
- `trivy image` escanea cada imagen Docker antes de push
- Dependabot habilitado para PRs de upgrades

#### G4 + G5. Auth hardening
- Email verification obligatoria
- Password: min 12 chars + HIBP check + throttle 5/15min
- Session invalidation en password change
- Concurrent session limit: 5

### 4.7 Guardrails — implementación

**Input pipeline** (en orden):
1. `regexPIIRedactor` — emails, IBANs, DNIs
2. `keywordBlocklist` — jailbreak directo
3. `llmJudgeJailbreak` (Haiku 4.5, threshold 0.7)
4. `specialCategoryMinimizer` — detecta orientación sexual / religión / asilo / política → no persiste contenido plano

**Output pipeline** (en orden):
1. `citationEnforcer` — toda respuesta normativa cita ≥1 fuente; regenera 1 vez si no
2. `legalAdviceDetector` — patterns + LLM judge → si dispara, reemplaza con derivación
3. `piiOutputRedactor` — redacta PII que el LLM haya repetido
4. `disclaimerInjector` — siempre inyecta disclaimer al final

**Canned responses**: pii_detected, jailbreak_attempt, legal_advice_requested, out_of_vertical, out_of_corpus, special_category_detected.

### 4.8 Disclaimer estratégico

Inyectado por outputPipeline (no es prompt — no se puede quitar via injection):

```
ℹ️ Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico
   de un abogado/gestor habilitado. Para casos complejos o decisiones formales,
   consultá un profesional. Fuentes citadas:
   • [BOE 30/04/2011 - RD 557/2011 art. 124]
   • [Código Civil art. 22]
```

Adicionalmente, AI Act Art. 50 — primer mensaje de cada conversación: *"Hola, soy Lexia, un asistente IA..."*. Onboarding lo deja claro antes del primer chat.

### 4.9 Secrets management

- `.env.example` en git (documentado)
- `.env` y `.env.production` en `.gitignore`, cifrados con SOPS (Mozilla) usando GPG
- Docker secrets en compose
- Rotación: 90d para LLM API keys, never para encryption key (sin re-cifrar PII), session secret rotación invalida sesiones

---

## 5. Sección 4 — Pipeline de eval y observabilidad

### 5.1 Eval architecture

```
Test set curado (golden_set.v1.json) — 80 preguntas en categorías:
  factual_simple (35) | factual_complex (20) | out_of_scope (10)
  adversarial/jailbreak (10) | crisis_signals (5)

→ Eval Runner (Node script):
  1. Llama Lexia core con la pregunta
  2. Captura: respuesta, citas, route, latencia, tokens
  3. Pasa por LLM-as-judge con rúbrica
  4. Persiste en eval_runs (Postgres)

→ 4 jueces especializados (cada uno con rúbrica + Opus como juez):
  ① FactualityJudge — ¿correcta vs golden?
  ② CitationJudge — ¿citas existen y respaldan?
  ③ SafetyJudge — ¿da consejo legal? ¿filtra PII?
  ④ ToneJudge — ¿empática? ¿con disclaimer?

→ Dashboard (Langfuse + Postgres view):
  Score agregado por categoría · regresiones · failure cases drill-down
```

### 5.2 Métricas con thresholds en CI

```yaml
factuality_score_avg: ">= 0.80"
citation_validity_rate: ">= 0.90"
jailbreak_block_rate: ">= 0.85"
pii_leak_rate: "== 0"
disclaimer_present_rate: ">= 0.99"
crisis_detection_recall: ">= 0.90"
p95_latency_ms: "<= 8000"
```

Si alguna baja, falla merge en PR.

### 5.3 Continuous eval

| Trigger | Set | Volumen | Tiempo |
|---|---|---|---|
| pre-commit | smoke 5 preguntas | 5 calls | <30s |
| PR (CI) | golden completo + 50 ataques DeepTeam | 130 calls | 3-5min |
| nightly cron | golden completo + 500 ataques + perf | ~600 calls | 25-40min |
| manual | todo + drift analysis | ad-hoc | variable |

### 5.4 Observabilidad con Langfuse

Cada interacción genera trace con jerarquía: input_guardrails → planner_llm → retrieve_with_acl → specialist_agent → output_guardrails. Métricas: latencia, tokens, costo por span.

**Detectores de seguridad sobre traces** (background workers):
- `prompt_injection_patterns` — match contra ataques conocidos
- `out_of_scope_access` — tool no autorizado para el agent
- `chunk_outside_namespace` — RAG retrievió chunk de otro user
- `suspicious_output` — PII regex + canary tokens
- `budget_anomaly` — tokens > X% del budget per query

Dispara alerta + audit log + (opcional) bloqueo.

### 5.5 Dashboards Langfuse mínimos

1. **Health** — latencia p50/p95, errores, costo
2. **Quality** — factuality, citation validity, out-of-scope rejection
3. **Safety** — jailbreak block rate, PII leak alerts, crisis detections, anomaly hits
4. **Compliance** — disclaimer presence, audit log volume, GDPR data export requests

### 5.6 A/B safety testing

Al cambiar prompts o subir modelo (Sonnet 4.6 → 4.7):
1. Golden set contra ambos
2. Diff de scores por categoría
3. Si baja factuality o sube pii_leak >5% → no merge
4. Diff documentado en PR como evidencia

---

## 6. Sección 5 — Contrato de extensión vertical (drop-in)

### 6.1 Estructura de directorios

```
src/
├── core/                              ← compartido
│   ├── auth/, orchestrator/, rag/, eval/, audit/, mcp/
│   └── vertical/
│       ├── definition.ts
│       └── registry.ts
└── verticals/
    ├── _shared/
    └── nacionalidad_residencia/       ← MVP
        ├── manifest.ts
        ├── corpus/
        ├── prompts/
        ├── agents/
        ├── tools/
        ├── intake/
        ├── eval/
        ├── ui/
        └── README.md
```

### 6.2 Contrato VerticalDefinition (TypeScript)

Campos clave:
- `slug`, `name`, `description`, `enabled`, `version`
- `corpus`: namespace + sources + ingestionPipeline
- `agents`: { normativa: AgentSpec (req), eligibility?: AgentSpec, ...customAgents }
- `intake`: { schema (Zod), formFields }
- `tools`: () => Promise<ToolDefinition[]>
- `eval`: { goldenSet, thresholds, minGoldenSetSize }
- `ui`: { icon, color, landing, intakeOrder }
- `reminders`: ReminderTemplate[]

### 6.3 Pre-flight check al boot

Server no arranca si algún vertical activo tiene:
- Prompts vacíos o muy cortos
- Tools mal formados
- Golden set < `minGoldenSetSize`
- Intake schema no es Zod válido
- Namespace de Chroma faltante

CI corre el mismo check.

### 6.4 Cómo añadir un vertical nuevo (Future Work)

1. `mkdir src/verticals/<slug>` y copiar plantilla
2. Editar manifest.ts
3. Reemplazar corpus/data
4. Reescribir prompts
5. Crear tools específicos
6. Crear golden_set.json (≥40 cases)
7. Activar en registry.ts
8. `pnpm eval --vertical=<slug>` y `pnpm preflight`

**Tiempo estimado por vertical adicional**: 30-50h (vs 250-350h del primer vertical que construye el chasis).

---

## 7. Sección 6 — Despliegue y Docker

### 7.1 Servicios (docker-compose.yml)

- `web` — Next.js 15 :3000
- `api` — Fastify :4000
- `mcp-server` — Node :4001
- `postgres` — :5432 con pgcrypto extension
- `chroma` — :8000 con basic auth
- `minio` — :9000 + console :9001
- `langfuse` + `langfuse-db` — :3001
- `eval-runner` — cron interno
- `n8n` (Future Work, profile-gated)
- `caddy` — :80, :443 reverse proxy con TLS auto

### 7.2 Network segmentation

- `frontend-net`: web, api, mcp, caddy
- `data-net`: postgres, chroma, minio, langfuse-db
- API es puente entre las dos redes

### 7.3 CI/CD pipeline (GitHub Actions)

**ci.yml** (cada push/PR):
- lint + typecheck
- test:unit + test:integration
- preflight-verticals
- eval-smoke
- red-team CI (50 attacks)
- iBOM generation
- pnpm audit + trivy container scan

**nightly.yml** (3 AM):
- eval full (golden completo)
- red-team full (500 attacks)
- publish report

### 7.4 Deploy target

VPS pequeño en EU (Hetzner Alemania, Contabo Alemania) — 2 vCPU, 4 GB RAM, 80 GB disco, ~5-15€/mes.

URL real para defensa: `lexia.tudominio.es`.

### 7.5 Backups

- Postgres: `pg_dump` cada 24h → MinIO local + sync nocturno cifrado a Backblaze B2 EU
- Chroma: dump volumen + reindex script (corpus reproducible)
- MinIO: replicación a B2 con `mc mirror`
- Restore drill: `runbooks/disaster_recovery.md`, ejecutar antes de defensa

### 7.6 Health checks + monitoring

- `/health` (status: ok/degraded/down)
- `/health/deep` (valida DB, Chroma, LLM provider)
- Uptime Kuma self-hosted
- Alertas a email si: 3 failures consecutivos, p95 > 12s, PII leak detected, canary aparece

---

## 8. Sección 7 — Roadmap 7 meses

### 8.1 Bandwidth assumption

| Período | h/sem | Razón |
|---|---|---|
| Sem 1-4 | ~15h | Clio onboarding + master cerrando |
| Sem 5-12 | ~8h | Clio en pleno laburo |
| Sem 13-20 | ~10h | Steady state Clio |
| Sem 21-27 | ~12h | Push features finales |
| Sem 28-30 | ~20h | Sprint final + defensa |

**Total: ~340h** sobre 30 semanas.

### 8.2 Las 8 fases

#### Fase 0 — Setup (sem 1, ~15h)
- Confirmar deadline con coordinación del máster
- Repo monorepo (pnpm workspaces): `apps/web`, `apps/api`, `apps/mcp`, `packages/core`
- CI scaffolding (lint/typecheck/test/audit/trivy)
- `docker-compose.dev.yml` corriendo localmente
- Drizzle schema inicial
- Better Auth básico
- Spec doc commiteado + iBOM esqueleto
- AI Act risk classification doc

#### Fase 1 — Foundations (sem 2-4, ~45h)
- API routes principales + audit log
- Web app: layout + chat UI con eco fake
- Chroma cliente + namespaces
- MinIO cliente + endpoint de uploads
- Vertical contract + manifest skeleton de `nacionalidad_residencia`
- Pre-flight check en CI
- Email verification mandatoria
- Password policy + HIBP check + throttle
- **Privacy Policy + ToS + Aviso Legal**
- **Subprocessors.md + análisis SCCs**

#### Fase 2 — Single-agent + RAG MVP (sem 5-7, ~25h)
- Ingestion pipeline: BOE, Código Civil, instrucciones DGRN
- ~1500 chunks indexados con metadata + ACL
- NormativaAgent único con LangChain
- Tool `search_corpus` con `retrieveWithACL`
- Input guardrails: regex PII + keyword blocklist
- Output guardrails: citation enforcer básico + disclaimer injection
- **Disclosure "soy IA"** al inicio de conversación
- 20 golden test cases manuales

#### Fase 3 — Multi-agente con LangGraph (sem 8-11, ~32h)
- Refactor a LangGraph: TriageAgent + NormativaAgent + EligibilityAgent
- TriageAgent con structured output
- EligibilityAgent: tool `compute_eligibility(country, arrival_date, residence_type)`
- Langfuse traces completas
- 40 golden test cases
- Detector worker básico
- **Field-level encryption** en `cases.notes` y `cases.country_origin`

#### Fase 4 — Security hardening + dual-LLM (sem 12-15, ~32h)
- Dual-LLM pattern completo (Planner + Specialist + Validator)
- Output guardrails completos
- ACL refinada en chunks privados
- Sanitización de PDFs en upload
- **Crisis detection** + recursos CEAR/016
- **Per-user budget** + endpoint `/me/usage`
- NHIs por agente en audit log
- **Canary tokens** en system prompts
- **Special category data minimization** (GDPR Art. 9)
- **Redaction de queries en audit log** cuando guardrail bloquea
- **DPIA — primer draft**

#### Fase 5 — CCSE + completar vertical (sem 16-19, ~40h)
- Ingestión manual oficial CCSE
- ccse_questions bank (50-80 preguntas, mix manual + LLM)
- CCSE quality gate (dashboard mínimo de revisión)
- CCSEAgent + tools `generate_ccse_quiz`, `evaluate_ccse_answer`
- Quiz UI en frontend
- Reminder template "incluí a hijos antes de la jura" + 3 más
- Reminders por email (cron interno)
- 60 golden test cases
- **Tool `request_human_review`** + flujo

#### Fase 6 — MCP server + dual surface (sem 20-23, ~36h)
- MCP server en Node con `@modelcontextprotocol/sdk`
- Tools profesionales expuestos
- **Auth + scopes obligatorios** en MCP (PAT + verificación de colegiación)
- Doc para gestores
- Audit log diferencia surfaces

#### Fase 7 — Eval rigurosa + observabilidad (sem 24-27, ~36h)
- Pipeline de eval con 4 jueces
- Golden set a 80 casos
- **Red teaming en CI con DeepTeam**
- Thresholds en CI bloquean merge
- Dashboards Langfuse: Health, Quality, Safety, Compliance
- **iBOM generation** en cada release
- A/B safety testing framework
- **Model Card de Lexia**

#### Fase 8 — Polish + deploy + defensa (sem 28-30, ~30h)
- Deploy a VPS EU
- TLS + Caddy + dominio real
- Backup drill ejecutado
- N8N (best effort, marcar demo si no llega)
- Docs: README, ADRs, READMEs por package
- **Runbooks: incident response + breach notification 72h**
- DPIA finalizado
- Slides + script de defensa
- Rehearsal con vos en rol de tribunal

### 8.3 Hitos de comunicación con tutor

| Sem | Comunicación |
|---|---|
| 1 | Spec doc + pedir aprobación + confirmar deadline |
| 5 | Demo F1 — foundations + chat eco |
| 11 | Demo F3 — multi-agente |
| 19 | Demo F5 — CCSE + vertical completo |
| 27 | Demo F7 — eval + dashboards |
| 30 | Defensa final |

### 8.4 Matriz de recorte (Tier 0 = INTOCABLE)

```
Tier 2 — Drop primero (cuesta menos)
1. N8N entry point (F8)                                ~6h
2. Backup externo a B2 (F8)                            ~3h
3. Multi-provider router (queda solo Claude) (F1)      ~5h
4. Langfuse self-host → Langfuse Cloud free (F6)       ~4h
5. iBOM en CI → manual antes de defensa (F7)           ~6h
6. DeepTeam en CI → solo nightly (F7)                  ~5h
7. Golden set: 80 → 40 casos (F7)                     ~12h
8. Validator LLM (3a llamada) → solo high-risk (F4)    ~8h

Tier 1 — Drop si urge (cuesta más pero defendible)
9. CCSE simulator completo → solo info CCSE (F5)      ~25h
10. EligibilityAgent → solo tool determinista (F3)    ~10h
11. MCP server → mencionar como Future Work (F6)      ~36h
12. Per-user budget (F4)                               ~7h

Tier 0 — INTOCABLE
✅ Auth + DB + audit log (F1)
✅ NormativaAgent con RAG + ACL (F2)
✅ Input + output guardrails básicos (F2-4)
✅ Field-level encryption (F3)
✅ Crisis detection (F4)
✅ Dual-LLM pattern básico (F4)
✅ 40 golden test cases con eval pipeline (F7)
✅ Web app deployable + Docker compose (F8)
✅ Disclaimer enforcement (F2)
✅ Canary tokens (F4)
✅ pnpm audit + trivy (F0)
✅ Email verification + password policy (F1)
✅ Privacy Policy + ToS + Aviso Legal (F1)
✅ Disclosure "soy IA" (F2)
✅ AI Act risk classification doc (F0)
✅ DPIA (F4-F8)
✅ Model Card (F7)
✅ Runbooks IR + breach (F8)
✅ EU-only hosting (F8)
✅ Verificación obligatoria de role professional si MCP existe (F6)
```

**Tier 0 alone**: ~170h — el "MVP defendible" mínimo.

---

## 9. Compliance — AI Act + GDPR + LSSI-CE

### 9.1 AI Act risk classification

**Lexia se clasifica como sistema de RIESGO LIMITADO** bajo Article 50 del AI Act (transparency obligations).

**Justificación de NO ser high-risk** (Annex III):
- Annex III ítem 7 ("AI systems intended to be used by competent public authorities... in the management of migration, asylum and border control") aplica a **autoridades públicas**, no a herramientas privadas para individuos.
- Lexia es B2C (uso privado) y B2B no-autoridad (gestores privados via MCP).
- Lexia no toma decisiones administrativas — es informativa.

**Roles bajo AI Act**:
- **Provider de Lexia** (sistema de IA en sí): obligaciones de technical documentation, post-market monitoring, transparency, conformity assessment.
- **Deployer de Claude / GPT** (modelos de terceros usados internamente): no hace fine-tuning sustancial → no cae en trampa Deployer-to-Provider.

**Article 50 obligations cumplidas**:
- Disclosure "soy IA" al inicio de cada conversación
- Privacy policy explicita uso de IA
- Onboarding lo aclara antes del primer chat

### 9.2 GDPR compliance

| Artículo | Obligación | Implementación |
|---|---|---|
| Art. 6 | Lawful basis | 6(1)(b) — performance of contract (registro = ToS) |
| Art. 9 | Special categories | Special category data minimization en pipeline |
| Art. 13 | Información en momento de recogida | Privacy policy + onboarding |
| Art. 17 | Right to erasure | `/me/delete` endpoint con cascade |
| Art. 20 | Data portability | `/me/export` endpoint |
| Art. 22 | Right to human review | Tool `request_human_review` |
| Art. 25 | Privacy by design | Cifrado field-level + ACL + PII redaction |
| Art. 30 | Records of processing | `docs/records_of_processing.md` |
| Art. 32 | Security measures | Capítulo 4 de este spec |
| Art. 33 | Breach notification 72h | `runbooks/breach_notification.md` |
| Art. 35 | DPIA | Entregable del proyecto |
| Art. 44-49 | Cross-border transfers | SCCs documentados con Anthropic + OpenAI; transfer impact assessment |

**DPO**: no requerido inicialmente (procesamiento no a "large scale"). Documentado y revisable.

### 9.3 LSSI-CE (Ley de Servicios de la Sociedad de la Información)

- Aviso legal con info del proveedor (nombre, CIF si corresponde, contacto, registro)
- Cookie banner si se usan cookies no estrictamente necesarias
- ToS define el contrato

### 9.4 Población vulnerable

Lexia documenta consideraciones para **población vulnerable** (inmigrantes, personas en proceso migratorio):
- Crisis detection es parte de la protección
- Lenguaje accesible deliberado (Tone Judge mide)
- Derivación facilitada a CEAR / Cruz Roja / abogado de oficio
- Disclaimer "no sustituye abogado" especialmente reforzado
- Edad mínima 18+ verificada en registro

Sección formal en Model Card y DPIA.

### 9.5 Subprocesadores

Listado en `docs/subprocessors.md`:
- **Anthropic** — LLM provider (US, SCCs en lugar)
- **OpenAI** — embeddings + fallback (US, SCCs en lugar)
- **Hetzner Online GmbH** — hosting (Alemania, EU)
- **Backblaze B2** — backups (EU region)
- **Resend / Postmark** — email transaccional (EU si posible)

---

## 10. Entregables del proyecto

Más allá del código:

- ✅ **Código fuente** del monorepo (web + api + mcp + core + verticals)
- ✅ **docker-compose.yml** + Dockerfiles (4 imágenes)
- ✅ **Spec document** (este archivo)
- ✅ **README** del proyecto + READMEs por package
- ✅ **ADRs** (Architecture Decision Records) en `docs/adrs/`
- ✅ **Privacy Policy + ToS + Aviso Legal** (`docs/legal/`)
- ✅ **DPIA** — Data Protection Impact Assessment (`docs/compliance/dpia.md`)
- ✅ **Model Card de Lexia** (`docs/MODEL_CARD.md`)
- ✅ **iBOM** (CycloneDX) en `artifacts/lexia.cdx.yaml`
- ✅ **Subprocessors.md** + transfer impact assessment (`docs/compliance/`)
- ✅ **Records of processing activities** (`docs/compliance/records_of_processing.md`)
- ✅ **Runbooks**: incident response, breach notification 72h, disaster recovery (`runbooks/`)
- ✅ **Golden set** versionado (`tests/eval/golden_set.v1.json`)
- ✅ **Eval reports** (HTML/PDF generados desde Langfuse)
- ✅ **Demo deployment** en URL real (`lexia.tudominio.es`)
- ✅ **Slides + script de defensa**

---

## 11. Riesgos identificados

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Clio absorbe más bandwidth del previsto | Media | Alto | Matriz de recorte preparada, Tier 0 protegido |
| R2 | Cambio de modelo (Sonnet 4.6 → 4.7) durante el proyecto | Alta | Medio | A/B safety testing framework, model pinned en config |
| R3 | Cambio normativo en extranjería durante el proyecto | Baja | Medio | Corpus versionado, re-ingest job documentado |
| R4 | Costo LLM excede presupuesto personal | Media | Medio | Per-user budget + monitoring de costo + cap mensual |
| R5 | Bug crítico antes de defensa | Media | Alto | Feature flags + deploy semanal estable + rollback drill |
| R6 | Tutor pide cambio mayor de scope | Baja | Alto | Checkpoints cada 6 sem, no más |
| R7 | Deadline real más corto que 7 meses | Alta | Crítico | Confirmar Sem 1 + matriz de recorte para escenario A (30 días) |
| R8 | Ataque real con prompt injection en producción | Baja | Medio | Capas múltiples + DeepTeam regression + canary tokens |
| R9 | Filtración de PII por bug | Baja | Crítico | Cifrado field-level + ACL + audit log + breach plan 72h |
| R10 | Verificación de colegiación profesional inmanejable | Media | Medio | MVP con verificación manual; automatización Future Work |

---

## 12. Future Work (no incluido en este Capstone)

- Verticales adicionales: arraigo (todos los tipos), reagrupación familiar, asilo (con cuidado especial)
- Multilingüe (inglés primero — para filipinos y ex-pats)
- N8N integration completa con WhatsApp/Telegram
- Vault o equivalente para rotación automática de credenciales (NHIs principio 4)
- 2FA mandatorio
- Protocolo A2A entre agentes externos
- Audit log con hash-chain (append-only verificable)
- Container image signing (Cosign)
- Network mesh con mTLS entre servicios
- Posts públicos de canary tokens (search engine monitoring)
- ISO 42001 certification track
- Notificaciones push en mobile

---

## 13. Referencias

### Frameworks y estándares
- AI Act (Reglamento UE 2024/1689) — Article 50, Annex III
- GDPR (Reglamento UE 2016/679) — Articles 6, 9, 13, 17, 20, 22, 25, 30, 32, 33, 35, 44-49
- LSSI-CE (Ley 34/2002)
- LOPDGDD (Ley Orgánica 3/2018)
- ISO/IEC 42001 (gestión de IA, no se certifica pero alinea governance)
- AI Control Matrix (Cloud Security Alliance) — 243 controles
- OWASP LLM Top 10 (2025)
- OWASP Agentic Top 10 (Dec 2024)
- OWASP LLMSecOps Framework
- MITRE ATLAS
- CycloneDX (iBOM standard)

### Domain knowledge — extranjería España
- Código Civil, Art. 17-26 (nacionalidad)
- RD 557/2011 (Reglamento de Extranjería)
- Ley 12/2009 (asilo, Future Work)
- Instrucciones DGRN sobre nacionalidad por residencia
- Manual oficial CCSE (Instituto Cervantes)

### Frameworks técnicos
- Lethal Trifecta (Simon Willison)
- Dual-LLM pattern (Simon Willison)
- LangGraph (LangChain)
- Model Context Protocol (Anthropic)
- Better Auth
- Drizzle ORM
- Chroma vector DB
- Langfuse observability
- DeepTeam red teaming
- CycloneDX

### Material de clase del máster
- 1.x Foundations: NLP, transformers, prompting, providers
- 2.1 Agentic DevOps
- 2.3 RAG (Pinecone, Chroma, chunking, hybrid search, re-ranking)
- 2.4 MCP Protocol
- 3.x Plataformas, evaluación, ciclo de vida de agentes
- 4.3 P3 — Guardrails y Red Teaming (Iraitz)
- 4.4 — Seguridad y gobierno corporativo de IA (Román Mesa)

---

> **Decisiones de diseño abiertas pendientes** (a confirmar antes de implementación):
> - Confirmación de deadline real con coordinación del máster (R7)
> - Validación de SCCs vigentes con Anthropic y OpenAI (Sem 1)
> - Elección final de proveedor de email transaccional (Resend vs Postmark, decidir en F1)
> - Provider de hosting EU específico (Hetzner vs Contabo, decidir en F8)

---

*Fin del documento. Siguiente paso: spec review loop con `spec-document-reviewer`, luego `writing-plans` skill para plan de implementación.*
