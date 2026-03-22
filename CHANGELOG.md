# Changelog

Todas las fechas notables en este proyecto seran documentadas en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- (proxima feature)

---

## [2026-03-22]

### Added
- CRUD completo de permisos desde admin UI (crear, actualizar, eliminar)
- Alertas de actividades vencidas en dashboard (`GET /dashboard/overdue`)
- Filtro "Vencidas" en `listActivities` (status IN Pendiente/Programada + due_at < now)
- Auto-transicion de status: crear con fecha → Programada, sin fecha → Pendiente
- Auto-transicion en update: agregar fecha → Programada, quitar → Pendiente
- Selector de cliente en `ActivityForm` para pantalla principal de actividades
- `AGENTS.md` con instrucciones de documentacion automatica
- `CHANGELOG.md` con historial de cambios
- `README.md` actualizado con endpoints, permisos y estructura completa

### Changed
- Admin UI: tabla de permisos ahora es solo lectura con columna "Ubicacion"
- Admin UI: checkboxes de permisos muestran `permission_description` en vez de `permission_key`
- Admin UI: eliminado formulario de crear/eliminar permisos (control del desarrollador)
- `updateActivity`: ahora actualiza status automaticamente segun DUE_AT

---

## [2026-03-22 (anterior)]

### Added
- Modulo `activities` completo: schemas, service, controller, routes
- 5 endpoints de actividades: listar, crear, actualizar, completar, tipos
- Permisos: `activities.create`, `activities.update`, `activities.complete`
- Seed de permisos en `seed_permissions.sql` y `seed-permissions.js`
- Script de migracion `add_activity_permissions.sql`
- Verificacion de scope por customer en todas las operaciones de actividades

### Changed
- `seed_permissions.sql`: agregados 3 permisos de actividades + asignacion a rol admin

---

## [2026-03-21]

### Added
- Endpoint catalogo de posiciones de contacto (`GET /cn/contacto_posiciones`)
- Endpoint de dashboard home scoped (`GET /dashboard/home`)
  - KPIs: ventas mes, meta, oportunidades ganadas, clientes nuevos
  - Graficos: tendencia ventas, oportunidades por status, actividades por status
  - Top 8 oportunidades y actividades recientes
  - Filtrado por alcance de datos del usuario (scope)
- Mapeo de permisos con contexto en UI (`PERMISSION_CONTEXT`)
- Seccion "Permisos disponibles" en admin UI con columna "Ubicacion"

---

## [2026-03-20]

### Added
- CRUD de usuarios desde admin
- CRUD de roles con asignacion de permisos
- Alcance de datos por usuario (ALL/BRANCH/ROUTE)
- Sistema de permisos: `users.manage`, `roles.manage`, `scope.manage`
- Permisos de clientes: `customers.create`, `customers.update`, `customers.delete`
- Permisos de prospectos: `prospects.create`, `prospects.update`, `prospects.delete`, `prospects.convert`
- Seed de permisos y roles por defecto (admin, ventas, supervisor)

---

## [2026-03-19]

### Added
- Configuracion Express con middlewares (CORS, JSON, error handler)
- Conexion SQL Server con mssql
- Autenticacion JWT con refresh token
- Login, forgot password
- CRUD de clientes y prospectos (shared endpoint)
- CRUD de contactos
- Scope service para filtrado de datos por sucursal/ruta
- Map markers con clustering (frontend)
