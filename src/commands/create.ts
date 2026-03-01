import fs from 'node:fs/promises'
import path from 'node:path'

import * as prettier from 'prettier'
import type { Surreal } from 'surrealdb'

import { loadConfig } from '../config'
import { type Surql, createSurql } from '../createSurql'
import { createSurreal } from '../createSurreal'
import generateRandomName from '../utils/generateRandomName'
import { loadJournal, saveJournal } from '../utils/journal'
import Snapshot from '../utils/Snapshot'

export type CreateOptions = {
  name?: string
  custom: boolean
  surql?: Surql
}

export async function create(options: CreateOptions) {
  const journal = await loadJournal()
  const name = options.name ?? generateRandomName()
  const index = journal.migrations.length
  const prefix = index.toString().padStart(4, '0')
  const config = await loadConfig()

  if (!config.baseDir) {
    throw new Error('migrations not initialized')
  }

  const fullName = `${prefix}_${name}`
  if (options.custom) {
    journal.migrations.push(fullName)
    await saveJournal(journal)

    await fs.writeFile(
      path.join(config.baseDir, `${fullName}.ts`),
      await prettier.format(
        `
        import type { MigrationOptions } from 'surreal-tools'

        export async function up({ surql }: MigrationOptions) {
          // add custom up code
        }
        
        export async function down({ surql }: MigrationOptions) {
          // add custom down code
        }
      `,
        { parser: 'typescript' },
      ),
    )

    return fullName
  }

  let surreal: Surreal | null = null
  const surql =
    options.surql ?? ((surreal = await createSurreal()), createSurql(surreal))

  const previousSnapshot =
    index > 0
      ? await Snapshot.createFromFile(
          path.join(
            config.baseDir,
            'meta',
            `${(index - 1).toString().padStart(4, '0')}_snapshot.json`,
          ),
        )
      : Snapshot.createEmpty()

  const snapshot = await Snapshot.createFromSurql(surql)
  const queries = snapshot.diff(previousSnapshot)
  if (queries.length === 0) {
    if (!options.surql) await surreal?.close()
    throw new Error('no changes detected')
  }

  await fs.writeFile(
    path.join(config.baseDir, 'meta', `${prefix}_snapshot.json`),
    await prettier.format(JSON.stringify({ namespaces: snapshot.namespaces }), {
      parser: 'json',
    }),
  )

  journal.migrations.push(fullName)
  await saveJournal(journal)

  const inverseQueries = previousSnapshot.diff(snapshot)

  await fs.writeFile(
    path.join(config.baseDir, `${fullName}.ts`),
    await prettier.format(
      `
        import type { MigrationOptions } from 'surreal-tools'

        export async function up({ surql }: MigrationOptions) {
          await surql\`\\n    ${queries.join(';\\n    ')};\\n  \`
        }
        
        export async function down({ surql }: MigrationOptions) {
          await surql\`\\n    ${inverseQueries.join(';\\n    ')};\\n  \`
        }
      `,
      { parser: 'typescript' },
    ),
  )

  if (!options.surql) await surreal?.close()

  return fullName
}
