# DPIA — Data Protection Impact Assessment

**Proyecto:** Lexia — Asistente informativo de extranjería  
**Versión:** 1.0 (final)  
**Fecha:** 2026-06-07  
**Responsable:** Facundo Herrera  
**Base legal aplicable:** GDPR Art. 35, LOPDGDD

---

## 1. Descripción del tratamiento

| Campo                          | Detalle                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nombre del tratamiento         | Asistencia informativa sobre nacionalidad española por residencia                                                                                                                                |
| Responsable del tratamiento    | Facundo Herrera (proyecto educativo Máster IA Generativa)                                                                                                                                        |
| Finalidad principal            | Responder preguntas sobre el proceso de obtención de nacionalidad española                                                                                                                       |
| Base jurídica                  | Consentimiento explícito del usuario (Art. 6.1.a GDPR)                                                                                                                                           |
| Categorías de datos tratados   | Datos identificativos (email, nombre), datos de inmigración (país de origen, fecha de llegada, estado de residencia), historial de conversaciones                                                |
| Categorías especiales (Art. 9) | Posiblemente implícitas en consultas de asilo, religión, orientación sexual — minimizadas por guardrail                                                                                          |
| Destinatarios                  | Ninguno (no se comparten datos con terceros, excepto procesadores: Anthropic API, Langfuse self-hosted)                                                                                          |
| Transferencias internacionales | Anthropic API (USA) — cubierto por SCCs y Transfer Impact Assessment. Langfuse self-hosted en EU (Hetzner Alemania). OpenAI API (fallback, USA) — SCCs.                                          |
| Período de retención           | Conversaciones: 2 años desde último acceso. Documentos: 1 año. Audit log: 3 años.                                                                                                                |
| Tratamiento adicional (Fase 6) | Verificación de colegiación profesional. Base: consentimiento explícito del gestor al solicitar acceso profesional. Datos: número de colegiación, cuerpo colegiado. No se comparte con terceros. |
| Tratamiento adicional (Fase 7) | Eval pipeline: almacena métricas de calidad del sistema en `eval_runs`. No contiene datos de usuarios reales — solo casos sintéticos del golden set.                                             |

---

## 2. Necesidad y proporcionalidad

| Criterio                                        | Evaluación                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ¿Es necesario el tratamiento para la finalidad? | Sí. Sin historial de conversación no puede darse contexto continuado. Sin caso del usuario, no puede calcularse elegibilidad. |
| ¿Podría lograrse con menos datos?               | Mínimamente. Los datos de caso son opcionales; la conversación es la unidad mínima necesaria.                                 |
| ¿Es proporcional el tratamiento?                | Sí. Los datos recopilados son los estrictamente necesarios para el servicio informativo.                                      |
| ¿Existe base jurídica adecuada?                 | Sí: consentimiento (onboarding explícito con ToS y Privacy Policy antes del primer uso).                                      |
| ¿Se informó a los interesados?                  | Sí: Privacy Policy visible, aviso "soy IA" en primer mensaje (AI Act Art. 50).                                                |

---

## 3. Riesgos identificados

| ID  | Riesgo                                                        | Probabilidad | Impacto | Medida de mitigación                                                  | Riesgo residual |
| --- | ------------------------------------------------------------- | ------------ | ------- | --------------------------------------------------------------------- | --------------- |
| R1  | Filtración de PII por bug de código                           | Baja         | Alto    | Field-level AES-256-GCM, ACL por usuario en Chroma, audit log         | Bajo            |
| R2  | Exposición de datos por prompt injection                      | Baja         | Medio   | Dual-LLM pattern, canary tokens, input guardrails 4 pasos             | Bajo            |
| R3  | Inferencia de categorías especiales desde consultas           | Media        | Medio   | Special category minimizer (GDPR Art. 9), no persistencia en claro    | Bajo-Medio      |
| R4  | Acceso no autorizado a datos de otro usuario                  | Muy baja     | Crítico | Auth obligatoria, ACL user_id en todas las queries                    | Muy bajo        |
| R5  | Transferencia internacional inadecuada (Anthropic/OpenAI USA) | Baja         | Alto    | SCCs vigentes, Transfer Impact Assessment, EU-only hosting            | Bajo            |
| R6  | Retención excesiva de datos de conversación                   | Media        | Medio   | Política de retención documentada, endpoint /me/account DELETE        | Bajo            |
| R7  | Consejo jurídico accionable generado por LLM                  | Media        | Medio   | Legal advice detector (output step 2), Validator LLM, canned response | Bajo            |
| R8  | Breach de base de datos                                       | Muy baja     | Crítico | Cifrado field-level, acceso restringido, plan breach 72h              | Bajo            |

