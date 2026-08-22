import fs from "node:fs";
import path from "node:path";
import { applySan, createChessPosition, positionKey } from "../src/lib/chess";

const OPENINGS_COMMIT = "4b8622759e7ae6f93f011cc6c83a3823401ab45e";
const OPENINGS_FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"] as const;
const OPENINGS_BASE_URL = `https://raw.githubusercontent.com/lichess-org/chess-openings/${OPENINGS_COMMIT}`;
const OUTPUT_PATH = path.join(
  process.cwd(),
  "public",
  `openings-${OPENINGS_COMMIT.slice(0, 8)}.json`,
);

type OpeningDataRow = readonly [positionKey: string, eco: string, name: string];

async function download(file: string): Promise<string> {
  const response = await fetch(`${OPENINGS_BASE_URL}/${file}`);
  if (!response.ok) throw new Error(`Failed to download ${file}: ${response.status}`);
  return await response.text();
}

function openingRow(line: string): OpeningDataRow {
  const columns = line.split("\t");
  const eco = columns[0];
  const name = columns[1];
  const pgn = columns[2];
  if (eco === undefined || name === undefined || pgn === undefined) {
    throw new Error(`Invalid opening row: ${line}`);
  }

  const position = createChessPosition();
  for (const token of pgn.split(" ")) {
    if (/^\d+\.$/.test(token)) continue;
    applySan(position, token);
  }
  return [positionKey(position), eco, name];
}

async function main(): Promise<void> {
  const sources = await Promise.all(OPENINGS_FILES.map(download));
  const rows = sources.flatMap((source) => source.trim().split("\n").slice(1).map(openingRow));

  if (new Set(rows.map(([key]) => key)).size !== rows.length) {
    throw new Error("Opening data contains duplicate position keys");
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(rows));
  console.log(`Generated ${rows.length} openings at ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

void main();
