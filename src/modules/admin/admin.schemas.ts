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

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
export type UpsertUserScopeInput = z.infer<typeof upsertUserScopeSchema>;
