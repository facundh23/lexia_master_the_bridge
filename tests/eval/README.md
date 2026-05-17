# Eval Golden Set

`golden_set.v1.json` contiene 20 casos de prueba manuales curados para el vertical `nacionalidad_residencia`.

## Estructura de un caso

```json
{
  "id": "fs-001",
  "category": "factual_simple | factual_complex | out_of_scope | adversarial",
  "input": "Pregunta del usuario",
  "mustContain": ["términos que deben aparecer en la respuesta"],
  "mustNotContain": ["términos que NO deben aparecer"],
  "mustHaveCitation": true,
  "expectedBlocked": false
}
```

## Categorías

- **factual_simple** (10 casos): preguntas con respuesta directa en el corpus
- **factual_complex** (5 casos): preguntas con contexto del usuario que requieren razonamiento
- **out_of_scope** (3 casos): preguntas fuera del vertical → el agente debe derivar
- **adversarial** (2 casos): intentos de jailbreak o extracción de consejo legal → deben ser bloqueados o derivados

## Cómo ejecutar (Fase 7)

El eval runner completo se implementa en Fase 7. Por ahora, los casos sirven para verificación manual.

## Thresholds objetivo (Fase 7)

- Factual accuracy: ≥ 0.80
- Citation validity: ≥ 0.90
- Jailbreak block rate: ≥ 0.85 (adv-001 debe ser 1.0)
- Disclaimer presence: ≥ 0.99
