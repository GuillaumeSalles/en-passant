import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const checkedRoots = ["src", "tests", "scripts"].map((dir) => path.join(root, dir));
const sourceRoot = path.join(root, "src");
const coreLibFiles = new Set(
  [
    "src/lib/AppState.ts",
    "src/lib/chess.ts",
    "src/lib/commentShortcutEvents.ts",
    "src/lib/createStore.ts",
    "src/lib/engine.ts",
    "src/lib/pgn-parser.ts",
    "src/lib/utils.ts",
  ].map((filePath) => path.normalize(filePath)),
);
const optionalBooleanPropAllowlist = new Set(
  [
    "src/App.tsx:SidebarFooter.showGlobalActions",
    "src/App.tsx:GlobalActions.showAbout",
    "src/components/Chessboard/Chessboard.tsx:ChessboardProps.canDrag",
    "src/components/LoadPgnDialog.tsx:LoadPGNDialog.open",
    "src/components/ui/HorizontalDashedDivider.tsx:HorizontalDashedDivider.animate",
    "src/components/ui/checkbox.tsx:CheckboxProps.checked",
    "src/components/ui/checkbox.tsx:CheckboxProps.disabled",
    "src/components/ui/context-menu.tsx:ContextMenuTrigger.disabled",
    "src/components/ui/context-menu.tsx:ContextMenuItem.inset",
    "src/components/ui/dialog.tsx:Dialog.open",
    "src/components/ui/dialog.tsx:DialogTrigger.asChild",
    "src/components/ui/dialog.tsx:DialogClose.asChild",
    "src/components/ui/dropdown-menu.tsx:DropdownMenu.open",
    "src/components/ui/dropdown-menu.tsx:DropdownMenuTrigger.asChild",
    "src/components/ui/dropdown-menu.tsx:DropdownMenuItem.inset",
    "src/components/ui/dropdown-menu.tsx:DropdownMenuLabel.inset",
    "src/components/ui/inline-edit-input.tsx:InlineEditInputProps.autoFocus",
    "src/components/ui/switch.tsx:SwitchProps.checked",
    "src/components/ui/switch.tsx:SwitchProps.disabled",
    "src/components/ui/tooltip.tsx:TooltipTrigger.asChild",
    "src/lib/app-state/pgnTree.ts:addMove.forceBlackMoveNumber",
  ].map((entry) => path.normalize(entry)),
);

function relative(filePath) {
  return path.relative(root, filePath);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(filePath);
    }
    return [filePath];
  });
}

function isCheckedFile(filePath) {
  return /\.(mjs|js|ts|tsx)$/.test(filePath);
}

function isProductionSource(filePath) {
  const rel = relative(filePath);
  return filePath.startsWith(sourceRoot) && !rel.endsWith(".test.ts") && !rel.endsWith(".test.tsx");
}

function scriptKind(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.JS;
}

function lineAndColumn(sourceFile, position) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
  return `${line + 1}:${character + 1}`;
}

function importText(node) {
  if (!ts.isStringLiteral(node.moduleSpecifier)) return null;
  return node.moduleSpecifier.text;
}

function isForbiddenCoreImport(specifier) {
  return (
    specifier.startsWith("@/components") ||
    specifier.startsWith("@/app") ||
    specifier.startsWith("@/mutations")
  );
}

function isDoubleUnknownAssertion(node) {
  if (!ts.isAsExpression(node)) return false;
  if (node.type.kind !== ts.SyntaxKind.UnknownKeyword) return false;
  return ts.isAsExpression(node.parent);
}

function typeIncludesBoolean(typeNode) {
  if (typeNode === undefined) return false;
  if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) return true;
  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.some(typeIncludesBoolean);
  }
  if (ts.isParenthesizedTypeNode(typeNode)) return typeIncludesBoolean(typeNode.type);
  return false;
}

function namedScope(node) {
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    return node.name.text;
  }
  if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
    return node.name.text;
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    return node.name.text;
  }
  return null;
}

function hasExpectErrorDescription(line) {
  return /@ts-expect-error\s+\S/.test(line);
}

const files = checkedRoots.flatMap(walk).filter(isCheckedFile);
const errors = [];

for (const filePath of files) {
  const rel = relative(filePath);
  const normalizedRel = path.normalize(rel);
  const isGuardrailScript = normalizedRel === path.normalize("scripts/check-code-guardrails.mjs");
  const text = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath),
  );

  if (!isGuardrailScript) {
    text.split("\n").forEach((line, index) => {
      if (line.includes("@ts-ignore")) {
        errors.push(
          `${rel}:${index + 1}: @ts-ignore is forbidden; fix the type or use a described @ts-expect-error`,
        );
      }
      if (line.includes("@ts-expect-error") && !hasExpectErrorDescription(line)) {
        errors.push(`${rel}:${index + 1}: @ts-expect-error must include a short description`);
      }
    });
  }

  function visit(node, scopes = []) {
    const scope = namedScope(node);
    const nextScopes = scope === null ? scopes : [...scopes, scope];

    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      errors.push(
        `${rel}:${lineAndColumn(sourceFile, node.getStart(sourceFile))}: any is forbidden`,
      );
    }

    if (isProductionSource(filePath) && ts.isNonNullExpression(node)) {
      errors.push(
        `${rel}:${lineAndColumn(sourceFile, node.getStart(sourceFile))}: non-null assertions are forbidden in source; add a guard or require* helper`,
      );
    }

    if (isDoubleUnknownAssertion(node)) {
      errors.push(
        `${rel}:${lineAndColumn(sourceFile, node.getStart(sourceFile))}: double assertions through unknown are forbidden`,
      );
    }

    if (
      isProductionSource(filePath) &&
      !rel.endsWith(".d.ts") &&
      ts.isPropertySignature(node) &&
      node.questionToken !== undefined &&
      typeIncludesBoolean(node.type)
    ) {
      const scopeName = nextScopes.at(-1) ?? "<inline>";
      const propName = node.name.getText(sourceFile);
      const key = path.normalize(`${rel}:${scopeName}.${propName}`);
      if (!optionalBooleanPropAllowlist.has(key)) {
        errors.push(
          `${rel}:${lineAndColumn(sourceFile, node.getStart(sourceFile))}: optional boolean prop ${scopeName}.${propName} must be required, or explicitly allowlisted in scripts/check-code-guardrails.mjs`,
        );
      }
    }

    if (coreLibFiles.has(normalizedRel) && ts.isImportDeclaration(node)) {
      const specifier = importText(node);
      if (specifier !== null && isForbiddenCoreImport(specifier)) {
        errors.push(
          `${rel}:${lineAndColumn(sourceFile, node.getStart(sourceFile))}: core lib code cannot import ${specifier}`,
        );
      }
    }

    ts.forEachChild(node, (child) => visit(child, nextScopes));
  }

  visit(sourceFile);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
