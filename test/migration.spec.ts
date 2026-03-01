import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
} from 'bun:test'

import { cleanup, setupSurql } from './utils'
import { applyMigrations } from '../src'
import { create } from '../src/commands/create'
import { init } from '../src/commands/init'
import type { Surql } from '../src/createSurql'

let surql!: Surql
let createSucceeded = false

beforeAll(async () => {
  await init({
    url: 'mem://',
  })
})

afterAll(async () => {
  await cleanup()
})

beforeEach(async () => {
  surql = await setupSurql()
})

afterEach(async () => {
  await surql.close()
})

it('should create a migration file', async () => {
  await surql`
      DEFINE TABLE user SCHEMAFULL;
      DEFINE FIELD name ON user TYPE string;
    `

  await create({ custom: false, surql })

  // Verify migration file was created
  const glob = new Bun.Glob('0000_*.ts')
  const migrationFiles = await Array.fromAsync(glob.scan('.surreal-migrations'))

  expect(migrationFiles).toHaveLength(1)

  const migrationContent = await Bun.file(
    `.surreal-migrations/${migrationFiles[0]!}`,
  ).text()

  expect(migrationContent).toContain('export async function up')
  expect(migrationContent).toContain('export async function down')
  expect(migrationContent).toContain('DEFINE TABLE OVERWRITE user')
  expect(migrationContent).toContain(
    'DEFINE FIELD OVERWRITE name ON user TYPE string PERMISSIONS FULL;',
  )

  // Verify snapshot was created
  const snapshotExists = await Bun.file(
    '.surreal-migrations/meta/0000_snapshot.json',
  ).exists()
  expect(snapshotExists).toBe(true)

  // Verify journal was updated
  const journal = await Bun.file('.surreal-migrations/meta/journal.json').json()
  expect(journal.migrations).toHaveLength(1)
  expect(journal.migrations[0]).toMatch(/^0000_/)

  createSucceeded = true
})

it('can apply migration file', async () => {
  if (!createSucceeded) {
    throw new Error(
      "Skipped: previous test 'should create a migration file' failed",
    )
  }

  const dbInfo = await surql`INFO FOR DB`.$type<{
    tables: Record<string, any>
  }>()
  expect(Object.keys(dbInfo.tables)).toHaveLength(0)

  const applied = await applyMigrations(surql)
  expect(applied).toBe(1)

  const dbInfoAfterMigration = await surql`INFO FOR DB`.$type<{
    tables: Record<string, any>
  }>()

  expect(dbInfoAfterMigration.tables.user).toStartWith('DEFINE TABLE user')
  const tableInfo = await surql`INFO FOR TABLE user`.$type<{
    fields: Record<string, string>
  }>()
  expect(tableInfo.fields.name).toStartWith('DEFINE FIELD name ON user')
})
