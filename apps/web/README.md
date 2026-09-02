# apps/web

Frontend de Lexia — Next.js 15 App Router + Tailwind CSS.

## Arrancar en desarrollo

```powershell
# Desde la raíz del monorepo:
pnpm --filter @lexia/web dev
# Web en http://localhost:3000
```

## Páginas principales

| Ruta    | Descripción                             |
| ------- | --------------------------------------- |
| `/`     | Landing page                            |
| `/chat` | Interfaz de chat principal              |
| `/quiz` | Simulacro CCSE                          |
| `/me`   | Perfil + exportar datos + borrar cuenta |

## Variables de entorno

- `NEXT_PUBLIC_API_URL`: URL de la API (default: `http://localhost:4000`)

## Build de producción

```powershell
pnpm --filter @lexia/web build
```
