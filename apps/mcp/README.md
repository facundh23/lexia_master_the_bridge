# Lexia MCP Server — Guía para Gestores y Abogados

Lexia expone tres herramientas profesionales accesibles desde Claude Desktop o Cursor mediante el protocolo MCP (Model Context Protocol).

## Requisitos previos

1. **Cuenta Lexia verificada como profesional**: Solicitá la verificación de colegiación desde tu perfil web → "Verificación profesional". Un administrador la aprobará manualmente.
2. **PAT (Personal Access Token)**: Una vez verificado, generá un token en tu perfil web → "Tokens de acceso". El token se muestra **una única vez** — guardalo en un gestor de contraseñas.
3. **Node.js 20+** instalado en tu máquina.

## Instalación

```bash
# Opción A: clonar el repositorio
git clone https://github.com/tu-org/lexia-capstone.git
cd lexia-capstone
pnpm install
pnpm --filter @lexia/mcp build

# El binario compilado queda en: apps/mcp/dist/index.js
```

## Configuración en Claude Desktop

Editá el archivo de configuración de Claude Desktop:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lexia": {
      "command": "node",
      "args": ["/ruta/absoluta/a/lexia-capstone/apps/mcp/dist/index.js"],
      "env": {
        "LEXIA_API_URL": "https://api.lexia.tu-dominio.com",
        "LEXIA_PAT": "tu-pat-de-64-caracteres-aqui"
      }
    }
  }
}
```

Reiniciá Claude Desktop. El ícono del servidor MCP aparecerá en la barra inferior de la ventana de chat.

## Configuración en Cursor

Creá o editá `.cursor/mcp.json` en la raíz de tu proyecto:

```json
{
  "mcpServers": {
    "lexia": {
      "command": "node",
      "args": ["/ruta/absoluta/a/apps/mcp/dist/index.js"],
      "env": {
        "LEXIA_API_URL": "https://api.lexia.tu-dominio.com",
        "LEXIA_PAT": "tu-pat-aqui"
      }
    }
  }
}
```

## Herramientas disponibles

### `search_corpus_with_citations`

Busca en el corpus legal de Lexia (BOE, Código Civil, instrucciones DGRN) y devuelve una respuesta con citas legales específicas.

**Parámetros:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `query` | string | Sí | Consulta en lenguaje natural |
| `vertical` | string | No | Vertical (default: `nacionalidad_residencia`) |

**Ejemplo:**
> "Usa search_corpus_with_citations para saber cuántos años de residencia necesita un cliente colombiano para solicitar la nacionalidad"

---

### `compute_eligibility`

Calcula si un cliente cumple el requisito de años de residencia. Resultado determinista (sin LLM) basado en el Art. 22 del Código Civil.

**Parámetros:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `countryOrigin` | string | No | País de origen (e.g. `"argentina"`, `"colombia"`) |
| `arrivalDate` | string | No | Fecha de llegada a España en ISO 8601 (e.g. `"2020-03-15"`) |
| `residenceStatus` | string | No | `"refugee"`, `"stateless"`, u omitir para caso general |

**Ejemplo:**
> "Usa compute_eligibility con countryOrigin=colombia, arrivalDate=2021-06-01 para mi cliente"

---

### `get_procedure_requirements`

Devuelve el checklist de documentación y recordatorios clave para el trámite.

**Parámetros:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `vertical` | string | Sí | Vertical (e.g. `"nacionalidad_residencia"`) |

**Ejemplo:**
> "Usa get_procedure_requirements para ver qué documentos necesita mi cliente para la nacionalidad"

---

## Seguridad del PAT

- El PAT se muestra **una única vez** al crearlo. Si lo perdés, revocalo desde tu perfil web y creá uno nuevo.
- **No compartas el PAT** ni lo incluyas en repositorios de código.
- El PAT identifica todas tus acciones en el audit log de Lexia bajo tu nombre de usuario.
- El PAT viaja en el header `Authorization: Bearer <token>` — asegurate de usar HTTPS en producción.

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|---------|
| `LEXIA_API_URL y LEXIA_PAT son requeridos` | Variables de entorno no configuradas | Verificar `env` en el config de Claude Desktop / Cursor |
| `API error 401: PAT inválido o expirado` | PAT revocado o incorrecto | Generar nuevo PAT desde el perfil web |
| `API error 403: Acceso restringido a profesionales verificados` | Verificación de colegiación pendiente | Contactar al administrador para aprobar la verificación |
| `API error 404: Vertical no encontrado` | Vertical inexistente | Solo `nacionalidad_residencia` está disponible en MVP |

## Soporte

Contactar al administrador de Lexia para:
- Solicitar verificación de colegiación
- Reportar problemas de acceso
- Consultar sobre disponibilidad de nuevos verticales
