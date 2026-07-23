import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { PgnMerger } from "../src/lib/mergePgns";

type MergePgnArgs = {
  inputPaths: string[];
  outputPath: string;
};

function parseArgs(argv: string[]): MergePgnArgs {
  const outputIndex = argv.indexOf("--output");
  const outputPath = outputIndex === -1 ? undefined : argv[outputIndex + 1];
  if (outputPath === undefined) {
    throw new Error("Usage: bun run merge:pgn -- <file-or-directory> [...] --output <merged.pgn>");
  }

  const inputPaths = argv.filter((arg, index) => {
    if (arg === "--output") return false;
    if (index === outputIndex + 1) return false;
    return true;
  });

  if (inputPaths.length === 0) {
    throw new Error("At least one input PGN file or directory is required");
  }

  return { inputPaths, outputPath };
}

async function collectPgnPaths(inputPaths: string[], outputPath: string): Promise<string[]> {
  const resolvedOutputPath = resolve(outputPath);
  const collected = new Set<string>();

  for (const inputPath of inputPaths) {
    const resolvedInputPath = resolve(inputPath);
    if (resolvedInputPath === resolvedOutputPath) {
      throw new Error(`Output path is also an input: ${resolvedOutputPath}`);
    }
    await collectPgnPath(resolvedInputPath, resolvedOutputPath, collected);
  }

  return [...collected].sort((left, right) => left.localeCompare(right));
}

async function collectPgnPath(
  inputPath: string,
  outputPath: string,
  collected: Set<string>,
): Promise<void> {
  const inputStat = await stat(inputPath);
  if (inputStat.isFile()) {
    if (extname(inputPath).toLowerCase() !== ".pgn") {
      throw new Error(`Input file is not a PGN: ${inputPath}`);
    }
    collected.add(inputPath);
    return;
  }
  if (!inputStat.isDirectory()) {
    throw new Error(`Input is neither a file nor a directory: ${inputPath}`);
  }

  const entries = await readdir(inputPath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(inputPath, entry.name);
      if (entry.isDirectory()) {
        await collectPgnPath(entryPath, outputPath, collected);
      } else if (
        entry.isFile() &&
        entryPath !== outputPath &&
        extname(entry.name).toLowerCase() === ".pgn"
      ) {
        collected.add(entryPath);
      }
    }),
  );
}

async function main(): Promise<void> {
  const { inputPaths, outputPath } = parseArgs(process.argv.slice(2));
  const pgnPaths = await collectPgnPaths(inputPaths, outputPath);
  const resolvedOutputPath = resolve(outputPath);
  await requireMissingOutput(resolvedOutputPath);
  const firstPath = pgnPaths[0];
  if (firstPath === undefined) {
    throw new Error("No PGN files found");
  }

  let merger: PgnMerger;
  try {
    merger = new PgnMerger(await readFile(firstPath, "utf8"));
  } catch (error: unknown) {
    throw new Error(`Failed to parse ${firstPath}: ${errorMessage(error)}`);
  }
  for (let index = 1; index < pgnPaths.length; index += 1) {
    const pgnPath = pgnPaths[index];
    if (pgnPath === undefined) {
      throw new Error(`Missing PGN path at index ${index}`);
    }
    try {
      merger.add(await readFile(pgnPath, "utf8"));
    } catch (error: unknown) {
      throw new Error(`Failed to parse ${pgnPath}: ${errorMessage(error)}`);
    }
  }

  await writeFile(resolvedOutputPath, `${merger.toPgn()}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  process.stdout.write(`Merged ${pgnPaths.length} PGNs into ${resolvedOutputPath}\n`);
}

async function requireMissingOutput(outputPath: string): Promise<void> {
  try {
    await access(outputPath);
  } catch (error: unknown) {
    if (isErrorWithCode(error, "ENOENT")) {
      return;
    }
    throw error;
  }

  throw new Error(`Output already exists: ${outputPath}`);
}

function isErrorWithCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
});
