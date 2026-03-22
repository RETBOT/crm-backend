import bcrypt from "bcryptjs";
import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";
import { CreateRoleInput, CreateUserInput, UpsertUserScopeInput, CreatePermissionInput, UpdatePermissionInput } from "./admin.schemas";
import { resolveUserScope } from "../scope/scope.service";

export async function listPermissions() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT permission_id, permission_key, permission_description
    FROM sec.permissions
    ORDER BY permission_key;
  `);

  return result.recordset;
}

export async function listRoles(companyId: number) {
  const pool = await getPool();
  const result = await pool.request().input("company_id", sql.Int, companyId).query(`
    SELECT
      r.role_id,
      r.role_name,
      r.role_description,
      r.is_active,
      p.permission_key
    FROM sec.roles r
    LEFT JOIN sec.role_permissions rp ON rp.role_id = r.role_id
    LEFT JOIN sec.permissions p ON p.permission_id = rp.permission_id
    WHERE r.company_id = @company_id
    ORDER BY r.role_name, p.permission_key;
  `);

  const map = new Map<number, { role_id: number; role_name: string; role_description: string | null; is_active: boolean; permissions: string[] }>();

  for (const row of result.recordset as Array<any>) {
    if (!map.has(row.role_id)) {
      map.set(row.role_id, {
        role_id: row.role_id,
        role_name: row.role_name,
        role_description: row.role_description,
        is_active: row.is_active,
        permissions: [],
      });
    }

    if (row.permission_key) {
      map.get(row.role_id)!.permissions.push(row.permission_key);
    }
  }

  return Array.from(map.values());
}

export async function listUsers(companyId: number) {
  const pool = await getPool();
  const result = await pool.request().input("company_id", sql.Int, companyId).query(`
    SELECT
      u.user_id,
      u.username,
      u.display_name,
      u.email,
      u.is_active,
      u.is_multi_branch,
      u.default_branch_id,
      b.branch_name,
      r.role_id,
      r.role_name
    FROM sec.users u
    LEFT JOIN crm.branches b
      ON b.company_id = u.company_id
     AND b.branch_id = u.default_branch_id
    LEFT JOIN sec.user_roles ur ON ur.user_id = u.user_id
    LEFT JOIN sec.roles r ON r.role_id = ur.role_id
    WHERE u.company_id = @company_id
    ORDER BY u.username, r.role_name;
  `);

  const map = new Map<number, any>();

  for (const row of result.recordset as Array<any>) {
    if (!map.has(row.user_id)) {
      map.set(row.user_id, {
        user_id: row.user_id,
        username: row.username,
        display_name: row.display_name,
        email: row.email,
        is_active: row.is_active,
        is_multi_branch: row.is_multi_branch,
        default_branch_id: row.default_branch_id,
        branch_name: row.branch_name,
        roles: [],
      });
    }

    if (row.role_id) {
      map.get(row.user_id).roles.push({ role_id: row.role_id, role_name: row.role_name });
    }
  }

  return Array.from(map.values());
}

export async function listAdminBranches(companyId: number) {
  const pool = await getPool();
  const result = await pool.request().input("company_id", sql.Int, companyId).query(`
    SELECT branch_id, branch_code, branch_name, status
    FROM crm.branches
    WHERE company_id = @company_id
      AND status = 'ACTIVO'
    ORDER BY branch_name;
  `);

  return result.recordset;
}

export async function listAdminRoutes(companyId: number, branchIds: number[] = []) {
  const pool = await getPool();
  const branchIdsCsv = branchIds.join(",");

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), branchIdsCsv)
    .query(`
      SELECT route_id, route_code, route_name, branch_id, status
      FROM crm.routes
      WHERE company_id = @company_id
        AND status = 'ACTIVO'
        AND (
          @branch_ids_csv = ''
          OR branch_id IN (
            SELECT TRY_CAST(value AS INT)
            FROM STRING_SPLIT(@branch_ids_csv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
          )
        )
      ORDER BY route_name;
    `);

  return result.recordset;
}

export async function getUserScopeConfig(companyId: number, userId: number) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  const [branchesResult, routesResult] = await Promise.all([
    pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query<{ branch_id: number }>(`
        SELECT branch_id
        FROM sec.user_branch_access
        WHERE company_id = @company_id
          AND user_id = @user_id;
      `),
    pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query<{ route_id: number }>(`
        SELECT route_id
        FROM sec.user_route_access
        WHERE company_id = @company_id
          AND user_id = @user_id;
      `),
  ]);

  return {
    scope_type: scope.scopeType,
    branch_ids: branchesResult.recordset.map((b) => b.branch_id),
    route_ids: routesResult.recordset.map((r) => r.route_id),
    effective_branch_ids: scope.branchIds,
    effective_route_ids: scope.routeIds,
  };
}

export async function upsertUserScope(companyId: number, userId: number, input: UpsertUserScopeInput) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const userExists = await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT user_id
        FROM sec.users
        WHERE company_id = @company_id
          AND user_id = @user_id;
      `);

    if (!userExists.recordset[0]) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    if (input.scope_type !== "ALL" && input.branch_ids.length === 0) {
      throw new HttpError(400, "Debe seleccionar al menos una sucursal para este alcance");
    }

    if (input.scope_type === "ROUTE" && input.route_ids.length === 0) {
      throw new HttpError(400, "Debe seleccionar al menos una ruta para alcance por ruta");
    }

    if (input.branch_ids.length > 0) {
      const validBranches = await new sql.Request(tx)
        .input("company_id", sql.Int, companyId)
        .input("branch_ids_csv", sql.VarChar(sql.MAX), input.branch_ids.join(","))
        .query<{ total: number }>(`
          SELECT COUNT(1) AS total
          FROM crm.branches
          WHERE company_id = @company_id
            AND branch_id IN (
              SELECT TRY_CAST(value AS INT)
              FROM STRING_SPLIT(@branch_ids_csv, ',')
              WHERE TRY_CAST(value AS INT) IS NOT NULL
            );
        `);

      if ((validBranches.recordset[0]?.total || 0) !== input.branch_ids.length) {
        throw new HttpError(400, "Una o más sucursales no son válidas");
      }
    }

    if (input.route_ids.length > 0) {
      const validRoutes = await new sql.Request(tx)
        .input("company_id", sql.Int, companyId)
        .input("route_ids_csv", sql.VarChar(sql.MAX), input.route_ids.join(","))
        .input("branch_ids_csv", sql.VarChar(sql.MAX), input.branch_ids.join(","))
        .query<{ total: number }>(`
          SELECT COUNT(1) AS total
          FROM crm.routes
          WHERE company_id = @company_id
            AND route_id IN (
              SELECT TRY_CAST(value AS INT)
              FROM STRING_SPLIT(@route_ids_csv, ',')
              WHERE TRY_CAST(value AS INT) IS NOT NULL
            )
            AND (
              @branch_ids_csv = ''
              OR branch_id IN (
                SELECT TRY_CAST(value AS INT)
                FROM STRING_SPLIT(@branch_ids_csv, ',')
                WHERE TRY_CAST(value AS INT) IS NOT NULL
              )
            );
        `);

      if ((validRoutes.recordset[0]?.total || 0) !== input.route_ids.length) {
        throw new HttpError(400, "Una o más rutas no son válidas o no pertenecen a las sucursales seleccionadas");
      }
    }

    await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .input("scope_type", sql.VarChar(10), input.scope_type)
      .query(`
        MERGE sec.user_data_scope AS tgt
        USING (SELECT @company_id AS company_id, @user_id AS user_id, @scope_type AS scope_type) AS src
        ON tgt.company_id = src.company_id AND tgt.user_id = src.user_id
        WHEN MATCHED THEN
          UPDATE SET scope_type = src.scope_type, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (company_id, user_id, scope_type, created_at, updated_at)
          VALUES (src.company_id, src.user_id, src.scope_type, SYSUTCDATETIME(), SYSUTCDATETIME());
      `);

    await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query(`
        DELETE FROM sec.user_branch_access
        WHERE company_id = @company_id
          AND user_id = @user_id;

        DELETE FROM sec.user_route_access
        WHERE company_id = @company_id
          AND user_id = @user_id;
      `);

    if (input.scope_type !== "ALL") {
      for (const branchId of input.branch_ids) {
        await new sql.Request(tx)
          .input("company_id", sql.Int, companyId)
          .input("user_id", sql.Int, userId)
          .input("branch_id", sql.Int, branchId)
          .query(`
            INSERT INTO sec.user_branch_access (company_id, user_id, branch_id, created_at)
            VALUES (@company_id, @user_id, @branch_id, SYSUTCDATETIME());
          `);
      }
    }

    if (input.scope_type === "ROUTE") {
      for (const routeId of input.route_ids) {
        await new sql.Request(tx)
          .input("company_id", sql.Int, companyId)
          .input("user_id", sql.Int, userId)
          .input("route_id", sql.Int, routeId)
          .query(`
            INSERT INTO sec.user_route_access (company_id, user_id, route_id, created_at)
            VALUES (@company_id, @user_id, @route_id, SYSUTCDATETIME());
          `);
      }
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function createUser(companyId: number, input: CreateUserInput) {
  const pool = await getPool();
  const passwordHash = await bcrypt.hash(input.password, 12);

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const userInsert = await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("username", sql.VarChar(50), input.username.toUpperCase())
      .input("display_name", sql.NVarChar(140), input.display_name)
      .input("email", sql.NVarChar(160), input.email || null)
      .input("password_hash", sql.NVarChar(255), passwordHash)
      .input("default_branch_id", sql.Int, input.default_branch_id || null)
      .input("is_multi_branch", sql.Bit, input.is_multi_branch)
      .input("is_active", sql.Bit, input.is_active)
      .query<{ user_id: number }>(`
        INSERT INTO sec.users (
          company_id, username, display_name, email, password_hash,
          default_branch_id, is_multi_branch, is_active, created_at, updated_at
        )
        OUTPUT INSERTED.user_id
        VALUES (
          @company_id, @username, @display_name, @email, @password_hash,
          @default_branch_id, @is_multi_branch, @is_active, SYSUTCDATETIME(), SYSUTCDATETIME()
        );
      `);

    const userId = userInsert.recordset[0]?.user_id;
    if (!userId) {
      throw new HttpError(400, "No se pudo crear el usuario");
    }

    if (input.role_ids.length > 0) {
      for (const roleId of input.role_ids) {
        await new sql.Request(tx)
          .input("user_id", sql.Int, userId)
          .input("role_id", sql.Int, roleId)
          .input("company_id", sql.Int, companyId)
          .query(`
            INSERT INTO sec.user_roles (user_id, role_id)
            SELECT @user_id, @role_id
            WHERE EXISTS (
              SELECT 1
              FROM sec.roles
              WHERE role_id = @role_id
                AND company_id = @company_id
            );
          `);
      }
    }

    await tx.commit();
    return userId;
  } catch (error: any) {
    await tx.rollback();
    if (error?.message?.includes("UQ_users_company_username")) {
      throw new HttpError(400, "El username ya existe");
    }
    throw error;
  }
}

