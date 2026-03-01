import { type RecordId, Surreal } from 'surrealdb'
import type { z } from 'zod/v4'

import { configSchema } from './config'
import { type Surql, createSurql } from './createSurql'
import { loadJournal } from './utils/journal'
import loadTsFile from './utils/loadTsFile'
import setupMigrations from './utils/setupMigrations'

const migrationOptionsSchema = configSchema.pick({
  migrationNamespace: true,
  migrationDatabase: true,
  baseDir: true,
})

type MigrationOptions = z.input<typeof migrationOptionsSchema>

export async function applyMigrations(
  surrealOrSurql: Surql | Surreal,
  config: MigrationOptions = {},
) {
  const surql =
    surrealOrSurql instanceof Surreal
      ? createSurql(surrealOrSurql)
      : surrealOrSurql
  await setupMigrations(surql)
  const usedConfig = migrationOptionsSchema.parse(config)

  const [, appliedMigrations] = await surql`
          USE NS ${usedConfig.migrationNamespace} DB ${usedConfig.migrationDatabase};
          SELECT * FROM migrations ORDER BY id;
        `.$type<[undefined, Array<{ id: RecordId; name: string }>]>()

  const journal = await loadJournal()
  let applied = 0
  for (const migration of journal.migrations) {
    if (appliedMigrations.some((m) => m.name === migration)) {
      continue
    }

    const migrationModule = await loadTsFile(
      usedConfig.baseDir,
      `${migration}.ts`,
    )

    if (typeof migrationModule.up !== 'function') {
      throw new Error(`Invalid migration ${migration}`)
    }

    await migrationModule.up({ surql })
    await surql`
        USE NS ${usedConfig.migrationNamespace} DB ${usedConfig.migrationDatabase};
        CREATE migrations:ulid() SET name = $name;
      `.vars({ name: migration })

    applied += 1
  }
  return applied
}
