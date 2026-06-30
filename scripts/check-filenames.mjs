import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const forbiddenNames = new Set([
  "computer-analysis.tsx",
  "computer-evaluation.tsx",
  "eval-badge.tsx",
  "eval-bar.tsx",
  "eval-line.tsx",
  "load-pgn-dialog.tsx",
  "moves-tree.tsx",
]);

const pascalCaseFile = /^[A-Z][A-Za-z0-9]*\.(tsx|ts)$/;
const hookFile = /^use[A-Z][A-Za-z0-9]*\.ts$/;
const lowerCaseFile = /^[a-z][a-z0-9-]*\.(tsx|ts)$/;

function relative(filePath) {
  return path.relative(root, filePath);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(filePath);
    }
    return [filePath];
  });
}

function isSourceFile(filePath) {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

function isTestFile(filePath) {
  return filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx");
}

function isUiPrimitive(filePath) {
  return relative(filePath).startsWith("src/components/ui/");
}

function isChessboardHelper(filePath) {
  const rel = relative(filePath);
  return (
    rel === "src/components/Chessboard/pieces.tsx" || rel === "src/components/Chessboard/utils.ts"
  );
}

function isComponentService(filePath) {
  return relative(filePath) === "src/components/engine.ts";
}

function validate(filePath) {
  const fileName = path.basename(filePath);
  const rel = relative(filePath);
  const errors = [];

  if (forbiddenNames.has(fileName)) {
    errors.push(`${rel}: old React-style lowercase component filename is forbidden`);
  }

  if (!rel.startsWith("src/components/") || !isSourceFile(filePath) || isTestFile(filePath)) {
    return errors;
  }

  if (isUiPrimitive(filePath)) {
    if (!lowerCaseFile.test(fileName) && !pascalCaseFile.test(fileName)) {
      errors.push(`${rel}: UI primitive files must be kebab/lowercase or PascalCase`);
    }
    return errors;
  }

  if (isChessboardHelper(filePath)) {
    return errors;
  }

  if (isComponentService(filePath)) {
    return errors;
  }

  if (hookFile.test(fileName)) {
    return errors;
  }

  if (!pascalCaseFile.test(fileName)) {
    errors.push(`${rel}: component files must use PascalCase`);
  }

  return errors;
}

const errors = walk(sourceRoot).flatMap(validate);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