export async function updateUserRoles(companyId: number, userId: number, roleIds: number[]) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    await new sql.Request(tx)
      .input("user_id", sql.Int, userId)
      .input("company_id", sql.Int, companyId)
      .query(`
        DELETE ur
        FROM sec.user_roles ur
        INNER JOIN sec.users u ON u.user_id = ur.user_id
        WHERE ur.user_id = @user_id
          AND u.company_id = @company_id;
      `);

    for (const roleId of roleIds) {
      await new sql.Request(tx)
        .input("user_id", sql.Int, userId)
        .input("role_id", sql.Int, roleId)
        .input("company_id", sql.Int, companyId)
        .query(`
          INSERT INTO sec.user_roles (user_id, role_id)
          SELECT @user_id, @role_id
          WHERE EXISTS (
            SELECT 1 FROM sec.roles WHERE role_id = @role_id AND company_id = @company_id
          )
          AND EXISTS (
            SELECT 1 FROM sec.users WHERE user_id = @user_id AND company_id = @company_id
          );
        `);
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function createRole(companyId: number, input: CreateRoleInput) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const roleInsert = await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("role_name", sql.VarChar(40), input.role_name)
      .input("role_description", sql.NVarChar(200), input.role_description || null)
      .query<{ role_id: number }>(`
        INSERT INTO sec.roles (company_id, role_name, role_description, is_active)
        OUTPUT INSERTED.role_id
        VALUES (@company_id, @role_name, @role_description, 1);
      `);

    const roleId = roleInsert.recordset[0]?.role_id;
    if (!roleId) {
      throw new HttpError(400, "No se pudo crear el rol");
    }

    for (const permissionId of input.permission_ids) {
      await new sql.Request(tx)
        .input("role_id", sql.Int, roleId)
        .input("permission_id", sql.Int, permissionId)
        .query(`
          INSERT INTO sec.role_permissions (role_id, permission_id)
          SELECT @role_id, @permission_id
          WHERE EXISTS (SELECT 1 FROM sec.permissions WHERE permission_id = @permission_id);
        `);
    }

    await tx.commit();
    return roleId;
  } catch (error: any) {
    await tx.rollback();
    if (error?.message?.includes("UQ_roles_company_name")) {
      throw new HttpError(400, "El nombre del rol ya existe");
    }
    throw error;
  }
}

