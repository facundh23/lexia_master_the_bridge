# Subprocesadores — Lexia

**Versión:** 0.1.0  
**Fecha:** 2026-05-14  
**Estado:** Draft — pendiente validación de SCCs antes de deploy en producción

## Lista de subprocesadores

| Subprocesador | País / Región | Finalidad | Transferencia internacional | SCC / Mecanismo |
|---|---|---|---|---|
| **Anthropic, PBC** | EE.UU. | LLM primario (Claude Sonnet 4.6, Haiku 4.5) | Sí — EE.UU. → UE | SCCs vigentes (Anthropic Data Processing Agreement) |
| **OpenAI, LLC** | EE.UU. | LLM fallback + embeddings | Sí — EE.UU. → UE | SCCs vigentes (OpenAI Data Processing Agreement) |
| **Hetzner Online GmbH** | Alemania (EU) | Hosting VPS (Fase 8) | No (EU-only) | RGPD Art. 3 — sede en UE |
| **Backblaze, Inc.** | EE.UU. (región EU B2) | Backups (Fase 8) | Sí (si región EU) | SCCs / EU region clause |
| **Resend / Postmark** | TBD — decidir en F1 | Email transaccional | Posible | Verificar DPA del proveedor elegido |

## Notas de cumplimiento

1. **Anthropic SCCs**: verificar que el DPA de Anthropic cubre a proyectos académicos
   y que las SCCs actuales (post-Schrems II) están en vigor. URL: anthropic.com/privacy

2. **OpenAI SCCs**: ídem. URL: openai.com/policies/privacy-policy

3. **Email transaccional**: se debe elegir entre Resend y Postmark antes del primer
   deploy con usuarios reales. Priorizar proveedor con sede o región de procesamiento en EU.
   Resend tiene servidores EU; Postmark ofrece región EU.

4. **Subprocesadores de Chroma** (self-hosted en Docker): no aplica — no hay transferencia
   de datos a terceros.

## Pendiente (antes de producción)

- [ ] Firmar / verificar DPA con Anthropic
- [ ] Firmar / verificar DPA con OpenAI
- [ ] Elegir y documentar proveedor de email transaccional
- [ ] Añadir cláusula de subprocesadores a la Privacy Policy publicada
- [ ] Transfer Impact Assessment para Anthropic y OpenAI
