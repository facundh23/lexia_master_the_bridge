# Runbook — Incident Response

**Proyecto:** Lexia | **Versión:** 1.0 | **Fecha:** 2026-05-24

---

## Categorías de incidente

| Severidad | Descripción | Tiempo de respuesta |
|---|---|---|
| P0 — Crítico | Servicio caído, breach de datos, PII expuesta | 30 min |
| P1 — Alto | Degradación severa, auth comprometida, eval regresión >20% | 2h |
| P2 — Medio | Bug en producción con workaround, error rate >5% | 24h |
| P3 — Bajo | Incidencia menor, solo logging | Próximo sprint |

---

## P0 — Servicio completamente caído

### 1. Verificar estado de contenedores
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api --tail=100
docker compose -f docker-compose.prod.yml logs postgres --tail=50
```

### 2. Reiniciar servicios en orden
```bash
# Solo API (sin reiniciar DB)
docker compose -f docker-compose.prod.yml restart api

# Si falla el restart, full restart con dependencias
docker compose -f docker-compose.prod.yml up -d --force-recreate api
```

### 3. Verificar health
```bash
curl https://$DOMAIN/health
curl https://$DOMAIN/api/health/deep
```

### 4. Rollback a versión anterior (si el restart no resuelve)
```bash
# Ver últimas imágenes disponibles
docker images lexia-api --format "table {{.Tag}}\t{{.CreatedAt}}"

# Rollback
docker compose -f docker-compose.prod.yml stop api
docker tag lexia-api:previous lexia-api:latest
docker compose -f docker-compose.prod.yml up -d api
```

### 5. Escalar si hay sobrecarga
```bash
docker compose -f docker-compose.prod.yml up -d --scale api=2
```

---

## P1 — Posible breach de datos

Ver runbook `breach_notification.md` inmediatamente.

### Acciones técnicas paralelas:

1. **Revocar sesiones activas** (si la auth fue comprometida):
```bash
# Conectar a DB y borrar sesiones
docker exec -it lexia-postgres psql -U lexia -d lexia \
  -c "DELETE FROM session WHERE created_at < NOW() - INTERVAL '1 hour';"
```

2. **Revocar todos los PATs** (si se sospecha compromiso de tokens):
```bash
docker exec -it lexia-postgres psql -U lexia -d lexia \
  -c "DELETE FROM personal_access_tokens;"
```

3. **Activar modo mantenimiento** en Caddy (opcional):
```caddyfile
# Agregar temporalmente en Caddyfile:
respond "Servicio en mantenimiento. Vuelve pronto." 503
```

---

## P1 — Eval regresión detectada en CI

Si el job `eval-smoke` falla en CI:

1. Ver el artefacto `eval-report` en GitHub Actions.
2. Comparar con baseline:
```bash
# Descargar eval-report.json del artefacto
tsx scripts/ab-safety.ts --baseline=artifacts/eval-baseline.json --candidate=eval-report.json
```
3. Si hay regresión, no mergear el PR. Investigar qué cambio causó la degradación.

---

## Contacto de escalada

| Rol | Contacto |
|---|---|
| Responsable técnico | Facundo Herrera — facundhfed@gmail.com |
| Tutor del máster | (coordinación MUIA) |
| Autoridad de control GDPR | AEPD — aepd.es / 901 100 099 |