export async function updateRolePermissions(companyId: number, roleId: number, permissionIds: number[]) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const roleExists = await new sql.Request(tx)
      .input("role_id", sql.Int, roleId)
      .input("company_id", sql.Int, companyId)
      .query(`
        SELECT role_id
        FROM sec.roles
        WHERE role_id = @role_id
          AND company_id = @company_id;
      `);

    if (!roleExists.recordset[0]) {
      throw new HttpError(404, "Rol no encontrado");
    }

    await new sql.Request(tx)
      .input("role_id", sql.Int, roleId)
      .query(`
        DELETE FROM sec.role_permissions
        WHERE role_id = @role_id;
      `);

    for (const permissionId of permissionIds) {
      await new sql.Request(tx)
        .input("role_id", sql.Int, roleId)
        .input("permission_id", sql.Int, permissionId)
        .query(`
          INSERT INTO sec.role_permissions (role_id, permission_id)
          SELECT @role_id, @permission_id
          WHERE EXISTS (SELECT 1 FROM sec.permissions WHERE permission_id = @permission_id);
        `);
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function deleteRole(companyId: number, roleId: number) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const roleResult = await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("role_id", sql.Int, roleId)
      .query<{ role_name: string }>(`
        SELECT role_name
        FROM sec.roles
        WHERE company_id = @company_id
          AND role_id = @role_id;
      `);

    const role = roleResult.recordset[0];
    if (!role) {
      throw new HttpError(404, "Rol no encontrado");
    }

    if (role.role_name.toLowerCase() === "admin") {
      throw new HttpError(400, "El rol admin no se puede eliminar");
    }

    await new sql.Request(tx)
      .input("role_id", sql.Int, roleId)
      .query(`
        DELETE FROM sec.user_roles
        WHERE role_id = @role_id;
      `);

    await new sql.Request(tx)
      .input("role_id", sql.Int, roleId)
      .query(`
        DELETE FROM sec.role_permissions
        WHERE role_id = @role_id;
      `);

    await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("role_id", sql.Int, roleId)
      .query(`
        DELETE FROM sec.roles
        WHERE company_id = @company_id
          AND role_id = @role_id;
      `);

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function createPermission(input: CreatePermissionInput) {
  const pool = await getPool();

  try {
    const result = await pool
      .request()
      .input("permission_key", sql.VarChar(80), input.permission_key)
      .input("permission_description", sql.NVarChar(200), input.permission_description)
      .query<{ permission_id: number }>(`
        INSERT INTO sec.permissions (permission_key, permission_description)
        OUTPUT INSERTED.permission_id
        VALUES (@permission_key, @permission_description);
      `);

    return result.recordset[0].permission_id;
  } catch (error: any) {
    if (error?.message?.includes("UQ_permissions_permission_key") || error?.message?.includes("duplicate")) {
      throw new HttpError(400, "Ya existe un permiso con esa clave");
    }
    throw error;
  }
}

export async function updatePermission(permissionId: number, input: UpdatePermissionInput) {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("permission_id", sql.Int, permissionId)
    .query<{ permission_id: number }>(`
      SELECT permission_id FROM sec.permissions WHERE permission_id = @permission_id;
    `);

  if (!existing.recordset[0]) {
    throw new HttpError(404, "Permiso no encontrado");
  }

  const sets: string[] = [];

  if (input.permission_key !== undefined) {
    sets.push("permission_key = @permission_key");
  }
  if (input.permission_description !== undefined) {
    sets.push("permission_description = @permission_description");
  }

  if (sets.length === 0) {
    throw new HttpError(400, "No hay cambios para actualizar");
  }

  try {
    const req = pool.request().input("permission_id", sql.Int, permissionId);

    if (input.permission_key !== undefined) {
      req.input("permission_key", sql.VarChar(80), input.permission_key);
    }
    if (input.permission_description !== undefined) {
      req.input("permission_description", sql.NVarChar(200), input.permission_description);
    }

    await req.query(`
      UPDATE sec.permissions SET ${sets.join(", ")}
      WHERE permission_id = @permission_id;
    `);
  } catch (error: any) {
    if (error?.message?.includes("UQ_permissions_permission_key") || error?.message?.includes("duplicate")) {
      throw new HttpError(400, "Ya existe un permiso con esa clave");
    }
    throw error;
  }
}

export async function deletePermission(permissionId: number) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const existing = await new sql.Request(tx)
      .input("permission_id", sql.Int, permissionId)
      .query<{ permission_key: string }>(`
        SELECT permission_key FROM sec.permissions WHERE permission_id = @permission_id;
      `);

    if (!existing.recordset[0]) {
      throw new HttpError(404, "Permiso no encontrado");
    }

    await new sql.Request(tx)
      .input("permission_id", sql.Int, permissionId)
      .query(`
        DELETE FROM sec.role_permissions WHERE permission_id = @permission_id;
      `);

    await new sql.Request(tx)
      .input("permission_id", sql.Int, permissionId)
      .query(`
        DELETE FROM sec.permissions WHERE permission_id = @permission_id;
      `);

    await tx.commit();
    return existing.recordset[0].permission_key;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function resetUserPassword(companyId: number, targetUserId: number, newPassword: string): Promise<void> {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, targetUserId)
    .query<{ username: string; is_active: boolean }>(`
      SELECT username, is_active
      FROM sec.users
      WHERE company_id = @company_id AND user_id = @user_id;
    `);

  if (!existing.recordset[0]) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  if (!existing.recordset[0].is_active) {
    throw new HttpError(400, "No se puede resetear la contrasena de un usuario inactivo");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, targetUserId)
    .input("password_hash", sql.NVarChar(255), passwordHash)
    .query(`
      UPDATE sec.users
      SET password_hash = @password_hash,
          updated_at = SYSUTCDATETIME()
      WHERE company_id = @company_id AND user_id = @user_id;
    `);
}
