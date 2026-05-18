# Política de Privacidad — Lexia

**Versión:** 0.1.0  
**Fecha:** 2026-05-14  
**Estado:** Draft (revisión obligatoria antes de deploy en producción)

## 1. Responsable del tratamiento

Facundo Herrera — facundhfed@gmail.com (Capstone académico, no empresa registrada).

## 2. Datos que recopilamos

| Categoría          | Datos                                               | Finalidad                 | Base legal (RGPD)                    |
| ------------------ | --------------------------------------------------- | ------------------------- | ------------------------------------ |
| Cuenta             | Email, nombre, contraseña (hash)                    | Autenticación             | Art. 6(1)(b) — ejecución de contrato |
| Caso               | País de origen, fecha llegada, situación residencia | Personalización asistente | Art. 6(1)(b)                         |
| Conversaciones     | Mensajes de texto                                   | Prestación del servicio   | Art. 6(1)(b)                         |
| Documentos         | Archivos PDF/DOCX subidos                           | Indexación para RAG       | Art. 6(1)(b)                         |
| Registros técnicos | IP (hasheada), user-agent                           | Seguridad y auditoría     | Art. 6(1)(f) — interés legítimo      |

**Datos de categoría especial (Art. 9 RGPD):** Lexia puede recibir información sobre
situaciones de vulnerabilidad. Se aplica minimización: no se persiste el contenido
plano cuando los guardrails de input detectan datos especiales.

## 3. Subprocesadores

Ver `docs/compliance/subprocessors.md` para la lista completa.

Los modelos de lenguaje (Anthropic Claude, OpenAI) procesan los mensajes del usuario.
Las transferencias internacionales están cubiertas por las SCCs de cada proveedor.

## 4. Derechos del usuario

Bajo el RGPD tenés derecho a:

- **Acceso** (Art. 17): endpoint `/api/me/export`
- **Supresión** (Art. 17): endpoint `/api/me/account` (DELETE)
- **Portabilidad** (Art. 20): endpoint `/api/me/export`
- **Oposición / Limitación** (Arts. 21-22): contactar a facundhfed@gmail.com

## 5. Retención

- Datos de cuenta y caso: hasta que el usuario elimine su cuenta.
- Audit log: 1 año (en forma parcialmente hasheada).
- Conversaciones: hasta que el usuario las elimine o cierre su cuenta.

## 6. Seguridad

- Contraseñas: hash bcrypt gestionado por Better Auth.
- Datos sensibles en DB: cifrado field-level con pgcrypto (Fase 3).
- Transporte: HTTPS en producción.
- Auditoría: toda acción queda registrada en `audit_log`.

## 7. Cookies

Lexia utiliza una cookie de sesión (`better-auth.session`) estrictamente necesaria
para la autenticación. No utiliza cookies de seguimiento ni publicidad.

## 8. Menores

Lexia no está dirigido a menores de 18 años. Si tenés menos de 18, no uses el servicio.

## 9. Cambios en esta política

Se notificará por email ante cambios materiales. La fecha de versión se actualiza en
cada revisión.

## 10. Contacto DPO

No se requiere DPO según el Art. 37 RGPD (procesamiento no a gran escala). Para
consultas de privacidad: facundhfed@gmail.com.
