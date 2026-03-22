# CRM Backend (Express + SQL Server)

Backend API REST para el sistema CRM.

## Requisitos

- Node.js 20+
- SQL Server con base de datos `crm_core`

## Configuracion

1. Copiar `.env.example` a `.env`
2. Configurar credenciales de SQL Server y clave JWT
3. Ejecutar:

```bash
npm install
npm run dev
```

## Estructura del proyecto

```
src/
├── app.ts                  # Configuracion Express
├── db/sqlserver.ts         # Conexion SQL Server
├── middlewares/            # Auth, permisos, error handler
├── modules/
│   ├── activities/         # CRUD de actividades
│   ├── admin/              # Gestion de usuarios, roles, permisos, alcance
│   ├── auth/               # Login, JWT, permisos
│   ├── customers/          # CRUD de clientes y prospectos
│   ├── dashboard/          # Panel de control y alertas
│   └── scope/              # Alcance de datos por usuario
└── shared/                 # Utilidades compartidas
```

## Endpoints

### Autenticacion
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/login/access` | Iniciar sesion |
| POST | `/api/login/refresh_token` | Renovar token |
| POST | `/api/login/forgotpwd` | Recuperar contrasena |

### Dashboard
| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| GET | `/api/dashboard/home` | Auth | Panel de control (KPIs, graficos, actividades) |
| GET | `/api/dashboard/overdue` | Auth | Actividades vencidas |

### Clientes
| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| POST | `/api/cn/clientes` | Auth | Listar clientes/prospectos |
| POST | `/api/cn/clientes_abc` | customers.create/update/delete | Crear/editar/eliminar cliente |
| POST | `/api/cn/contactos` | Auth | Listar contactos |
| POST | `/api/cn/contactos_abc` | Auth | Crear/editar/eliminar contacto |

### Actividades
| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| POST | `/api/cn/actividades` | Auth | Listar actividades (filtros, paginacion) |
| POST | `/api/cn/actividades_crear` | activities.create | Crear actividad |
| POST | `/api/cn/actividades_actualizar` | activities.update | Actualizar actividad |
| POST | `/api/cn/actividades_completar` | activities.complete | Completar/cancelar actividad |
| GET | `/api/cn/actividades_tipos` | Auth | Catalogo de tipos de actividad |

### Administracion
| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| GET | `/api/admin/users` | users.manage/roles.manage/scope.manage | Listar usuarios |
| POST | `/api/admin/users` | users.manage | Crear usuario |
| PUT | `/api/admin/users/:id/roles` | roles.manage | Asignar roles a usuario |
| GET | `/api/admin/roles` | roles.manage | Listar roles |
| POST | `/api/admin/roles` | roles.manage | Crear rol |
| PUT | `/api/admin/roles/:id/permissions` | roles.manage | Actualizar permisos del rol |
| DELETE | `/api/admin/roles/:id` | roles.manage | Eliminar rol |
| GET | `/api/admin/permissions` | users.manage/roles.manage/scope.manage | Listar permisos |
| POST | `/api/admin/permissions` | roles.manage | Crear permiso |
| PUT | `/api/admin/permissions/:id` | roles.manage | Actualizar permiso |
| DELETE | `/api/admin/permissions/:id` | roles.manage | Eliminar permiso |
| GET | `/api/admin/branches` | users.manage/roles.manage/scope.manage | Listar sucursales |
| GET | `/api/admin/routes` | users.manage/roles.manage/scope.manage | Listar rutas |
| GET | `/api/admin/users/:id/scope` | scope.manage | Ver alcance de usuario |
| PUT | `/api/admin/users/:id/scope` | scope.manage | Actualizar alcance de usuario |

## Permisos

Permisos disponibles en el sistema:

- **Usuarios:** `users.manage`
- **Roles:** `roles.manage`
- **Alcance:** `scope.manage`
- **Clientes:** `customers.create`, `customers.update`, `customers.delete`
- **Prospectos:** `prospects.create`, `prospects.update`, `prospects.delete`, `prospects.convert`
- **Actividades:** `activities.create`, `activities.update`, `activities.complete`

### Seed de permisos

Ejecutar el archivo SQL para crear permisos y roles por defecto:

```sql
:r sql/seed_permissions.sql
```

O usar el script Node:

```bash
npm run permissions:seed
```

Configurar alcance de datos:

```bash
npm run scope:setup
```

## Utilidades

Verificar/resetear contrasena de usuario:

```bash
npm run password:check -- admin 123456
npm run password:reset -- admin NuevaContrasena123!
```

Crear usuario sin permisos:

```bash
npm run user:create-no-perms -- operador Pass123! "Operador Solo Lectura"
```

## Notas

- Los responses mantienen compatibilidad con el frontend (`regresa`, `mensaje`, `resultado`, `msg`, `tot_pags`)
- `APP_SECRET_KEY` se usa para desencriptar payloads AES del frontend
- El alcance de datos filtra clientes/sucursales/rutas segun configuracion por usuario
- Las actividades cambian de status automaticamente: si se asigna fecha pasa a "Programada", si se quita vuelve a "Pendiente"
