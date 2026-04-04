# Changelog

Todas las fechas notables en este proyecto seran documentadas en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- Endpoint `POST /cn/actividades_checkins` - listar check-ins de actividades completadas con filtros de fecha, tipo y usuario
- Columnas `check_in_lat` y `check_in_lon` en `crm.activities` para coordenadas GPS del check-in
- Notas obligatorias al completar Visita/Reunion (mínimo 10 caracteres)
- SQL migration `add_activity_checkin.sql` - columnas de check-in con constraints e índice
- SQL migration `add_sucursalid_to_view.sql` - agrega SUCURSALID a vista vw_cn_clientes
- `activityCheckinsListSchema` con filtro TYPE opcional
- `getActivityCheckins()` en service: query con scope, filtros de fecha/tipo/usuario
- Filtros avanzados en actividades: prioridad, responsable, rango de fechas
- Ordenamiento dinámico en actividades por fecha, prioridad, estado, fecha de creación

### Changed
- `completeActivity` ahora acepta `NOTES` como parámetro y las append al campo existente con separador `--- Check-in ---`
- `getActivityCheckins` ahora devuelve `a.notes AS NOTES` en el SELECT
- `listCustomers`: filtro de sucursal usa `SUCURSALID` en vez de `SUCURSAL` (comparación por ID)
- `listContacts`: siempre busca por `customer_code` (eliminado bug de detección numérica que confundía PK con código)
- `getActivityUsersHandler`: corregido `_req` → `req` (error "req is not defined")
- `activitiesListSchema`: agregados campos PRIORITY, OWNER_USER_ID, DUE_FROM, DUE_TO, SORT_BY, SORT_DIR
- `listActivities`: agregados filtros por prioridad, responsable, rango de fechas y ordenamiento dinámico

### Fixed
- Bug crítico en `listContacts`: detectaba si CLIENTEID era numérico y buscaba por PK en vez de customer_code → "No tiene acceso a este cliente/prospecto"
- Bug en `getActivityUsersHandler`: parámetro `_req` no se podía usar como `req` → error 400
- Bug en `updateOpportunity`: SELECT no incluía `stage_id` → NULL en UPDATE → "Cannot insert NULL into column stage_id"
- Bug en `updateOpportunity`: items se borraban y re-insertaban sin transacción → pérdida de datos
- Bug en `advanceOpportunityStage`: permitía mover a etapa de otro pipeline
- Bug en `advanceOpportunityStage`: permitía mover a etapa cerrada
- Bug en `reopenOpportunity`: usaba `any` como input sin validación
- Bug en items CRUD: sin scope check → cualquier usuario podía editar items de cualquier oportunidad
- Bug en `getOpportunityItems`: sin scope check → cualquier usuario veía items de cualquier oportunidad

---

### Added
- Endpoint `PUT /admin/users/:userId/password` para resetear contrasena desde admin UI
- `resetPasswordSchema` para validacion de nueva contrasena (min 6, max 100)
- `resetUserPassword()` en admin service: bcrypt hash + UPDATE en BD
- Sistema de notificaciones con tabla `crm.notifications`
- `GET /api/notifications` - listar notificaciones del usuario (con generacion on-demand de due_soon y overdue)
- `GET /api/notifications/badge` - contador de no leidas
- `PUT /api/notifications/:id/read` - marcar como leida
- `PUT /api/notifications/read-all` - marcar todas como leidas
- Notificacion automatica al asignar actividad a otro usuario
- Generacion on-demand de notificaciones: `due_soon` (4h antes) y `overdue` (vencidas)
- Permiso `activities.assign` para asignar actividades a otros usuarios
- Endpoint `GET /cn/actividades_usuarios` para listar usuarios de la sucursal
- `OWNER_USER_ID` opcional en `activityCreateSchema`
- `getUsersForAssignment()` en service: filtra usuarios activos por scope del creador
- Permisos de productos: `products.create`, `products.update`, `products.delete`, `products.price.edit`
- Permisos de oportunidades: `opportunities.create`, `opportunities.update`, `opportunities.delete`, `opportunities.price.edit`
- Permisos de items de oportunidades: `opportunities.items.create`, `opportunities.items.update`, `opportunities.items.delete`
- Modulo completo de productos con CRUD y permisos
- Modulo completo de oportunidades con CRUD y permisos

### Changed
- `createActivity` acepta parametro `canAssign` y `OWNER_USER_ID` opcional
- Si usuario tiene `activities.assign` y envia `OWNER_USER_ID`, se asigna a ese usuario
- Si no, se asigna al usuario que crea la actividad (comportamiento actual)

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
