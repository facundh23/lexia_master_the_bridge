# ADR-0002: Eval Pipeline, MCP Professional Surface y Jueces LLM

**Estado:** Aceptado
**Fecha:** 2026-05-24
**Contexto:** Fases 5, 6 y 7 del capstone Lexia.

---

## Contexto

En la Fase 5 se añadió el simulador CCSE y recordatorios. En la Fase 6 se añadió la surface MCP para gestores profesionales. En la Fase 7 se construyó el pipeline de evaluación con jueces LLM.

---

## Decisiones

### DEC-1: SHA-256 para hash de PAT (no bcrypt)

**Decisión:** Usar `createHash('sha256')` para almacenar el hash del Personal Access Token.

**Razón:** Los PATs son tokens de 32 bytes de entropía criptográfica (256 bits). bcrypt está diseñado para contraseñas de baja entropía (añade un cost factor para hacer el hashing lento). Con tokens de alta entropía, SHA-256 es suficiente y más eficiente (O(1) vs O(2^cost)). OWASP ASVS v4 Section 2.10.3 confirma que tokens de alta entropía no requieren hashing lento.

**Alternativa rechazada:** bcrypt — overhead innecesario para tokens de alta entropía.

### DEC-2: stdio transport para MCP (no HTTP)

**Decisión:** El servidor MCP usa `StdioServerTransport` del SDK de Anthropic.

**Razón:** Claude Desktop lanza el MCP como proceso hijo. stdio no expone ningún puerto — elimina el riesgo de ataques de red contra el servidor MCP. El gestor solo necesita `LEXIA_API_URL` y `LEXIA_PAT` en su entorno; el `DATABASE_URL` nunca sale del servidor de Lexia.

**Alternativa rechazada:** HTTP transport — expone un puerto local susceptible a ataques de red local.

### DEC-3: Claude Haiku como juez LLM (no Sonnet)

**Decisión:** El pipeline de eval usa `claude-haiku-4-5-20251001` como modelo juez.

**Razón:** Los juicios de calidad (factualidad, seguridad, tono) son tareas de clasificación bien definidas. Haiku es 5-10× más barato que Sonnet con latencia menor. Para correr eval sobre 80 casos con 4 jueces = 320 llamadas LLM, el coste con Haiku es ~$0.05 vs ~$0.50 con Sonnet. La diferencia en calidad del juicio es marginal para rúbricas bien definidas.

**Alternativa rechazada:** Sonnet como juez — coste 10× mayor sin beneficio proporcional en el dominio de eval.

### DEC-4: Jueces deterministas con fallback (no LLM-only)

**Decisión:** CitationJudge y ToneJudge son completamente deterministas (regex). FactualityJudge y SafetyJudge usan LLM con fallback determinista si `ANTHROPIC_API_KEY` no está disponible.

**Razón:** Permite correr el CI de eval sin API key (mode offline). Los casos deterministas (citation, disclaimer) tienen lógica clara que no necesita LLM. Los casos borderline (factualidad, seguridad) se benefician del LLM pero pueden aproximarse con reglas.

**Alternativa rechazada:** LLM-only para todos los jueces — rompe CI sin API key.

### DEC-5: surface='mcp' en audit_log (no tabla separada)

**Decisión:** El campo `surface` en `audit_log` distingue entre `'web'` y `'mcp'`. No se creó una tabla separada para audit del MCP.

**Razón:** La información de quién hizo qué es estructuralmente igual entre surfaces — solo cambia el actor_type y surface. Una única tabla con index en `surface` permite queries cross-surface para análisis de seguridad sin joins.

**Alternativa rechazada:** Tabla `mcp_audit_log` separada — duplicación de schema sin beneficio.

### DEC-6: Human Review obligatoria para decisiones automatizadas (GDPR Art. 22)

**Decisión:** Se implementó `requestHumanReview` tool que registra en DB cuando se detecta una decisión que requiere revisión humana.

**Razón:** GDPR Art. 22 prohíbe decisiones automatizadas con efecto jurídico sobre personas sin posibilidad de revisión humana. En el contexto de Lexia, el cálculo de elegibilidad para nacionalidad tiene implicaciones legales. La herramienta garantiza que existe un canal de revisión documentado.
