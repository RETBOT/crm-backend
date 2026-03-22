import { Request, Response } from "express";
import {
  createRoleSchema,
  createUserSchema,
  upsertUserScopeSchema,
  updateRolePermissionsSchema,
  updateUserRolesSchema,
  createPermissionSchema,
  updatePermissionSchema,
} from "./admin.schemas";
import {
  createRole,
  createUser,
  deleteRole,
  getUserScopeConfig,
  listAdminBranches,
  listAdminRoutes,
  listPermissions,
  listRoles,
  listUsers,
  upsertUserScope,
  updateRolePermissions,
  updateUserRoles,
  createPermission,
  updatePermission,
  deletePermission,
} from "./admin.service";

export async function getAdminPermissions(_req: Request, res: Response): Promise<void> {
  const data = await listPermissions();
  res.json(data);
}

export async function getAdminRoles(req: Request, res: Response): Promise<void> {
  const data = await listRoles(req.auth!.companyId);
  res.json(data);
}

export async function getAdminUsers(req: Request, res: Response): Promise<void> {
  const data = await listUsers(req.auth!.companyId);
  res.json(data);
}

export async function getAdminBranches(req: Request, res: Response): Promise<void> {
  const data = await listAdminBranches(req.auth!.companyId);
  res.json(data);
}

export async function getAdminRoutes(req: Request, res: Response): Promise<void> {
  const branchIdsRaw = String(req.query.branch_ids || "");
  const branchIds = branchIdsRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);

  const data = await listAdminRoutes(req.auth!.companyId, branchIds);
  res.json(data);
}

export async function postAdminCreateUser(req: Request, res: Response): Promise<void> {
  const input = createUserSchema.parse(req.body ?? {});
  const userId = await createUser(req.auth!.companyId, input);
  res.status(201).json({ ok: true, user_id: userId, message: "Usuario creado correctamente" });
}

export async function putAdminUserRoles(req: Request, res: Response): Promise<void> {
  const userId = Number(req.params.userId);
  const parsed = updateUserRolesSchema.parse(req.body ?? {});
  await updateUserRoles(req.auth!.companyId, userId, parsed.role_ids);
  res.json({ ok: true, message: "Roles actualizados correctamente" });
}

export async function postAdminCreateRole(req: Request, res: Response): Promise<void> {
  const parsed = createRoleSchema.parse(req.body ?? {});
  const roleId = await createRole(req.auth!.companyId, parsed);
  res.status(201).json({ ok: true, role_id: roleId, message: "Rol creado correctamente" });
}

export async function putAdminRolePermissions(req: Request, res: Response): Promise<void> {
  const roleId = Number(req.params.roleId);
  const parsed = updateRolePermissionsSchema.parse(req.body ?? {});
  await updateRolePermissions(req.auth!.companyId, roleId, parsed.permission_ids);
  res.json({ ok: true, message: "Permisos del rol actualizados correctamente" });
}

export async function deleteAdminRole(req: Request, res: Response): Promise<void> {
  const roleId = Number(req.params.roleId);
  await deleteRole(req.auth!.companyId, roleId);
  res.json({ ok: true, message: "Rol eliminado correctamente" });
}

export async function getAdminUserScope(req: Request, res: Response): Promise<void> {
  const userId = Number(req.params.userId);
  const data = await getUserScopeConfig(req.auth!.companyId, userId);
  res.json(data);
}

export async function putAdminUserScope(req: Request, res: Response): Promise<void> {
  const userId = Number(req.params.userId);
  const parsed = upsertUserScopeSchema.parse(req.body ?? {});
  await upsertUserScope(req.auth!.companyId, userId, parsed);
  res.json({ ok: true, message: "Alcance de datos actualizado correctamente" });
}

export async function postAdminCreatePermission(req: Request, res: Response): Promise<void> {
  const parsed = createPermissionSchema.parse(req.body ?? {});
  const permissionId = await createPermission(parsed);
  res.status(201).json({ ok: true, permission_id: permissionId, message: "Permiso creado correctamente" });
}

export async function putAdminPermission(req: Request, res: Response): Promise<void> {
  const permissionId = Number(req.params.permissionId);
  const parsed = updatePermissionSchema.parse(req.body ?? {});
  await updatePermission(permissionId, parsed);
  res.json({ ok: true, message: "Permiso actualizado correctamente" });
}

export async function deleteAdminPermission(req: Request, res: Response): Promise<void> {
  const permissionId = Number(req.params.permissionId);
  await deletePermission(permissionId);
  res.json({ ok: true, message: "Permiso eliminado correctamente" });
}
