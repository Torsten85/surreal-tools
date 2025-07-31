import { loadConfig } from "../config";
import fs from "node:fs/promises";
import path from "node:path";
import * as prettier from "prettier";

type Journal = {
  migrations: string[];
};

export async function saveJournal(journal: Journal) {
  const config = await loadConfig();

  if (!config.baseDir) {
    throw new Error("migrations not initialized");
  }

  await fs.writeFile(
    path.join(config.baseDir, "meta", "journal.json"),
    await prettier.format(JSON.stringify(journal), { parser: "json" })
  );
}

export async function loadJournal() {
  const config = await loadConfig();

  if (!config.baseDir) {
    throw new Error("migrations not initialized");
  }

  return JSON.parse(
    await fs.readFile(
      path.join(config.baseDir, "meta", "journal.json"),
      "utf-8"
    )
  ) as Journal;
}
