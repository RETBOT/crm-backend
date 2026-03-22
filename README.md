# CRM Backend (Express + SQL Server)

Backend API compatible with the existing CRM frontend (`CRM-Novapak`).

## Requirements

- Node.js 20+
- SQL Server with database `crm_core`

## Setup

1. Copy `.env.example` to `.env`.
2. Configure SQL Server credentials and JWT secret.
3. Run:

```bash
npm install
npm run dev
```

## Endpoints

- `GET /api/health`
- `GET /api/dashboard/home` (Bearer token)
- `POST /api/login/access`
- `POST /api/login/refresh_token`
- `POST /api/login/forgotpwd`
- `POST /api/cn/sucursal` (Bearer token)
- `POST /api/cn/rutas` (Bearer token)
- `POST /api/cn/clientes` (Bearer token)
- `POST /api/cn/contactos` (Bearer token)
- `POST /api/cn/contactos_abc` (Bearer token)
- `GET /api/admin/roles` (Bearer token + roles.manage)
- `GET /api/admin/users` (Bearer token + users.manage)
- `POST /api/admin/users` (Bearer token + users.manage)
- `PUT /api/admin/users/:userId/roles` (Bearer token + roles.manage)
- `GET /api/admin/branches` (Bearer token + users.manage/roles.manage/scope.manage)
- `GET /api/admin/routes` (Bearer token + users.manage/roles.manage/scope.manage)
- `GET /api/admin/users/:userId/scope` (Bearer token + scope.manage)
- `PUT /api/admin/users/:userId/scope` (Bearer token + scope.manage)
- `POST /api/admin/roles` (Bearer token + roles.manage)
- `PUT /api/admin/roles/:roleId/permissions` (Bearer token + roles.manage)
- `DELETE /api/admin/roles/:roleId` (Bearer token + roles.manage)

## Notes

- `APP_SECRET_KEY` supports decrypting frontend AES-encrypted password payloads.
- Response formats preserve legacy frontend contract (`regresa`, `mensaje`, `resultado`, `msg`, `tot_pags`).

## Password management (admin)

- Check if a candidate password matches a user hash:

```bash
npm run password:check -- admin 123456
```

- Reset user password (generates bcrypt hash and updates DB):

```bash
npm run password:reset -- admin NewStrongPassword123!
```

- Create/update a user with no roles (no permissions):

```bash
npm run user:create-no-perms -- operador_lectura Lectura123! "Operador Solo Lectura"
```

## Roles and permissions

Run the SQL seed file to create CRM permissions and default roles (`admin`, `ventas`, `supervisor`):

```sql
:r sql/seed_permissions.sql
```

Or use the Node seed script:

```bash
npm run permissions:seed
```

Set up user scope tables and initial assignments:

```bash
npm run scope:setup
```

Permissions enforced for CRM operations:

- `customers.create`
- `customers.update`
- `customers.delete`
- `prospects.create`
- `prospects.update`
- `prospects.delete`
- `prospects.convert`
