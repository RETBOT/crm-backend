import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  display_name: z.string().min(3).max(140),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6).max(100),
  default_branch_id: z.coerce.number().int().positive().nullable().optional(),
  is_multi_branch: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
  role_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
});

export const updateUserRolesSchema = z.object({
  role_ids: z.array(z.coerce.number().int().positive()).default([]),
});

export const createRoleSchema = z.object({
  role_name: z.string().min(3).max(40),
  role_description: z.string().max(200).optional().or(z.literal("")),
  permission_ids: z.array(z.coerce.number().int().positive()).default([]),
});

export const updateRolePermissionsSchema = z.object({
  permission_ids: z.array(z.coerce.number().int().positive()).default([]),
});

export const upsertUserScopeSchema = z.object({
  scope_type: z.enum(["ALL", "BRANCH", "ROUTE"]),
  branch_ids: z.array(z.coerce.number().int().positive()).default([]),
  route_ids: z.array(z.coerce.number().int().positive()).default([]),
});

export const createPermissionSchema = z.object({
  permission_key: z.string().min(3).max(80).regex(/^[a-z_]+\.[a-z_]+$/, "Formato: categoria.accion (ej: reports.export)"),
  permission_description: z.string().min(1).max(200),
});

export const updatePermissionSchema = z.object({
  permission_key: z.string().min(3).max(80).regex(/^[a-z_]+\.[a-z_]+$/, "Formato: categoria.accion").optional(),
  permission_description: z.string().min(1).max(200).optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Minimo 6 caracteres").max(100),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
export type UpsertUserScopeInput = z.infer<typeof upsertUserScopeSchema>;
export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
