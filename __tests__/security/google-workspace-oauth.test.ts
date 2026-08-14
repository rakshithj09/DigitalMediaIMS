import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const ignoredDirectories = new Set([".git", ".next", "coverage", "node_modules"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === path.basename(__filename)) return [];

    const fullPath = path.join(directory, entry);
    const relativePath = path.relative(root, fullPath);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return ignoredDirectories.has(entry) ? [] : sourceFiles(fullPath);
    }

    if (!sourceExtensions.has(path.extname(entry))) return [];
    if (relativePath.startsWith("__tests__")) return [];
    return [fullPath];
  });
}

describe("Google Workspace OAuth access", () => {
  it("does not request Google provider sign-in or Workspace scopes", () => {
    const forbiddenPatterns = [
      /GoogleAuthProvider/,
      /signInWithPopup/,
      /signInWithRedirect/,
      /\.addScope\(/,
      /https:\/\/www\.googleapis\.com\/auth\//,
      /gmail\.readonly/,
      /drive\.readonly/,
      /calendar\.readonly/,
      /classroom\./,
    ];

    const matches = sourceFiles(root).flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return forbiddenPatterns
        .filter((pattern) => pattern.test(content))
        .map((pattern) => `${path.relative(root, file)} matched ${pattern}`);
    });

    expect(matches).toEqual([]);
  });
});
