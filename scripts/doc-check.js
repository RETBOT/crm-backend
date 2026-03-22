const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const README = path.join(ROOT, "README.md");

function findRouteFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".routes.ts")) {
      results.push(fullPath);
    }
  }

  return results;
}

function extractEndpoints(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const endpoints = [];

  for (const line of lines) {
    const match = line.match(/router\.(get|post|put|delete)\(\s*["']([^"']+)["']/i);
    if (match) {
      endpoints.push({
        method: match[1].toUpperCase(),
        route: match[2],
        file: path.relative(ROOT, filePath),
      });
    }
  }

  return endpoints;
}

function checkReadmeCoverage(endpoints) {
  if (!fs.existsSync(README)) {
    console.error("README.md no encontrado");
    return;
  }

  const readme = fs.readFileSync(README, "utf-8");
  const undocumented = [];

  for (const ep of endpoints) {
    const routePattern = ep.route.replace(/:\w+/g, ":id");
    if (!readme.includes(routePattern) && !readme.includes(ep.route)) {
      undocumented.push(ep);
    }
  }

  console.log(`\nDocument Check - CRM Backend`);
  console.log(`${"=".repeat(40)}`);
  console.log(`Endpoints encontrados: ${endpoints.length}`);
  console.log(`Documentados en README: ${endpoints.length - undocumented.length}`);
  console.log(`Sin documentar: ${undocumented.length}`);

  if (undocumented.length > 0) {
    console.log(`\nEndpoints sin documentar en README.md:\n`);
    for (const ep of undocumented) {
      console.log(`  ${ep.method.padEnd(7)} ${ep.route}  (${ep.file})`);
    }
    console.log(`\nAgregalos a la tabla de endpoints en README.md`);
    process.exit(1);
  } else {
    console.log(`\nTodos los endpoints estan documentados.`);
  }
}

function checkPermissions() {
  const permsFile = path.join(SRC, "modules", "auth", "permissions.ts");
  if (!fs.existsSync(permsFile)) return;

  const content = fs.readFileSync(permsFile, "utf-8");
  const readme = fs.readFileSync(README, "utf-8");

  const permMatches = content.matchAll(/"([a-z_]+\.[a-z_]+)"/g);
  const perms = [...permMatches].map((m) => m[1]);
  const undocumented = perms.filter((p) => !readme.includes(p));

  console.log(`\nPermisos encontrados: ${perms.length}`);
  console.log(`Documentados: ${perms.length - undocumented.length}`);

  if (undocumented.length > 0) {
    console.log(`\nPermisos sin documentar:`);
    for (const p of undocumented) {
      console.log(`  - ${p}`);
    }
  }
}

// Run
const routeFiles = findRouteFiles(SRC);
const allEndpoints = routeFiles.flatMap(extractEndpoints);
checkReadmeCoverage(allEndpoints);
checkPermissions();
