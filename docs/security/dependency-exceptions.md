# Excepciones de dependencias vulnerables

Vulnerabilidades altas o críticas que se ignoran en la CI porque no tienen un parche compatible. Este documento es vivo: cada excepción se revisa en su fecha de revisión y se elimina en cuanto exista un parche aplicable.

Las excepciones se registran en dos sitios, según el escáner que las detecte:

- `pnpm audit`: `pnpm.auditConfig.ignoreGhsas` en el `package.json` raíz.
- Trivy: `.trivyignore` en la raíz del repositorio.

Origen: [SPEC 02](../../specs/02-actualizar-dependencias-vulnerables.md).

## Excepciones vigentes

| GHSA                  | CVE               | Paquete y versión            | Ruta de dependencia                                                                                                                    | Motivo por el que no hay parche compatible                                                                                                                                                                                                                          | Impacto real en LEXIA                                                                                                                                                                                                                                                                                                                                               | Escáner             | Fecha de revisión |
| --------------------- | ----------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------- |
| `GHSA-mrhx-c7xc-m3w5` | `CVE-2023-54404`  | `zod` 3.25.76                | Directa de `packages/core` y `apps/mcp`; transitiva de `@langchain/anthropic` 0.3 > `@anthropic-ai/sdk`, y de `langsmith` > `openai` 4 | Solo se corrige en `zod` ≥ 4.6.6. LangChain 0.3 y LangGraph 0.2 dependen de los internos de zod 3 para convertir los esquemas de las tools; pasar a zod 4 exige migrar a LangChain 1.x y LangGraph 1.x, que reescribe gran parte del orquestador.                   | Bajo. El fallo agota memoria al validar colecciones enormes con restricciones. En LEXIA, zod valida la salida estructurada del LLM (acotada por `max_tokens`), la configuración de las verticales (estática) y los argumentos del servidor MCP local por stdio (cliente de confianza). `apps/api` no usa zod, así que ninguna petición HTTP de usuario pasa por él. | `pnpm audit`        | 2027-02-07        |
| `GHSA-qr28-fpjm-wq7f` | `CVE-2026-118664` | `decode-uri-component` 0.2.2 | `packages/core` > `minio` 8.0.7 > `query-string` 7.1.3 > `decode-uri-component`                                                        | Solo se corrige en la 0.5.1, que se publica únicamente como ESM. `query-string` 7 es CommonJS y la carga con `require`, que devuelve el namespace en vez de la función y rompe el cliente de MinIO. `minio` 8.0.7 es la última versión y sigue en `query-string` 7. | Bajo. El fallo es un DoS por reemplazo cuadrático al decodificar URLs con muchos caracteres codificados. `minio` solo procesa las respuestas de nuestro propio servidor MinIO, no URLs que controle el usuario.                                                                                                                                                     | `pnpm audit`, Trivy | 2027-02-07        |

## Cómo cerrar una excepción

- **zod:** se cierra con la migración a LangChain 1.x, LangGraph 1.x y zod 4, que tendrá su propio spec. Requiere volver a pasar el eval de `docs/MODEL_CARD.md`.
- **decode-uri-component:** se cierra cuando `minio` publique una versión que use `query-string` ≥ 8 o elimine esa dependencia. Revisar con `npm view minio version` y `npm view minio dependencies`.

Al cerrar una excepción, hay que quitarla de `ignoreGhsas` o de `.trivyignore` y borrar su fila de esta tabla.
