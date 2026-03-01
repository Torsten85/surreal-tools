# surreal-tools

**surreal-tools** is a utility package designed to simplify interactions with [SurrealDB](https://surrealdb.com/). It currently provides:

- A tagged template function `surql` for executing typed queries with variable interpolation.
- A comprehensive migration tool to manage and apply schema changes in a structured, automated way.

## Installation

```bash
npm install surreal-tools
```

> **Note:** If you are using an embedded database protocol (`mem://`, `rocksdb://`, `surrealkv://`), you also need to install `@surrealdb/node`:
>
> ```bash
> npm install @surrealdb/node
> ```

## Usage

### `surql`: Tagged Template Function for Queries

**Basic Setup**

```typescript
import { Surreal } from "surrealdb";
import { createSurql } from "surreal-tools";

const surreal = new Surreal();
await surreal.connect("ws://localhost:8000");
const surql = createSurql(surreal);
```

**Executing a Simple Query**

```typescript
const responses = await surql`INFO FOR ROOT`;
```

**Executing a Typed Query**

```typescript
const responses = await surql`INFO FOR ROOT`.$type<
  { namespaces: Record<string, string> }
>();
```

**Using Variables in Queries**

```typescript
const namespace = "test";

// Inline template variable
const responses = await surql`USE NS ${namespace}`;

// Or using named variables
const responses = await surql`USE NS $namespace`.vars({ namespace: "test" });
```

**Transaction Behavior**

Queries containing multiple statements (separated by `;`) are automatically wrapped in a transaction:

```typescript
// This is automatically wrapped in BEGIN TRANSACTION ... COMMIT TRANSACTION
const results = await surql`
  CREATE user SET name = 'Alice';
  CREATE user SET name = 'Bob';
`;
```

To opt out of automatic transaction wrapping, use `.options({ transaction: false })`:

```typescript
const results = await surql`
  CREATE user SET name = 'Alice';
  CREATE user SET name = 'Bob';
`.options({ transaction: false });
```

## Database Migrations

Surreal Tools includes a CLI and programmatic API to help manage schema migrations for SurrealDB.

### Initialization

Create a `surreal.config.ts` configuration file manually or initialize it using the CLI:

```bash
npx surreal-tools migration init
```

This will:

- Prepare the migration namespace and database (default: `migrations`/`migrations`)
- Create a migrations folder (default: `.surreal-migrations`)

### Creating a Migration

After making schema changes (e.g., adding tables, fields, or namespaces), create a migration:

```bash
npx surreal-tools migration create
```

This generates a new migration file inside the `.surreal-migrations` directory.

Optional parameters:

- `--name <filename>`: Specify a custom filename for the migration.
- `--custom`: Create a custom migration script.

### Applying Migrations

**via CLI**

```bash
npx surreal-tools migration apply
```

(Requires a valid `surreal.config.ts` file.)

**Programmatically**

```typescript
import { Surreal } from "surrealdb";
import { applyMigrations } from "surreal-tools";

const surreal = new Surreal();
await surreal.connect("ws://localhost:8000");

// Pass a Surreal or Surql instance
const applied = await applyMigrations(surreal);

// Optionally pass migration options as second argument
// await applyMigrations(surreal, {
//   baseDir: '.surreal-migrations',
//   migrationNamespace: 'migrations',
//   migrationDatabase: 'migrations',
// });
```

## License

**MIT**
