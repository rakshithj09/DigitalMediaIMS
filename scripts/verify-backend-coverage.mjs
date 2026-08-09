import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "lib", "scripts", "__tests__"];
const ROOT_FILES = ["package.json", "package-lock.json", "firebase.json", "firestore.rules", "firestore.indexes.json"];
const REQUIRED_COLLECTIONS = [
  "profiles",
  "students",
  "equipment",
  "checkouts",
  "student_approval_requests",
  "approved_teachers",
];
const FEATURE_MATRIX = [
  ["Dashboard active checkouts", ["checkouts", "students", "equipment"]],
  ["Checkout and check-in", ["checkouts", "students", "equipment"]],
  ["Saved history", ["checkouts", "students", "equipment"]],
  ["Equipment inventory", ["equipment", "checkouts"]],
  ["Student roster", ["students", "profiles"]],
  ["Student approvals", ["student_approval_requests", "students"]],
  ["Teacher approvals", ["approved_teachers", "profiles"]],
];
const REQUIRED_ADMIN_ROUTES = [
  "app/api/admin/add-student-roster/route.ts",
  "app/api/admin/create-student/route.ts",
  "app/api/admin/student-approvals/route.ts",
  "app/api/admin/students/route.ts",
  "app/api/admin/teacher-approvals/route.ts",
];
const REQUIRED_INDEXES = [
  ["students", ["period", "is_active", "name"]],
  ["students", ["user_id", "is_active"]],
  ["equipment", ["is_active", "name"]],
  ["checkouts", ["checked_in_at", "period", "checked_out_at"]],
  ["checkouts", ["checked_in_at", "period", "student_id", "checked_out_at"]],
  ["checkouts", ["student_id", "checked_out_at"]],
  ["checkouts", ["student_id", "checked_in_at", "checked_out_at"]],
  ["checkouts", ["equipment_id", "checked_in_at"]],
  ["checkouts", ["equipment_id", "checked_out_at"]],
  ["student_approval_requests", ["approved_at", "requested_at"]],
];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) return walk(full);
    return [full];
  });
}

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function hasIndex(indexes, collectionGroup, fields) {
  return indexes.some((index) => {
    const indexFields = index.fields.map((field) => field.fieldPath);
    return index.collectionGroup === collectionGroup
      && fields.every((field, position) => indexFields[position] === field);
  });
}

const failures = [];
const sourceFiles = SOURCE_DIRS.flatMap((dir) => walk(join(ROOT, dir)))
  .filter((path) => /\.(js|mjs|ts|tsx|json|rules)$/.test(path));
const rootFiles = ROOT_FILES.map((path) => join(ROOT, path)).filter((path) => existsSync(path));
const sourceText = [...sourceFiles, ...rootFiles].map((path) => [relative(ROOT, path), readFileSync(path, "utf8")]);

for (const [path, text] of sourceText) {
  if (path === "scripts/verify-backend-coverage.mjs") continue;
  if (/@supabase|supabaseUrl|SUPABASE|NEXT_PUBLIC_SUPABASE/.test(text)) {
    failures.push(`Supabase reference found in ${path}`);
  }
}

for (const route of REQUIRED_ADMIN_ROUTES) {
  const text = read(route);
  if (!text.includes("createFirebaseServerAuthClient")) {
    failures.push(`${route} does not verify Firebase auth`);
  }
  if (!text.includes('role !== "Teacher"')) {
    failures.push(`${route} does not require the Teacher role exactly`);
  }
}

const rules = read("firestore.rules");
for (const collection of REQUIRED_COLLECTIONS) {
  if (!rules.includes(`match /${collection}/`)) {
    failures.push(`firestore.rules is missing ${collection}`);
  }
}
for (const writablePattern of [
  /allow create, update, delete: if false;/,
  /allow write: if false;/,
]) {
  if (!writablePattern.test(rules)) {
    failures.push("firestore.rules does not clearly deny direct browser writes");
  }
}

const indexes = JSON.parse(read("firestore.indexes.json")).indexes;
for (const [collectionGroup, fields] of REQUIRED_INDEXES) {
  if (!hasIndex(indexes, collectionGroup, fields)) {
    failures.push(`Missing index for ${collectionGroup}: ${fields.join(", ")}`);
  }
}

console.log("Firebase backend coverage");
console.log("=========================");
for (const [feature, collections] of FEATURE_MATRIX) {
  console.log(`${feature}: ${collections.join(", ")}`);
}

if (failures.length > 0) {
  console.error("\nFailures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nAll static backend coverage checks passed.");
