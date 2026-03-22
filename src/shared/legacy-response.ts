export function loginError(message: string) {
  return { regresa: -1, mensaje: message };
}

export function loginSuccess(payload: {
  token: string;
  username: string;
  displayName: string;
  branchId: number | null;
  branchName: string | null;
  multiBranch: number;
  permissions: string[];
}) {
  return {
    regresa: 1,
    mensaje: "OK",
    token: payload.token,
    user_name: payload.username,
    user_dsc: payload.displayName,
    id_sucursal: payload.branchId,
    sucursal: payload.branchName,
    multi_suc: payload.multiBranch,
    permissions: payload.permissions,
  };
}

export function abcSuccess(msg: string) {
  return { resultado: 1, msg };
}

export function abcError(msg: string) {
  return { resultado: -1, msg };
}
