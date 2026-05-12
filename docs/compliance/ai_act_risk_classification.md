# Lexia — AI Act Risk Classification

| Campo                 | Valor                                                  |
| --------------------- | ------------------------------------------------------ |
| Sistema               | Lexia — Asistente informativo de extranjería           |
| Versión del documento | 0.1.0                                                  |
| Fecha                 | 2026-05-01                                             |
| Estado                | Draft (revisión obligatoria antes de Fase 8 / defensa) |
| Autor                 | Facundo Herrera                                        |

## 1. Clasificación

**Lexia se clasifica como sistema de IA de RIESGO LIMITADO** bajo el AI Act
(Reglamento UE 2024/1689), Article 50 — _Transparency obligations for
providers and deployers of certain AI systems_.

## 2. Justificación de NO ser high-risk (Annex III)

Annex III ítem 7 lista AI systems "intended to be used by competent public
authorities... in the management of migration, asylum and border control".

Lexia **no cae en este supuesto** porque:

- Lexia es un sistema **B2C** dirigido a personas que están en proceso
  migratorio en España — no es operado por autoridades públicas.
- La superficie B2B (servidor MCP) está dirigida a **gestores y abogados
  privados**, no a autoridades públicas.
- Lexia **no toma decisiones administrativas** ni emite actos formales.
  Es estrictamente informativa: explica procedimientos, requisitos y plazos
  con citas a fuentes oficiales.
- Lexia no automatiza concesión, denegación o tramitación de expedientes.

## 3. Roles bajo AI Act

| Rol                         | Quién                                    | Obligaciones aplicables                                                                 |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Provider                    | Lexia (Facundo Herrera, capstone)        | Article 50 transparency · technical documentation · post-market monitoring proporcional |
| Deployer of upstream models | Lexia, al usar Anthropic Claude / OpenAI | No fine-tuning sustancial — no se promueve a Provider de un nuevo modelo                |

## 4. Article 50 — Cumplimiento

| Obligación                                                                              | Implementación en Lexia                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Disclosure clara de que el usuario interactúa con IA                                    | Primer mensaje de cada conversación; onboarding pre-chat; privacy policy              |
| Marca de contenido sintético en outputs (cuando aplica)                                 | Lexia produce solo respuestas conversacionales — no genera media sintética; no aplica |
| Notificación de uso de sistemas de reconocimiento emocional / categorización biométrica | No aplica — Lexia no hace ninguno de los dos                                          |

## 5. Otros frameworks alineados

- **GDPR**: ver `docs/compliance/dpia.md` (creado en Fase 4).
- **LSSI-CE**: aviso legal en `docs/legal/aviso_legal.md` (Fase 1).
- **OWASP LLM Top 10 (2025)**: cobertura técnica en spec §4.
- **OWASP Agentic Top 10 (Dec 2024)**: cobertura técnica en spec §4.4.

## 6. Decisión revisable

Esta clasificación se reabre si en el futuro:

- Lexia comienza a tomar decisiones automatizadas con efecto jurídico.
- Lexia es operado o licenciado a una autoridad pública.
- Lexia añade reconocimiento emocional, biométrico o profiling sustancial.

En tales casos, reconsiderar Annex III y re-clasificar antes del cambio.
