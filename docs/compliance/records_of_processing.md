# Registro de Actividades de Tratamiento — Lexia

**Responsable:** Facundo Herrera (facundhfed@gmail.com)  
**Marco legal:** RGPD Art. 30  
**Versión:** 0.1.0  
**Fecha:** 2026-05-14

## Actividades de tratamiento

### 1. Gestión de cuentas de usuario

| Campo                          | Detalle                                                |
| ------------------------------ | ------------------------------------------------------ |
| Finalidad                      | Autenticación y gestión de acceso                      |
| Categorías de datos            | Email, nombre, contraseña (hash), fecha registro       |
| Categorías de afectados        | Usuarios registrados (mayores de 18)                   |
| Destinatarios                  | Anthropic/OpenAI (modelos LLM para procesar consultas) |
| Transferencias internacionales | EE.UU. (Anthropic, OpenAI) — SCCs                      |
| Plazo de supresión             | Hasta eliminación de cuenta                            |
| Medidas técnicas               | Hash bcrypt, HTTPS, sesiones con expiración, audit log |

### 2. Procesamiento de consultas (chat)

| Campo                          | Detalle                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Finalidad                      | Proporcionar asistencia informativa sobre extranjería                           |
| Categorías de datos            | Texto libre del usuario, historial conversación, datos del caso                 |
| Posibles categorías especiales | Situación migratoria, potencialmente salud/vulnerabilidad — minimización activa |
| Categorías de afectados        | Usuarios autenticados                                                           |
| Destinatarios                  | Anthropic (Claude Sonnet/Haiku) — procesamiento del mensaje                     |
| Transferencias internacionales | EE.UU. — SCCs                                                                   |
| Plazo de supresión             | Hasta eliminación de cuenta; audit log 1 año                                    |
| Medidas técnicas               | Guardrails input/output, cifrado field-level (F3), redacción de PII en logs     |

### 3. Documentos subidos por usuarios

| Campo                   | Detalle                                                     |
| ----------------------- | ----------------------------------------------------------- |
| Finalidad               | Indexación para RAG personalizado del usuario               |
| Categorías de datos     | Archivos PDF/DOCX (pueden contener PII)                     |
| Categorías de afectados | Usuarios autenticados                                       |
| Almacenamiento          | MinIO (self-hosted)                                         |
| Plazo de supresión      | Hasta eliminación del documento o de la cuenta              |
| Medidas técnicas        | Sanitización pre-indexación (F4), ACL por usuario en Chroma |

### 4. Audit log

| Campo               | Detalle                                                        |
| ------------------- | -------------------------------------------------------------- |
| Finalidad           | Seguridad, detección de incidentes, cumplimiento RGPD          |
| Categorías de datos | actor_id (user ID), acción, timestamp, trace_id; IPs hasheadas |
| Plazo de supresión  | 1 año                                                          |
| Medidas técnicas    | Append-only en DB, acceso restringido a admin                  |

## DPIA requerida?

Sí — el tratamiento de datos migratorios y potenciales datos especiales (Art. 9 RGPD)
para una audiencia vulnerable requiere DPIA. Ver `docs/compliance/dpia.md` (creado en F4).
