import { afterAll, expect, it } from 'bun:test'

import { cleanup } from './utils'
import { init } from '../src/commands/init'

it('initializes with mem:// url', async () => {
  await init({
    url: 'mem://',
    baseDir: '.surreal-migrations',
    migrationDatabase: 'migrations',
    migrationNamespace: 'migrations',
  })

  const configContent = await Bun.file('surreal.config.ts').text()

  expect(configContent).toContain('url: "mem://"')
  expect(configContent).toContain('migrationNamespace: "migrations"')
  expect(configContent).toContain('migrationDatabase: "migrations"')
  expect(configContent).toContain('baseDir: ".surreal-migrations"')

  const baseDirExists = await Bun.file(
    '.surreal-migrations/meta/journal.json',
  ).exists()
  expect(baseDirExists).toBe(true)

  const journal = await Bun.file('.surreal-migrations/meta/journal.json').json()
  expect(journal).toEqual({ migrations: [] })
})

afterAll(async () => {
  await cleanup()
})