---

## 4. Medidas técnicas y organizativas implementadas

### Técnicas (implementadas en Fases 0–7)

- **Cifrado en tránsito**: TLS 1.3 (Caddy reverse proxy)
- **Cifrado en reposo**: Field-level AES-256-GCM para `cases.country_origin`, `cases.notes`, `documents.filename`
- **Autenticación**: Better Auth con email verification, password HIBP check, session management
- **Guardrails de entrada (4 pasos)**: regex PII redactor → keyword blocklist → LLM-judge jailbreak → special category minimizer
- **Guardrails de salida (4 pasos)**: citation enforcer → legal advice detector → PII output redactor → disclaimer injector
- **Dual-LLM pattern**: Planner (privilegiado) → Specialist (cuarentenado) → Validator (tercer LLM)
- **Audit log**: Registro completo con `actor_type`, `actor_id`, `action`, `trace_id`; queries bloqueadas almacenadas como `[REDACTED]`
- **Canary tokens**: Tokens secretos en system prompts, detector worker diario
- **Crisis detection**: Detección de vulnerabilidad + recursos CEAR/016 automáticos
- **Per-user budget**: Límite 50k tokens/mes (anti-abuso + control de costes)
- **PDF sanitization**: Rechazo de PDFs con JavaScript embebido
- **NHI logging**: Identidad de cada agente con scopes en audit_log
- **Right to erasure**: DELETE /api/me/account elimina todos los datos en cascada
- **Data portability**: GET /api/me/export exporta todos los datos del usuario
- **EU-only hosting**: Hetzner Alemania (objetivo producción)
- **MCP Professional Auth** (Fase 6): PAT con SHA-256 hash, verificación de colegiación manual, `surface='mcp'` en audit log, revocación instantánea por DB lookup
- **Eval pipeline audit** (Fase 7): Resultados de eval en `eval_runs` no contienen PII — solo inputs sintéticos del golden set

### Organizativas

- Aviso "soy IA" en primer mensaje de cada conversación (AI Act Art. 50)
- Disclaimer persistente inyectado por outputPipeline (no removible por prompt injection)
- AI Act risk classification: Riesgo limitado, no Anexo III
- Política de retención de datos documentada en Privacy Policy

---

## 5. Consulta a interesados

Al ser un proyecto educativo en fase de desarrollo, la consulta formal no se ha realizado. Se han incorporado consideraciones de diseño centradas en el usuario: onboarding claro, opción de eliminar cuenta, exportación de datos, y comunicación empática en crisis.

---

## 6. Conclusión

El tratamiento presenta **riesgo residual bajo** tras la aplicación de las medidas técnicas y organizativas descritas. No se identifica riesgo alto residual que requiera consulta previa a la autoridad de control (AEPD) conforme al Art. 36 GDPR.

**Versión 1.0 (2026-06-07):** DPIA finalizado para defensa del capstone. Todas las fases (0–8) implementadas. Riesgo residual bajo confirmado.

**Próxima revisión:** ante cualquier cambio sustancial de tratamiento (nuevo vertical, nuevos procesadores, cambio de hosting).
