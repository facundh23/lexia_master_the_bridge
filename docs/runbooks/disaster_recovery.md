# Runbook — Disaster Recovery

**Proyecto:** Lexia | **Versión:** 1.0 | **Fecha:** 2026-05-24
**RTO objetivo:** 4 horas | **RPO objetivo:** 24 horas (un backup diario)

---

## Backups

### PostgreSQL — backup manual
```bash
# Crear backup
docker exec lexia-postgres pg_dump -U lexia lexia > backups/lexia-$(date +%Y%m%d-%H%M%S).sql

# Verificar backup
wc -l backups/lexia-*.sql | tail -1
```

### PostgreSQL — restore desde backup
```bash
# 1. Parar API (para evitar writes durante restore)
docker compose -f docker-compose.prod.yml stop api

# 2. Restore
docker exec -i lexia-postgres psql -U lexia -d lexia < backups/lexia-YYYYMMDD-HHMMSS.sql

# 3. Verificar
docker exec lexia-postgres psql -U lexia -d lexia -c "SELECT COUNT(*) FROM users;"
docker exec lexia-postgres psql -U lexia -d lexia -c "SELECT COUNT(*) FROM conversations;"

# 4. Reiniciar API
docker compose -f docker-compose.prod.yml start api
```

### Chroma — backup manual
```bash
# Los datos de Chroma están en el volumen chroma_data
# Backup del volumen Docker:
docker run --rm -v lexia-prod_chroma_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/chroma-$(date +%Y%m%d).tar.gz /data
```

### Chroma — restore
```bash
# Parar chroma, restore, reiniciar
docker compose -f docker-compose.prod.yml stop chroma
docker run --rm -v lexia-prod_chroma_data:/data -v $(pwd)/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/chroma-YYYYMMDD.tar.gz -C /"
docker compose -f docker-compose.prod.yml start chroma
```

---

## Migración a nuevo servidor

### 1. En el servidor nuevo, clonar el repo
```bash
git clone <repo_url> lexia
cd lexia
cp .env.production.example .env.production
# Editar .env.production con los valores reales
```

### 2. Restaurar volúmenes desde backups
```bash
# Subir backups al nuevo servidor vía scp o rsync
# Luego ejecutar los pasos de restore de arriba
```

### 3. Levantar servicios
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 4. Ejecutar migraciones pendientes
```bash
pnpm --filter @lexia/db db:migrate
```

### 5. Verificar health completo
```bash
curl https://$DOMAIN/health
curl https://$DOMAIN/api/health/deep
```

---

## Rollback de deploy

Si un deploy rompe producción:

```bash
# Ver historial de tags git
git tag | sort -V | tail -10

# Checkout del tag anterior
git checkout fase-7-complete

# Rebuild y redeploy
docker compose -f docker-compose.prod.yml up -d --build api web
```

---

## Drill mensual (checklist)

Ejecutar este drill antes de cada defensa o release mayor:

- [ ] Crear backup de PostgreSQL y verificar integridad
- [ ] Restaurar backup en entorno de test
- [ ] Verificar que las migraciones funcionan desde cero
- [ ] Verificar que `/api/health/deep` reporta todos los servicios OK
- [ ] Ejecutar `pnpm eval:smoke` para verificar calidad post-restore
