import type { RecordId } from "surrealdb";
import { loadConfig, type Config } from "./config";
import createSurql from "./createSurql";
import createSurreal from "./createSurreal";
import { loadJournal } from "./utils/journal";
import loadTsFile from "./utils/loadTsFile";
import setupMigrations from "./utils/setupMigrations";

export default async function applyMigrations(config?: Config) {
  const usedConfig = config || (await loadConfig());

  const { migrationNamespace, migrationDatabase, baseDir } = usedConfig;

  const surreal = await createSurreal();
  const surql = createSurql(surreal);
  await setupMigrations(surql);
  try {
    const [, appliedMigrations] = await surql`
          USE NS ${migrationNamespace} DB ${migrationDatabase};
          SELECT * FROM migrations ORDER BY id;
        `.$type<[undefined, Array<{ id: RecordId; name: string }>]>();

    const journal = await loadJournal();
    let applied = 0;
    for (const migration of journal.migrations) {
      if (appliedMigrations.some((m) => m.name === migration)) {
        continue;
      }

      const migrationModule = await loadTsFile(baseDir, `${migration}.ts`);

      if (typeof migrationModule.up !== "function") {
        throw new Error(`Invalid migration ${migration}`);
      }

      await migrationModule.up({ surql });
      await surql`
        USE NS ${migrationNamespace} DB ${migrationDatabase};
        CREATE migrations:ulid() SET name = $name;
      `.vars({ name: migration });

      applied += 1;
    }
    return applied;
  } finally {
    await surreal.close();
  }
}
