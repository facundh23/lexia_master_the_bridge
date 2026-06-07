# Runbook — Disaster Recovery

**Proyecto:** Lexia | **Versión:** 1.0 | **Fecha:** 2026-05-24
**RTO objetivo:** 4 horas | **RPO objetivo:** 24 horas (un backup diario)

---

## Backups

### PostgreSQL — backup manual

```bash
docker exec lexia-postgres pg_dump -U lexia lexia > backups/lexia-$(date +%Y%m%d-%H%M%S).sql

wc -l backups/lexia-*.sql | tail -1
```

### PostgreSQL — restore desde backup

```bash
docker compose -f docker-compose.prod.yml stop api

docker exec -i lexia-postgres psql -U lexia -d lexia < backups/lexia-YYYYMMDD-HHMMSS.sql

docker exec lexia-postgres psql -U lexia -d lexia -c "SELECT COUNT(*) FROM users;"
docker exec lexia-postgres psql -U lexia -d lexia -c "SELECT COUNT(*) FROM conversations;"

docker compose -f docker-compose.prod.yml start api
```

### Chroma — backup manual

```bash
docker run --rm -v lexia-prod_chroma_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/chroma-$(date +%Y%m%d).tar.gz /data
```

### Chroma — restore

```bash
docker compose -f docker-compose.prod.yml stop chroma
docker run --rm -v lexia-prod_chroma_data:/data -v $(pwd)/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/chroma-YYYYMMDD.tar.gz -C /"
docker compose -f docker-compose.prod.yml start chroma
```

---

## Migración a nuevo servidor

### 1. Clonar el repo en el servidor nuevo

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
git tag | sort -V | tail -10

git checkout fase-7-complete

docker compose -f docker-compose.prod.yml up -d --build api web
```

---

## Drill mensual (checklist)

- [ ] Crear backup de PostgreSQL y verificar integridad
- [ ] Restaurar backup en entorno de test
- [ ] Verificar que las migraciones funcionan desde cero
- [ ] Verificar que `/api/health/deep` reporta todos los servicios OK
- [ ] Ejecutar `pnpm eval:smoke` para verificar calidad post-restore
