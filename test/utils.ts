import { createNodeEngines } from '@surrealdb/node'
import { $ } from 'bun'
import { Surreal, createRemoteEngines } from 'surrealdb'

import { resetConfig } from '../src/config'
import { createSurql } from '../src/createSurql'

const { dir } = import.meta
process.chdir(dir)

export async function cleanup() {
  resetConfig()
  await $`rm -rf ${`${dir}/surreal.config.ts`} ${`${dir}/.surreal-migrations`}`.quiet()
}

export async function setupSurql() {
  const surreal = new Surreal({
    engines: {
      ...createRemoteEngines(),
      ...createNodeEngines(),
    },
  })
  await surreal.connect('mem://', { namespace: 'test', database: 'test' })
  return createSurql(surreal)
}
