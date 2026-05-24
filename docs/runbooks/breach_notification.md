# Runbook — Breach Notification (GDPR Art. 33)

**Proyecto:** Lexia | **Versión:** 1.0 | **Fecha:** 2026-05-24
**Deadline legal:** 72 horas desde la detección para notificar a la AEPD.

---

## ¿Qué es una brecha notificable?

Según GDPR Art. 33, una brecha es notificable si es "probable que entrañe un riesgo para los derechos y libertades de las personas físicas". En Lexia, esto incluye:

- ✅ Exposición de datos de usuarios (email, historial de conversación, datos de caso)
- ✅ Acceso no autorizado a la base de datos
- ✅ Exposición de datos de categoría especial (Art. 9 — origen racial/étnico implícito en consultas)
- ❌ No notificable: incidente interno sin exposición de datos de usuarios

---

## Timeline obligatorio (72h desde detección)

| T+0h | Detección del incidente |
|---|---|
| T+1h | Contener la brecha (ver acciones técnicas en incident_response.md) |
| T+2h | Evaluar alcance: ¿qué datos? ¿cuántos afectados? ¿desde cuándo? |
| T+24h | Preparar borrador de notificación |
| T+48h | Revisar y aprobar borrador |
| T+72h | **Notificar a AEPD** (obligatorio si hay riesgo) |
| T+72h+ | Notificar a afectados si riesgo alto (Art. 34) |

---

## Evaluación del alcance

### Consultar audit_log
```bash
docker exec -it lexia-postgres psql -U lexia -d lexia -c "
  SELECT actor_id, action, created_at, ip_address
  FROM audit_log
  WHERE created_at > NOW() - INTERVAL '48 hours'
  ORDER BY created_at DESC
  LIMIT 100;
"
```

### Estimar afectados
```bash
docker exec -it lexia-postgres psql -U lexia -d lexia -c "
  SELECT COUNT(DISTINCT actor_id) as usuarios_afectados
  FROM audit_log
  WHERE created_at BETWEEN '<inicio_brecha>' AND '<fin_brecha>';
"
```

---

## Notificación a la AEPD

**Canal:** https://sedeagpd.gob.es/sede-electronica-web/vistas/formNDP/notificacionDP.jsf

**Información requerida (Art. 33.3):**

```
1. Naturaleza de la violación:
   - Tipo: [Confidencialidad / Integridad / Disponibilidad]
   - Categorías de datos: [Email, historial conversación, datos de caso, datos categoría especial]
   - Número aproximado de interesados: [N]
   - Número aproximado de registros: [N]

2. Datos de contacto del responsable:
   - Nombre: Facundo Herrera
   - Email: facundhfed@gmail.com
   - Rol: Responsable del tratamiento

3. Consecuencias probables:
   [Describir el impacto potencial]

4. Medidas adoptadas o propuestas:
   - Contención: [describir]
   - Recuperación: [describir]
   - Prevención futura: [describir]
```

---

## Notificación a afectados (Art. 34 — si riesgo alto)

Si el riesgo residual es alto (ej: exposición de contraseñas, datos especiales), notificar a usuarios afectados por email con:
- Qué ocurrió
- Qué datos se vieron afectados
- Qué medidas se han tomado
- Qué pueden hacer los afectados (cambiar contraseña, etc.)

---

## Post-incidente

1. Documentar en `docs/compliance/breach_log.md` (crear si no existe).
2. Actualizar DPIA con el incidente y las medidas adicionales tomadas.
3. Revisar si se necesitan medidas técnicas adicionales.
