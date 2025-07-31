import loadTsFile from "./utils/loadTsFile";
import fs from "node:fs/promises";
import * as prettier from "prettier";
import exists from "./utils/exists";

export const configFileName = "surreal.config.ts";

export type Config = {
  url: string;
  baseDir: string;
  migrationDatabase: string;
  migrationNamespace: string;
  authentication?: {
    username: string;
    password: string;
  };
};

export function defineConfig(config: Config) {
  return config;
}

let loadedConfig: Config;
export async function loadConfig() {
  if (!loadedConfig) {
    if (!(await exists(configFileName))) {
      throw new Error("config does not exist");
    }

    const { default: config } = await loadTsFile(configFileName);
    loadedConfig = config;
  }
  return loadedConfig;
}

export async function saveConfig(config: Config) {
  await fs.writeFile(
    "surreal.config.ts",
    await prettier.format(
      `
      import { defineConfig } from 'surreal-tools'
      
      export default defineConfig(
        ${JSON.stringify(config, null, 2)}
      )
      `,
      { parser: "typescript" }
    )
  );
}
