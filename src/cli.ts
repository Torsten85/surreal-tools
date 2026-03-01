#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { applyMigrations } from './applyMigrations'
import { create } from './commands/create'
import { init } from './commands/init'
import { loadConfig } from './config'
import { createSurql } from './createSurql'
import { createSurreal } from './createSurreal'
import logger from './utils/logger'

yargs(hideBin(process.argv))
  .command('migration', 'migration subcommands', (builder) =>
    builder
      .command(
        'init',
        'initialize migration',
        (subBuilder) =>
          subBuilder
            .option('url', { type: 'string' })
            .option('username', { type: 'string' })
            .option('password', { type: 'string' })
            .option('baseDir', {
              type: 'string',
            })
            .option('migrationDatabase', {
              type: 'string',
            })
            .option('migrationNamespace', {
              type: 'string',
            }),
        async (options) => {
          try {
            await init(options)
            logger.success('migrations initialized')
          } catch (error) {
            logger.error(String(error))
            process.exit(1)
          }
        },
      )
      .command(
        'create',
        'create migration',
        (subBuilder) =>
          subBuilder
            .option('name', { type: 'string' })
            .option('custom', { type: 'boolean', default: false }),
        async (options) => {
          try {
            const fullName = await create(options)
            logger.success(
              `${options.custom ? 'custom ' : ''}migration |${fullName}| created`,
            )
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === 'no changes detected'
            ) {
              logger.warn('no changes detected')
            } else {
              logger.error(String(error))
            }
            process.exit(1)
          }
        },
      )
      .command('apply', 'apply migrations', async () => {
        try {
          const config = await loadConfig()
          const surql = createSurql(await createSurreal(config))
          const applied = await applyMigrations(surql, config)
          if (applied > 0) {
            logger.success(
              `applied |${applied}| migration${applied === 1 ? '' : 's'}`,
            )
          } else {
            logger.warn('no migrations necessary')
          }
        } catch (error) {
          logger.error(
            `migrations failed: |${error instanceof Error ? error.message : String(error)}|`,
          )
        }
      })
      .demandCommand(1, 1)
      .strict(),
  )
  .help('h')
  .demandCommand(1, 1)
  .strict()
  .parse()
