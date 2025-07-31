import { z } from "zod/v4";
import type { Surql } from "../createSurql";
import fs from "node:fs/promises";
import { loadConfig } from "../config";

function overwrite(str: string) {
  return str.replace(/^DEFINE ([^ ]+) (?!OVERWRITE )/, "DEFINE $1 OVERWRITE ");
}

const snapshotSchema = z.object({
  namespaces: z.record(
    z.string(),
    z.object({
      create: z.string(),
      databases: z.record(
        z.string(),
        z.object({
          create: z.string(),
          analyzers: z.record(z.string(), z.string()),
          functions: z.record(z.string(), z.string()),
          params: z.record(z.string(), z.string()),
          tables: z.record(
            z.string(),
            z.object({
              create: z.string(),
              fields: z.record(z.string(), z.string()),
              indexes: z.record(z.string(), z.string()),
              events: z.record(z.string(), z.string()),
            })
          ),
        })
      ),
    })
  ),
});

type SnapshotType = z.infer<typeof snapshotSchema>;

export default class Snapshot implements SnapshotType {
  private constructor(public readonly namespaces: SnapshotType["namespaces"]) {}

  diff(otherSnapshot: Snapshot) {
    const queries: Array<string> = [];

    const compare = (
      a: Record<string, string>,
      b: Record<string, string>,
      removeQuery: (name: string) => string
    ) => {
      for (const [name, definition] of Object.entries(a)) {
        if (b[name] !== definition) {
          queries.push(overwrite(definition));
        }
      }

      for (const name of Object.keys(b)) {
        if (!Object.hasOwn(a, name)) {
          queries.push(removeQuery(name));
        }
      }
    };

    for (const [namespaceName, namespaceData] of Object.entries(
      this.namespaces
    )) {
      if (
        otherSnapshot.namespaces[namespaceName]?.create !== namespaceData.create
      ) {
        queries.push(overwrite(namespaceData.create));
      }

      const otherNamespace = otherSnapshot.namespaces[namespaceName] ?? {
        create: namespaceData.create,
        databases: {},
      };

      const beforeQueryCount = queries.length;

      for (const [databaseName, databaseData] of Object.entries(
        namespaceData.databases
      )) {
        if (
          otherNamespace.databases[databaseName]?.create !== databaseData.create
        ) {
          queries.push(overwrite(databaseData.create));
        }

        const otherDatabase = otherNamespace.databases[databaseName] ?? {
          create: databaseData.create,
          analyzers: {},
          functions: {},
          params: {},
          tables: {},
        };

        compare(
          databaseData.analyzers,
          otherDatabase.analyzers,
          (name) => `REMOVE ANALYZER ${name}`
        );

        compare(
          databaseData.functions,
          otherDatabase.functions,
          (name) => `REMOVE FUNCTION ${name}`
        );

        compare(
          databaseData.params,
          otherDatabase.params,
          (name) => `REMOVE PARAM ${name}`
        );

        const beforeQueryCount = queries.length;

        for (const [tableName, tableData] of Object.entries(
          databaseData.tables
        )) {
          if (otherDatabase.tables[tableName]?.create !== tableData.create) {
            queries.push(overwrite(tableData.create));
          }

          const otherTable = otherDatabase.tables[tableName] ?? {
            create: tableData.create,
            events: {},
            fields: {},
            indexes: {},
          };

          compare(
            tableData.events,
            otherTable.events,
            (name) => `REMOVE EVENT ${name} ON TABLE ${tableName}`
          );

          compare(
            tableData.fields,
            otherTable.fields,
            (name) => `REMOVE FIELD ${name} ON TBALE ${tableName}`
          );

          compare(
            tableData.indexes,
            otherTable.indexes,
            (name) => `REMOVE INDEX ${name} ON TABLE ${tableName}`
          );
        }

        for (const name of Object.keys(otherDatabase.tables)) {
          if (!Object.hasOwn(databaseData.tables, name)) {
            queries.push(`REMOVE TABLE ${name}`);
          }
        }

        if (queries.length !== beforeQueryCount) {
          queries.splice(beforeQueryCount, 0, `USE DB ${databaseName}`);
        }
      }

      for (const name of Object.keys(otherNamespace.databases)) {
        if (!Object.hasOwn(namespaceData.databases, name)) {
          queries.push(`REMOVE DATABASE ${name}`);
        }
      }

      if (queries.length !== beforeQueryCount) {
        queries.splice(beforeQueryCount, 0, `USE NS ${namespaceName}`);
      }
    }

    for (const name of Object.keys(otherSnapshot.namespaces)) {
      if (!Object.hasOwn(this.namespaces, name)) {
        queries.push(`REMOVE NAMESPACE ${name}`);
      }
    }

    return queries;
  }

