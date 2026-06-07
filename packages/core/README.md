# @lexia/core

Motor principal de Lexia: orquestador multi-agente (LangGraph), RAG, guardrails y pipeline de eval.

## Uso principal

```typescript
import { runLexiaCore } from '@lexia/core';

const result = await runLexiaCore({
  content: '¿Cuántos años necesito para solicitar la nacionalidad?',
  conversationHistory: [],
  userId: 'user-123',
  vertical: 'nacionalidad_residencia',
});

console.log(result.response); // Respuesta con disclaimer inyectado
console.log(result.citations); // ['Art. 22 Código Civil', ...]
console.log(result.blocked);   // false (o true si fue bloqueado)
```

## Pipeline de guardrails

**Input (4 pasos):**
1. Regex PII redaction
2. Keyword blocklist
3. LLM-judge jailbreak detector
4. Special category minimizer (GDPR Art. 9)

**Output (4 pasos):**
1. Citation enforcer
2. Legal advice detector
3. PII output redactor
4. Disclaimer injector

## Variables de entorno

- `ANTHROPIC_API_KEY`: Clave API de Anthropic (requerida en producción)
- `EVAL_JUDGE_MODEL`: Modelo juez para eval (default: `claude-haiku-4-5-20251001`)
- `CHROMA_URL`: URL de ChromaDB (default: `http://localhost:8000`)
