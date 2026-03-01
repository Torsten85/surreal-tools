import { Surreal, createRemoteEngines } from 'surrealdb'

import { type Config, loadConfig } from './config'

export async function createSurreal(config?: Config) {
  const usedConfig = config ?? (await loadConfig())

  const nodeEngines = /^(mem|rocksdb|surrealkv):\/\//.test(usedConfig.url)
    ? (await import('@surrealdb/node')).createNodeEngines()
    : {}

  const surreal = new Surreal({
    engines: {
      ...createRemoteEngines(),
      ...nodeEngines,
    },
  })

  await surreal.connect(usedConfig.url, {
    authentication: usedConfig.authentication,
  })

  return surreal
}
