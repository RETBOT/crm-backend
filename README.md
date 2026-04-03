# RETFlow CRM - Backend API

> **Estructura y control para tu operación comercial**

Backend API REST para **RETFlow CRM**, el sistema de gestión comercial de **RETEX**.

- **RETEX** = Relationship Execution & Tracking Excellence
- **RETFlow** = Relationship Execution & Tracking Flow

---

## Requisitos

- Node.js 20+
- SQL Server con base de datos `crm_core`
- Cuenta SMTP para envío de emails (recuperación de contraseña)

## Configuración

1. Copiar `.env.example` a `.env`
2. Configurar credenciales de SQL Server, JWT y SMTP
3. Ejecutar:

```bash
npm install
npm run dev
```

## Estructura del proyecto

```
src/
├── app.ts                      # Configuración Express
├── db/sqlserver.ts             # Conexión SQL Server
├── config/
│   ├── env.ts                  # Variables de entorno validadas
│   └── logger.ts               # Logger (pino)
├── middlewares/
│   ├── auth.ts                 # Verificación JWT
│   ├── permissions.ts          # Check de permisos
│   └── error-handler.ts        # Manejo global de errores
├── modules/
│   ├── activities/             # CRUD de actividades
│   ├── admin/                  # Gestión de usuarios, roles, permisos, alcance
│   ├── auth/                   # Login, JWT, permisos, recuperación de contraseña
│   ├── catalog/                # Catálogos: sucursales, rutas, puestos
│   ├── customers/              # CRUD de clientes, prospectos y contactos
│   ├── dashboard/              # Panel de control: KPIs, gráficos, alertas
│   ├── notifications/          # Notificaciones del sistema
│   ├── opportunities/          # Pipeline de oportunidades
│   ├── products/               # Catálogo de productos
│   ├── reports/                # Reportes y exportación de datos
│   └── scope/                  # Alcance de datos por usuario (ALL/BRANCH/ROUTE)
└── shared/
    ├── email.ts                # Servicio de email (nodemailer)
    ├── http-error.ts           # Clase de error HTTP
    └── legacy-response.ts      # Respuestas compatibles con frontend
```

## Endpoints

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/login/access` | Iniciar sesión |
| POST | `/api/login/refresh_token` | Renovar token |
| POST | `/api/login/forgotpwd` | Solicitar recuperación de contraseña (envía email) |
| POST | `/api/login/reset-password` | Restablecer contraseña con token |

### Dashboard
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/dashboard/home` | Auth | Panel de control (KPIs, gráficos, actividades) |
| GET | `/api/dashboard/overdue` | Auth | Actividades vencidas |

### Clientes y Prospectos
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/cn/clientes` | customers.read / prospects.read | Listar clientes o prospectos |
| POST | `/api/cn/clientes_abc` | customers.create/update/delete | Crear/editar/inactivar cliente o prospecto |
| POST | `/api/cn/contactos` | customers.read | Listar contactos de un cliente |
| POST | `/api/cn/contactos_abc` | customers.update | Crear/editar/eliminar contacto |
| POST | `/api/cn/convertir_prospecto` | prospects.convert | Convertir prospecto a cliente |

### Actividades
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/cn/actividades` | Auth | Listar actividades (filtros, paginación) |
| POST | `/api/cn/actividades_crear` | activities.create | Crear actividad |
| POST | `/api/cn/actividades_actualizar` | activities.update | Actualizar actividad |
| POST | `/api/cn/actividades_completar` | activities.complete | Completar/cancelar actividad |
| POST | `/api/cn/actividades_asignar` | activities.assign | Asignar actividad a usuario |
| GET | `/api/cn/actividades_tipos` | Auth | Catálogo de tipos de actividad |

### Oportunidades
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/cn/oportunidades` | Auth | Listar oportunidades |
| POST | `/api/cn/oportunidades_abc` | opportunities.create/update/delete | Crear/editar/eliminar oportunidad |
| POST | `/api/cn/oportunidades_items` | opportunities.items.create/update/delete | Gestionar items de oportunidad |
| PUT | `/api/cn/oportunidades/:id/precio` | opportunities.price.edit | Editar precio de oportunidad |

### Productos
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/cn/productos` | Auth | Listar productos |
| POST | `/api/cn/productos_abc` | products.create/update/delete | Crear/editar/eliminar producto |
| PUT | `/api/cn/productos/:id/precio` | products.price.edit | Editar precio de producto |

### Reportes
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/reports/activities` | reports.view | Reporte de actividades |
| GET | `/api/reports/customers` | reports.view | Reporte de clientes |
| GET | `/api/reports/opportunities` | reports.view | Reporte de oportunidades |
| GET | `/api/reports/products` | reports.view | Reporte de productos |
| GET | `/api/reports/sales` | reports.view | Reporte de ventas |
| GET | `/api/reports/dashboard` | reports.view | Reporte del dashboard |
| POST | `/api/reports/export` | reports.export | Exportar reporte (CSV/Excel) |

### Notificaciones
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/notifications` | Auth | Listar notificaciones del usuario |
| PUT | `/api/notifications/:id/read` | Auth | Marcar notificación como leída |
| PUT | `/api/notifications/read-all` | Auth | Marcar todas como leídas |

