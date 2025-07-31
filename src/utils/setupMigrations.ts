import fs from "node:fs/promises";
import { loadConfig } from "../config";
import { saveJournal } from "./journal";
import { type Surql } from "../createSurql";
import exists from "./exists";

async function checkMigrationSetup(
  surql: Surql,
  migrationNamespace: string,
  migrationDatabase: string
) {
  const [rootInfo] = await surql`INFO FOR ROOT`.$type<
    [{ namespaces: Record<string, string> }]
  >();

  if (!Object.hasOwn(rootInfo.namespaces, migrationNamespace)) {
    return false;
  }

  const [, nsInfo] = await surql`
      USE NS ${migrationNamespace};
      INFO FOR NS;
    `.$type<[undefined, { databases: Record<string, string> }]>();

  if (!Object.hasOwn(nsInfo.databases, migrationDatabase)) {
    return false;
  }

  const [, dbInfo] = await surql`
    USE NS ${migrationNamespace} DB ${migrationDatabase};
    INFO FOR DB;
  `.$type<[undefined, { tables: Record<string, string> }]>();

  if (
    dbInfo.tables.migrations !==
    "DEFINE TABLE migrations TYPE NORMAL SCHEMAFULL PERMISSIONS NONE"
  ) {
    return false;
  }

  const [, tableInfo] = await surql`
    USE NS ${migrationNamespace} DB ${migrationDatabase};
    INFO FOR TABLE migrations;
  `.$type<[undefined, { fields: Record<string, string> }]>();

  if (
    tableInfo.fields.id !==
    "DEFINE FIELD id ON migrations TYPE string ASSERT string::is::ulid(record::id($value)) PERMISSIONS FULL"
  ) {
    return false;
  }

  if (
    tableInfo.fields.name !==
    "DEFINE FIELD name ON migrations TYPE string PERMISSIONS FULL"
  ) {
    return false;
  }

  return true;
}

export default async function setupMigrations(surql: Surql) {
  const config = await loadConfig();
  if (
    !(config.baseDir && config.migrationNamespace && config.migrationDatabase)
  ) {
    throw new Error("migrations not initialized");
  }

  if (!(await exists(config.baseDir))) {
    await fs.mkdir(`${config.baseDir}/meta`, { recursive: true });
    await saveJournal({ migrations: [] });
  }

  const setupOk = await checkMigrationSetup(
    surql,
    config.migrationNamespace,
    config.migrationDatabase
  );

  if (!setupOk) {
    await surql`
    USE NS ${config.migrationNamespace} DB ${config.migrationDatabase};
    DEFINE NAMESPACE IF NOT EXISTS ${config.migrationNamespace};
    DEFINE DATABASE IF NOT EXISTS ${config.migrationDatabase};
    DEFINE TABLE OVERWRITE migrations SCHEMAFULL;
    DEFINE FIELD OVERWRITE id ON TABLE migrations TYPE string ASSERT string::is::ulid(record::id($value));
    DEFINE FIELD OVERWRITE name ON TABLE migrations TYPE string;
  `;
  }
}
