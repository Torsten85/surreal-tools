import fs from 'node:fs/promises'

import * as prettier from 'prettier'
import { z } from 'zod/v4'

import exists from './utils/exists'
import loadTsFile from './utils/loadTsFile'

export const configFileName = 'surreal.config.ts'

export const configSchema = z.object({
  url: z
    .string()
    .regex(
      /^(wss?|https?|mem|rocksdb|surrealkv):\/\//,
      'URL must start with a valid protocol (ws://, wss://, http://, https://, mem://, rocksdb://, surrealkv://)',
    )
    .default('ws://localhost:8000'),
  baseDir: z.string().default('.surreal-migrations'),
  migrationDatabase: z.string().default('migrations'),
  migrationNamespace: z.string().default('migrations'),
  authentication: z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .optional(),
})

export type Config = z.output<typeof configSchema>
export type InputConfig = z.input<typeof configSchema>
export function defineConfig(config: Config) {
  return config
}

let loadedConfig: Config
export async function loadConfig() {
  if (!loadedConfig) {
    if (!(await exists(configFileName))) {
      throw new Error('config does not exist')
    }

    const { default: config } = await loadTsFile(configFileName)
    loadedConfig = config
  }
  return loadedConfig
}

export function resetConfig() {
  loadedConfig = undefined!
}

export function setConfig(config: Config) {
  loadedConfig = config
}

export async function saveConfig(config: Config) {
  await fs.writeFile(
    configFileName,
    await prettier.format(
      `
      import { defineConfig } from 'surreal-tools'
      
      export default defineConfig(
        ${JSON.stringify(config, null, 2)}
      )
      `,
      { parser: 'typescript' },
    ),
  )
}
