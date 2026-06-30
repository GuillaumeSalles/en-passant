import { readFile, writeFile } from "node:fs/promises";
import { mergePgns } from "../src/lib/mergePgns";

type MergePgnArgs = {
  firstPath: string;
  secondPath: string;
  outputPath: string | null;
};

function parseArgs(argv: string[]): MergePgnArgs {
  const outputIndex = argv.indexOf("--output");
  const outputPath = outputIndex === -1 ? null : argv[outputIndex + 1];
  if (outputIndex !== -1 && outputPath === undefined) {
    throw new Error("Missing value for --output");
  }

  const positional = argv.filter((arg, index) => {
    if (arg === "--output") return false;
    if (outputIndex !== -1 && index === outputIndex + 1) return false;
    return true;
  });

  const firstPath = positional[0];
  const secondPath = positional[1];
  if (firstPath === undefined || secondPath === undefined || positional.length !== 2) {
    throw new Error("Usage: npm run merge:pgn -- <first.pgn> <second.pgn> [--output merged.pgn]");
  }

  return { firstPath, secondPath, outputPath: outputPath ?? null };
}

async function main(): Promise<void> {
  const { firstPath, secondPath, outputPath } = parseArgs(process.argv.slice(2));
  const [firstPgn, secondPgn] = await Promise.all([
    readFile(firstPath, "utf8"),
    readFile(secondPath, "utf8"),
  ]);
  const mergedPgn = mergePgns(firstPgn, secondPgn);

  if (outputPath === null) {
    process.stdout.write(`${mergedPgn}\n`);
    return;
  }

  await writeFile(outputPath, `${mergedPgn}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
