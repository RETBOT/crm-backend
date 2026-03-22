import { Router } from "express";
import {
  deleteAdminRole,
  getAdminBranches,
  postAdminCreateRole,
  getAdminPermissions,
  getAdminRoles,
  getAdminRoutes,
  getAdminUserScope,
  getAdminUsers,
  postAdminCreateUser,
  putAdminUserScope,
  putAdminRolePermissions,
  putAdminUserRoles,
  postAdminCreatePermission,
  putAdminPermission,
  deleteAdminPermission,
} from "./admin.controller";
import { requireAnyPermission, requirePermission } from "../../middlewares/permissions";
import { PERMISSIONS } from "../auth/permissions";

const router = Router();

router.get(
  "/permissions",
  requireAnyPermission([PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SCOPE_MANAGE]),
  getAdminPermissions
);
router.get(
  "/branches",
  requireAnyPermission([PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SCOPE_MANAGE]),
  getAdminBranches
);
router.get(
  "/routes",
  requireAnyPermission([PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SCOPE_MANAGE]),
  getAdminRoutes
);
router.get("/roles", requirePermission(PERMISSIONS.ROLES_MANAGE), getAdminRoles);
router.post("/roles", requirePermission(PERMISSIONS.ROLES_MANAGE), postAdminCreateRole);
router.put("/roles/:roleId/permissions", requirePermission(PERMISSIONS.ROLES_MANAGE), putAdminRolePermissions);
router.delete("/roles/:roleId", requirePermission(PERMISSIONS.ROLES_MANAGE), deleteAdminRole);
router.get(
  "/users",
  requireAnyPermission([PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SCOPE_MANAGE]),
  getAdminUsers
);
router.post("/users", requirePermission(PERMISSIONS.USERS_MANAGE), postAdminCreateUser);
router.put("/users/:userId/roles", requirePermission(PERMISSIONS.ROLES_MANAGE), putAdminUserRoles);
router.get("/users/:userId/scope", requirePermission(PERMISSIONS.SCOPE_MANAGE), getAdminUserScope);
router.put("/users/:userId/scope", requirePermission(PERMISSIONS.SCOPE_MANAGE), putAdminUserScope);
router.post("/permissions", requirePermission(PERMISSIONS.ROLES_MANAGE), postAdminCreatePermission);
router.put("/permissions/:permissionId", requirePermission(PERMISSIONS.ROLES_MANAGE), putAdminPermission);
router.delete("/permissions/:permissionId", requirePermission(PERMISSIONS.ROLES_MANAGE), deleteAdminPermission);

export { router as adminRoutes };
