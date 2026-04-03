import { getPool, sql } from "../../db/sqlserver";

export type ScopeType = "ALL" | "BRANCH" | "ROUTE";

export type EffectiveScope = {
  scopeType: ScopeType;
  branchIds: number[];
  routeIds: number[];
  branchIdsCsv: string;
  routeIdsCsv: string;
};

function toCsv(values: number[]): string {
  return values.filter((v) => Number.isInteger(v)).join(",");
}

function uniqueInts(values: Array<number | null | undefined>): number[] {
  return Array.from(new Set(values.filter((v): v is number => Number.isInteger(v))));
}

async function getConfiguredScope(
  companyId: number,
  userId: number
): Promise<{ scopeType: ScopeType | null; branchIds: number[]; routeIds: number[] }> {
  const pool = await getPool();

  const [scopeRes, branchesRes, routesRes] = await Promise.all([
    pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query<{ scope_type: ScopeType }>(`
        SELECT scope_type
        FROM sec.user_data_scope
        WHERE company_id = @company_id
          AND user_id = @user_id;
      `),
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
    scopeType: scopeRes.recordset[0]?.scope_type ?? null,
    branchIds: uniqueInts(branchesRes.recordset.map((r) => r.branch_id)),
    routeIds: uniqueInts(routesRes.recordset.map((r) => r.route_id)),
  };
}

async function getFallbackScope(companyId: number, userId: number): Promise<EffectiveScope> {
  const pool = await getPool();

  const [userRes, assignedRoutesRes] = await Promise.all([
    pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query<{ is_multi_branch: boolean; default_branch_id: number | null }>(`
        SELECT is_multi_branch, default_branch_id
        FROM sec.users
        WHERE company_id = @company_id
          AND user_id = @user_id;
      `),
    pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query<{ route_id: number; branch_id: number }>(`
        SELECT route_id, branch_id
        FROM crm.routes
        WHERE company_id = @company_id
          AND assigned_user_id = @user_id
          AND status = 'ACTIVO';
      `),
  ]);

  const user = userRes.recordset[0];
  if (!user) {
    return { scopeType: "BRANCH", branchIds: [], routeIds: [], branchIdsCsv: "", routeIdsCsv: "" };
  }

  if (user.is_multi_branch) {
    return { scopeType: "ALL", branchIds: [], routeIds: [], branchIdsCsv: "", routeIdsCsv: "" };
  }

  const assignedRouteIds = uniqueInts(assignedRoutesRes.recordset.map((r) => r.route_id));
  const assignedBranchIds = uniqueInts(assignedRoutesRes.recordset.map((r) => r.branch_id));

  if (assignedRouteIds.length > 0 && assignedBranchIds.length > 0) {
    return {
      scopeType: "ROUTE",
      branchIds: assignedBranchIds,
      routeIds: assignedRouteIds,
      branchIdsCsv: toCsv(assignedBranchIds),
      routeIdsCsv: toCsv(assignedRouteIds),
    };
  }

  const defaultBranchIds = user.default_branch_id ? [user.default_branch_id] : [];
  return {
    scopeType: "BRANCH",
    branchIds: defaultBranchIds,
    routeIds: [],
    branchIdsCsv: toCsv(defaultBranchIds),
    routeIdsCsv: "",
  };
}

export async function resolveUserScope(companyId: number, userId: number): Promise<EffectiveScope> {
  const configured = await getConfiguredScope(companyId, userId);

  if (!configured.scopeType) {
    return getFallbackScope(companyId, userId);
  }

  if (configured.scopeType === "ALL") {
    return { 
      scopeType: "ALL", 
      branchIds: configured.branchIds,
      routeIds: configured.routeIds,
      branchIdsCsv: toCsv(configured.branchIds),
      routeIdsCsv: toCsv(configured.routeIds)
    };
  }

  const branchIds = configured.branchIds;
  const routeIds = configured.routeIds;

  return {
    scopeType: configured.scopeType,
    branchIds,
    routeIds,
    branchIdsCsv: toCsv(branchIds),
    routeIdsCsv: toCsv(routeIds),
  };
}
