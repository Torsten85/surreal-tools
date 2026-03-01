import fs from 'node:fs/promises'

import {
  type InputConfig,
  configFileName,
  configSchema,
  saveConfig,
  setConfig,
} from '../config'
import { type Surql, createSurql } from '../createSurql'
import { createSurreal } from '../createSurreal'
import exists from '../utils/exists'
import setupMigrations from '../utils/setupMigrations'

export async function init(
  inputConfig: InputConfig & { username?: string; password?: string },
) {
  const config = configSchema.parse({
    ...inputConfig,
    authentication:
      inputConfig.username && inputConfig.password
        ? { password: inputConfig.password, username: inputConfig.username }
        : undefined,
  } satisfies InputConfig)
  if (await exists(config.baseDir)) {
    throw new Error(`directory ${config.baseDir} already exists`)
  }

  if (!(await exists(configFileName))) {
    const url = config.url ?? 'ws://localhost:8000'

    if (/^mem:\/\/.+/.test(url)) {
      throw new Error(
        'Using a path with an in-memory database is not supported. Only mem:// is accepted.',
      )
    }

    if (/^(mem|rocksdb|surrealkv):\/\//.test(url)) {
      try {
        await import('@surrealdb/node')
      } catch {
        const protocol = url.split('://')[0]
        throw new Error(
          `The @surrealdb/node package is required for the ${protocol}:// protocol. Install it with: npm install @surrealdb/node`,
        )
      }
    }

    await saveConfig(config)
    setConfig(config)
  }

  let surql: Surql | null = null
  try {
    surql = createSurql(await createSurreal())
    await setupMigrations(surql)
  } catch (error) {
    try {
      await fs.rm(config.baseDir, { recursive: true })
    } catch {
      //
    }
    throw error
  } finally {
    await surql?.close()
  }
}
