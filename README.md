# surreal-tools

**surreal-tools** is a utility package designed to simplify interactions with [SurrealDB](https://surrealdb.com/). It currently provides:

- A tagged template function `surql` for executing typed queries with variable interpolation.
- A comprehensive migration tool to manage and apply schema changes in a structured, automated way.

## Installation

```bash
npm install surreal-tools
```

## Usage

### `surql`: Tagged Template Function for Queries

**Basic Setup**

```typescript
import Surreal from "surrealdb";
import { createSurql } from "surreal-tools";

const surreal = new Surreal();
const surql = createSurql(surreal);
```

**Executing a Simple Query**

```typescript
const responses = await surql`INFO FOR ROOT`;
```

**Executing a Typed Query**

```typescript
const responses = await surql`INFO FOR ROOT`.$type<
  [{ namespaces: Record<string, string> }]
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

## Database Migrations

Surreal Tools includes a CLI and programmatic API to help manage schema migrations for SurrealDB.

### Initialization

Create a `surreal.config.ts` configuration file manually or initialize it using the CLI:

```bash
npx surreal-tools migration init
```

This will:

- Prepare the migration namespace and database (default: _migrations/migrations_)
- Create a migrations folder (default: _.surreal-migrations_)

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
import { applyMigrations } from "surreal-tools";

await applyMigrations();
// Optionally pass a configuration object if not using surreal.config.ts
```

## License

**MIT**
