// Generate native SVG assets from the canonical, licensed web piece artwork.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/components/Chessboard/pieces.tsx", "utf8");
function element(tag, attributes, ...children) {
  const attrs = Object.entries(attributes ?? {})
    .filter(([name, value]) => name !== "ref" && value !== undefined)
    .map(([name, value]) => {
      const text =
        name === "style"
          ? Object.entries(value)
              .map(([key, item]) => `${key}:${item}`)
              .join(";")
          : String(value);
      return ` ${name}="${text.replaceAll('"', "&quot;")}"`;
    })
    .join("");
  return `<${tag}${attrs}>${children.flat().join("")}</${tag}>`;
}
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const context = { exports: {}, React: { createElement: element } };
vm.runInNewContext(compiled, context, { timeout: 1000 });
const artwork = Object.fromEntries(
  Object.entries(context.exports.defaultPieces).map(([piece, render]) => [piece, render({})]),
);
const output = `${JSON.stringify(artwork, null, 2)}\n`;
const destination = "apps/native/src/pieceArtwork.json";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(destination, "utf8") !== output)
    throw new Error("Run npm run native:artwork to update the native chess artwork.");
} else fs.writeFileSync(destination, output);

const engineOutput = `${JSON.stringify(fs.readFileSync("public/stockfish-18-lite-single.js", "utf8"))}\n`;
const engineDestination = "apps/native/src/stockfishSource.json";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(engineDestination, "utf8") !== engineOutput)
    throw new Error("Run npm run native:artwork to update the bundled engine source.");
} else fs.writeFileSync(engineDestination, engineOutput);