### Catálogos
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/cn/sucursal` | Auth | Listar sucursales |
| POST | `/api/cn/rutas` | Auth | Listar rutas |
| POST | `/api/cn/puestos` | Auth | Listar puestos |

### Administración
| Método | Ruta | Permiso | Descripción |
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

El sistema cuenta con **31 permisos** organizados por dominio:

### Administración
| Permiso | Controla |
|---------|----------|
| `users.manage` | Crear y gestionar usuarios |
| `roles.manage` | Crear/editar/eliminar roles y permisos |
| `scope.manage` | Configurar alcance de datos por usuario |

### Clientes
| Permiso | Controla |
|---------|----------|
| `customers.read` | Ver lista de clientes |
| `customers.create` | Crear nuevos clientes |
| `customers.update` | Editar clientes y sus contactos |
| `customers.delete` | Inactivar clientes |

### Prospectos
| Permiso | Controla |
|---------|----------|
| `prospects.read` | Ver lista de prospectos |
| `prospects.create` | Crear nuevos prospectos |
| `prospects.update` | Editar prospectos |
| `prospects.delete` | Inactivar prospectos |
| `prospects.convert` | Convertir prospecto a cliente |

### Actividades
| Permiso | Controla |
|---------|----------|
| `activities.create` | Crear actividades |
| `activities.update` | Editar actividades |
| `activities.complete` | Completar/cancelar actividades |
| `activities.assign` | Asignar actividades a usuarios |

### Oportunidades
| Permiso | Controla |
|---------|----------|
| `opportunities.create` | Crear oportunidades |
| `opportunities.update` | Editar oportunidades |
| `opportunities.delete` | Eliminar oportunidades |
| `opportunities.price.edit` | Editar precios de oportunidades |
| `opportunities.items.create` | Agregar items a oportunidades |
| `opportunities.items.update` | Editar items de oportunidades |
| `opportunities.items.delete` | Eliminar items de oportunidades |

### Productos
| Permiso | Controla |
|---------|----------|
| `products.create` | Crear productos |
| `products.update` | Editar productos |
| `products.delete` | Eliminar productos |
| `products.price.edit` | Editar precios de productos |

### Reportes
| Permiso | Controla |
|---------|----------|
| `reports.view` | Ver reportes |
| `reports.export` | Exportar reportes |
| `reports.scheduled` | Programar reportes |
| `reports.saved_views` | Guardar vistas de reportes |

## Scripts SQL

Archivos disponibles en `sql/`:

| Archivo | Descripción |
|---------|-------------|
| `seed_permissions.sql` | Permisos y roles por defecto |
| `add-read-permissions.sql` | Agrega permisos de lectura a roles existentes |
| `add_activity_permissions.sql` | Permisos de actividades |
| `add_assign_permission.sql` | Permiso de asignación de actividades |
| `add_notifications_table.sql` | Tabla de notificaciones |
| `add_products_updatedAt.sql` | Columna updatedAt en productos |
| `create_report_tables.sql` | Tablas de reportes |
| `create_user_scope_tables.sql` | Tablas de alcance de datos |
| `fix_admin_reports_permission.sql` | Corrige permiso de reportes para admin |
| `Creacion y ejemplos.sql` | Creación de base de datos y datos de ejemplo |

## Utilidades

### Seed de permisos

```bash
npm run permissions:seed
```

### Configurar alcance de datos

```bash
npm run scope:setup
```

### Verificar/resetear contraseña

```bash
npm run password:check -- admin 123456
npm run password:reset -- admin NuevaContrasena123!
```

### Crear usuario sin permisos

```bash
npm run user:create-no-perms -- operador Pass123! "Operador Solo Lectura"
```

## Recuperación de Contraseña

Flujo completo implementado:

1. Usuario solicita recuperación en `/auth/forgot-password`
2. Backend genera token aleatorio con hash SHA-256
3. Token se guarda en `sec.password_reset_tokens` (expira en 1 hora)
4. Se envía email desde `SMTP_USER` con enlace de recuperación
5. Usuario hace clic en enlace → `/auth/reset-password?token=TOKEN`
6. Ingresa nueva contraseña → backend valida token y actualiza `password_hash`
7. Token se marca como usado

## Notas

- **RETEX** = estructura y control · **RETFlow** = ejecución y movimiento
- Los responses mantienen compatibilidad con el frontend (`regresa`, `mensaje`, `resultado`, `msg`, `tot_pags`)
- `APP_SECRET_KEY` se usa para desencriptar payloads AES del frontend
- El alcance de datos filtra clientes/sucursales/rutas según configuración por usuario (ALL/BRANCH/ROUTE)
- Las actividades cambian de status automáticamente: si se asigna fecha pasa a "Programada", si se quita vuelve a "Pendiente"
- El servicio de email usa nodemailer con SMTP (configurado para Gmail con App Password)
- Los tokens de recuperación expiran en 1 hora y son de un solo uso