  static createEmpty() {
    return new this({});
  }

  static async createFromFile(path: string) {
    const content = await fs.readFile(path, "utf-8");
    const data = snapshotSchema.parse(JSON.parse(content));

    return new this(data.namespaces);
  }

  static async createFromSurql(surql: Surql) {
    const config = await loadConfig();

    if (!(config.migrationNamespace && config.migrationDatabase)) {
      throw new Error("migrations not initialized");
    }

    const [{ namespaces: surrealNamespaces }] =
      await surql`INFO FOR ROOT`.$type<
        [
          {
            namespaces: Record<string, string>;
          },
        ]
      >();

    const namespaces: SnapshotType["namespaces"] = {};

    for (const [namespaceName, namespaceCreate] of Object.entries(
      surrealNamespaces
    )) {
      const [, { databases: surrealDatabases }] = await surql`
          USE NS ${namespaceName};
          INFO FOR NS;
        `.$type<[undefined, { databases: Record<string, string> }]>();

      const databases: SnapshotType["namespaces"][string]["databases"] = {};

      for (const [databaseName, databaseCreate] of Object.entries(
        surrealDatabases
      )) {
        if (
          namespaceName === config.migrationNamespace &&
          databaseName === config.migrationDatabase
        ) {
          continue;
        }

        const [, { analyzers, params, functions, tables: surrealTables }] =
          await surql`
            USE NS ${namespaceName} DB ${databaseName};
            INFO FOR DB;
          `.$type<
            [
              undefined,
              {
                analyzers: Record<string, string>;
                params: Record<string, string>;
                functions: Record<string, string>;
                tables: Record<string, string>;
              },
            ]
          >();

        const tables: SnapshotType["namespaces"][string]["databases"][string]["tables"] =
          {};

        for (const [tableName, tableCreate] of Object.entries(surrealTables)) {
          // skip migration table
          if (
            tableName === "migrations" &&
            databaseName === config.migrationDatabase &&
            namespaceName === config.migrationNamespace
          ) {
            continue;
          }

          const [, { fields, events, indexes }] = await surql`
              USE NS ${namespaceName} DB ${databaseName};
              INFO FOR TABLE ${tableName};
            `.$type<
            [
              undefined,
              {
                fields: Record<string, string>;
                events: Record<string, string>;
                indexes: Record<string, string>;
              },
            ]
          >();

          tables[tableName] = {
            create: tableCreate,
            fields,
            indexes,
            events,
          };
        }

        // skip migration database when no other changes where made
        if (
          namespaceName === config.migrationNamespace &&
          databaseName === config.migrationDatabase &&
          Object.keys(analyzers).length + Object.keys(functions).length &&
          Object.keys(params).length &&
          Object.keys(tables).length === 0
        ) {
          continue;
        }

        databases[databaseName] = {
          create: databaseCreate,
          analyzers,
          functions,
          params,
          tables,
        };
      }

      // skip migration namespace when no other changes where made
      if (
        namespaceName === config.migrationNamespace &&
        Object.keys(databases).length === 0
      ) {
        continue;
      }

      namespaces[namespaceName] = {
        create: namespaceCreate,
        databases,
      };
    }

    return new this(namespaces);
  }
}
