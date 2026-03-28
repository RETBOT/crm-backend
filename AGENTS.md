# Agent Instructions - CRM Backend

Este archivo define las reglas de documentacion que opencode debe seguir automaticamente al modificar codigo en este proyecto.

## Reglas generales

Cuando modifiques codigo en este proyecto, ejecuta las siguientes acciones automaticamente:

1. Actualiza `CHANGELOG.md` con el cambio realizado
2. Si el cambio afecta endpoints, permisos, scripts o esquema de BD, actualiza `README.md`
3. Si hay cambios en la base de datos, crea un archivo de migracion en `sql/migrations/`

## Nuevos endpoints

Cuando agregues un nuevo endpoint:

- Agregar a `README.md` en la tabla de endpoints correspondiente:
  - Metodo HTTP
  - Ruta
  - Permiso requerido
  - Descripcion
- Agregar entrada a `CHANGELOG.md` bajo `### Added`

## Cambios en base de datos

Cuando modifiques el esquema de BD (tablas, columnas, constraints, triggers):

- Crear archivo de migracion: `sql/migrations/YYYYMMDD_descripcion.sql`
  - Formato: `USE crm_core; GO` + sentencias SQL + `GO`
  - Incluir verificaciones idempotentes (`IF NOT EXISTS`, `IF EXISTS`)
- Si el cambio afecta endpoints o funcionalidad, actualizar `README.md`
- Agregar entrada a `CHANGELOG.md`

## Nuevos permisos

Cuando agregues un nuevo permiso:

- Agregar a `README.md` en la seccion de permisos
- Agregar la entrada al array en `scripts/seed-permissions.js`
- Agregar INSERT idempotente en `sql/seed_permissions.sql`
- Crear migracion `sql/migrations/YYYYMMDD_add_permiso_name.sql` para BD existente
- Agregar entrada a `CHANGELOG.md`

## Nuevos scripts de utilidad

Cuando agregues un script en `scripts/`:

- Agregar a `README.md` en la seccion de utilidades
- Agregar al `package.json` en `scripts`
- Agregar entrada a `CHANGELOG.md`

## Formato CHANGELOG

Usar formato basado en Keep a Changelog:

```markdown
## [YYYY-MM-DD]

### Added
- Nueva funcionalidad o endpoint

### Changed
- Cambio a funcionalidad existente

### Fixed
- Correccion de bug

### Removed
- Eliminacion de funcionalidad
```

## Estructura del proyecto

```
src/
├── modules/
│   ├── activities/     # CRUD actividades
│   ├── admin/          # Usuarios, roles, permisos
│   ├── auth/           # Login, JWT, permisos constantes
│   ├── customers/      # Clientes y prospectos
│   ├── dashboard/      # Panel de control
│   └── scope/          # Alcance de datos
├── middlewares/        # Auth, permisos
├── db/                 # Conexion SQL Server
└── shared/             # Utilidades
```

Al agregar un nuevo modulo, crear la carpeta en `src/modules/` con:
- `[nombre].schemas.ts` — Validaciones Zod
- `[nombre].service.ts` — Logica de negocio
- `[nombre].controller.ts` — Handlers Express
- `[nombre].routes.ts` — Rutas

Registrar en `src/app.ts` con `app.use("/api/[ruta]", requireAuth, [nombre]Routes)`.

## Flujo de git

### Commits
- Commitear despues de cada cambio logico (feature, fix, refactor)
- Mensaje descriptivo en inglés con prefijo: feat, fix, docs, refactor
- Actualizar CHANGELOG.md antes de commitear

### Push
- NO hacer push automatico despues de cada commit
- Solo hacer push cuando el usuario lo pida explicitamente con las palabras "commit y push" o "push"
- Si el usuario dice "commitea" o "documenta", solo commit sin push

### Ejemplo
- "arregla el bug de contactos" → commit local, sin push
- "agrega reportes" → commit local, sin push
- "commit y push" → push todos los pendientes en ambos proyectos
