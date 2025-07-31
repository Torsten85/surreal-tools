#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { configFileName, loadConfig, saveConfig, type Config } from "./config";
import fs from "node:fs/promises";
import * as prettier from "prettier";
import setupMigrations from "./utils/setupMigrations";
import createSurreal from "./createSurreal";
import createSurql from "./createSurql";
import type Surreal from "surrealdb";
import logger from "./utils/logger";
import { loadJournal, saveJournal } from "./utils/journal";
import Snapshot from "./utils/Snapshot";
import path from "node:path";
import generateRandomName from "./utils/generateRandomName";
import applyMigrations from "./applyMigrations";
import exists from "./utils/exists";

yargs(hideBin(process.argv))
  .command("migration", "migration subcommands", (builder) =>
    builder
      .command(
        "init",
        "initialize migration",
        (subBuilder) =>
          subBuilder
            .option("url", { type: "string" })
            .option("username", { type: "string" })
            .option("password", { type: "string" })
            .option("baseDir", {
              type: "string",
              default: ".surreal-migrations",
            })
            .option("migrationDatabase", {
              type: "string",
              default: "migrations",
            })
            .option("migrationNamespace", {
              type: "string",
              default: "migrations",
            }),
        async (options) => {
          if (await exists(options.baseDir)) {
            logger.warn(`directory |${options.baseDir}| already exists`);
            process.exit(1);
          }

          if (!(await exists(configFileName))) {
            const config: Config = {
              url: options.url ?? "ws://localhost:8000",
              migrationNamespace: options.migrationNamespace,
              migrationDatabase: options.migrationDatabase,
              baseDir: options.baseDir,
            };

            if (options.username && options.password) {
              config.authentication = {
                username: options.username,
                password: options.password,
              };
            }

            await saveConfig(config);
          }

          let surreal: Surreal | null = null;
          try {
            surreal = await createSurreal();
            const surql = createSurql(surreal);
            await setupMigrations(surql);

            logger.success("migrations initialized");
          } catch (error) {
            try {
              await fs.rm(options.baseDir, {
                recursive: true,
              });
            } catch {}
            logger.error(String(error));
            process.exit(1);
          } finally {
            surreal?.close();
          }
        }
      )
      .command(
        "create",
        "create migration",
        (subBuilder) =>
          subBuilder
            .option("name", { type: "string" })
            .option("custom", { type: "boolean", default: false }),
        async (options) => {
          const journal = await loadJournal();
          const name = options.name ?? generateRandomName();
          const index = journal.migrations.length;
          const prefix = index.toString().padStart(4, "0");
          const config = await loadConfig();

          if (!config.baseDir) {
            logger.error("migrations not initialized");
            process.exit(1);
          }

          const fullName = `${prefix}_${name}`;
          if (options.custom) {
            journal.migrations.push(fullName);
            await saveJournal(journal);

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
                { parser: "typescript" }
              )
            );

            logger.success(`custom migration |${fullName}| created`);
            process.exit(0);
          }

          const surreal = await createSurreal();
          const surql = createSurql(surreal);

          const previousSnapshot =
            index > 0
              ? await Snapshot.createFromFile(
                  path.join(
                    config.baseDir,
                    "meta",
                    `${(index - 1).toString().padStart(4, "0")}_snapshot.json`
                  )
                )
              : Snapshot.createEmpty();

          const snapshot = await Snapshot.createFromSurql(surql);

          const queries = snapshot.diff(previousSnapshot);
          if (queries.length === 0) {
            logger.warn("no changes detected");
            await surreal.close();
            process.exit(0);
          }

          await fs.writeFile(
            path.join(config.baseDir, "meta", `${prefix}_snapshot.json`),
            await prettier.format(
              JSON.stringify({ namespaces: snapshot.namespaces }),
              { parser: "json" }
            )
          );

          journal.migrations.push(fullName);
          await saveJournal(journal);

          const inverseQueries = previousSnapshot.diff(snapshot);

          await fs.writeFile(
            path.join(config.baseDir, `${fullName}.ts`),
            await prettier.format(
              `
                import type { MigrationOptions } from 'surreal-tools'

                export async function up({ surql }: MigrationOptions) {
                  await surql\`\n\t\t${queries.join(";\n\t\t")};\n\t\`
                }
                
                export async function down({ surql }: MigrationOptions) {
                  await surql\`\n\t\t${inverseQueries.join(";\n\t\t")};\n\t\`
                }
              `,
              { parser: "typescript" }
            )
          );

          await surreal.close();

          logger.success(`migration |${fullName}| created`);
        }
      )
      .command("apply", "apply migrations", async () => {
        try {
          const applied = await applyMigrations();
          if (applied > 0) {
            logger.success(
              `applied |${applied}| migration${applied === 1 ? "" : "s"}`
            );
          } else {
            logger.warn(`no migrations necessary`);
          }
        } catch (error) {
          logger.error(
            `migrations failed: |${error instanceof Error ? error.message : String(error)}|`
          );
        }
      })
      .demandCommand(1, 1)
      .strict()
  )
  .help("h")
  .demandCommand(1, 1)
  .strict()
  .parse();
