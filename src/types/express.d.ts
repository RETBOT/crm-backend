import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: number;
      companyId: number;
      username: string;
      permissions: string[];
    };
  }
}
