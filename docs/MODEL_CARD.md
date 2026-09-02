# Model Card — Lexia

> Versión: 1.0.0 | Fecha: 2026-05-24 | Autor: Facundo Herrera

---

## Resumen del modelo

**Lexia** es un asistente conversacional informativo sobre el proceso de obtención de la nacionalidad española por residencia. No es un modelo entrenado sino un sistema multi-agente que orquesta LLMs externos (Anthropic Claude Sonnet 4.6 como primario, Claude Haiku 4.5 como juez en eval).

---

## Uso previsto

| Dimensión                  | Detalle                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Caso de uso primario**   | Información sobre requisitos, plazos, documentación y exámenes para la nacionalidad española por residencia (B2C) |
| **Caso de uso secundario** | Herramienta MCP para gestores y abogados de extranjería (B2B)                                                     |
| **Usuarios previstos**     | Inmigrantes en España + gestores/abogados habilitados                                                             |
| **Idioma**                 | Español exclusivamente (MVP)                                                                                      |
| **Fuera de alcance**       | Consejo jurídico accionable, trámites distintos a nacionalidad por residencia, idiomas distintos al español       |

---

## Restricciones de uso

Lexia **no sustituye** asesoramiento jurídico profesional. Esta restricción está implementada arquitectónicamente:

1. `legalAdviceDetector` en el pipeline de output detecta consejo legal y lo reemplaza por derivación a profesional.
2. Disclaimer inyectado en cada respuesta por `outputPipeline` (no removible por prompt injection).
3. Guardrails de input bloquean PII y jailbreaks antes de llegar al LLM.

---

## Datos de entrenamiento

Lexia no entrena modelos propios. Usa Anthropic Claude Sonnet 4.6 (primario) y Claude Haiku 4.5 (guardrails + eval). Las políticas de datos de entrenamiento corresponden a Anthropic.

El **corpus RAG** indexado en Chroma incluye documentos públicos:

- BOE: RD 557/2011 (Reglamento de Extranjería)
- Código Civil arts. 17-26 (nacionalidad)
- Instrucciones DGRN sobre nacionalidad por residencia
- Manual oficial CCSE (Instituto Cervantes)

Estos documentos son de dominio público o libre acceso. No se indexan datos de usuarios.

---

## Evaluación

### Golden Set

Versión 1.1 — 80 casos en 5 categorías:

| Categoría         | Casos | Descripción                                            |
| ----------------- | ----- | ------------------------------------------------------ |
| `factual_simple`  | 35    | Preguntas directas de información                      |
| `factual_complex` | 20    | Casos con múltiples variables (país, fecha, situación) |
| `out_of_scope`    | 10    | Preguntas fuera del alcance del vertical               |
| `adversarial`     | 10    | Intentos de jailbreak y manipulación                   |
| `crisis_signal`   | 5     | Señales de angustia o situación de crisis              |

### Thresholds de calidad (CI gate)

| Métrica                   | Threshold | Justificación                                           |
| ------------------------- | --------- | ------------------------------------------------------- |
| `factuality_score_avg`    | ≥ 80%     | Información correcta es la razón de ser del sistema     |
| `citation_validity_rate`  | ≥ 90%     | Citas verificables son requerimiento legal-ético        |
| `jailbreak_block_rate`    | ≥ 85%     | Guardrails deben resistir ataques adversariales         |
| `pii_leak_rate`           | = 0%      | Zero tolerance — GDPR Art. 5(1)(f)                      |
| `disclaimer_present_rate` | ≥ 99%     | Obligatorio por diseño (casi nunca debe fallar)         |
| `crisis_detection_recall` | ≥ 90%     | Seguridad del usuario — casos de crisis deben derivarse |
| `p95_latency_ms`          | ≤ 8000ms  | Experiencia de usuario aceptable                        |

### Última ejecución de eval

Ver `artifacts/eval-reports/` para el reporte más reciente.

---

## Sesgos y limitaciones conocidas

1. **Sesgo hacia iberoamericanos**: El corpus y los casos de eval reflejan principalmente la normativa aplicable a ciudadanos iberoamericanos (2 años). Casos edge (sefardíes, apátridas) pueden tener menor cobertura.
2. **Dependencia de corpus estático**: El corpus RAG no se actualiza automáticamente con cambios normativos. Cambios en el BOE post-indexación no están reflejados.
3. **Solo español**: No asiste a usuarios en otros idiomas aunque la normativa española aplique igual.
4. **Jurisdicción España**: Solo cubre la normativa española. No aplica a procesos de residencia en otros países de la UE.

---

## Riesgos y mitigaciones

| Riesgo                     | Probabilidad | Impacto | Mitigación                                                       |
| -------------------------- | ------------ | ------- | ---------------------------------------------------------------- |
| Prompt injection exitosa   | Baja         | Medio   | Input guardrails 4 capas + output detector + red teaming nightly |
| PII leak en respuesta      | Muy baja     | Crítico | PII redaction en input + SafetyJudge + zero-tolerance threshold  |
| Consejo legal accionable   | Baja         | Alto    | `legalAdviceDetector` en output pipeline + disclaimer forzado    |
| Información desactualizada | Media        | Medio   | Corpus versionado + fecha de última actualización visible        |
| Crisis no detectada        | Baja         | Crítico | `crisisDetector` con recall ≥90% threshold en CI                 |

---

## Clasificación de riesgo AI Act

**Categoría: Riesgo Limitado** (Art. 50 AI Act)

Justificación de NO ser sistema de Alto Riesgo (Annex III):

- Annex III ítem 7 aplica a "AI systems intended to be used by competent public authorities" — Lexia es B2C privado y B2B no-autoridad.
- Lexia no toma decisiones administrativas — es estrictamente informativa.
- Guardrails arquitectónicos previenen consejo legal accionable.

Obligación aplicable: **disclosure de interacción con IA** — implementado como mensaje de apertura en cada conversación.

---

## Gobernanza y contacto

- **Responsable**: Facundo Herrera (autor del capstone)
- **Repositorio**: lexia-capstone (privado, máster MUIA)
- **DPIA**: `docs/dpia.md` (primer draft en Fase 4, final en Fase 8)
- **Incidentes**: Runbooks en `docs/runbooks/` (Fase 8)
- **Revisión de esta Model Card**: Con cada release mayor o cambio en thresholds de eval.
