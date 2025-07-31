import type Surreal from "surrealdb";

type Api<T = unknown[]> = Promise<T> & {
  vars(vars: Record<string, any>): Api<T>;
  $type<U extends unknown[]>(): Api<U>;
};

export default function createSurql(surreal: Surreal) {
  const internalSurql = (
    strings: TemplateStringsArray,
    ...values: any[]
  ): Api => {
    let queryVars: Record<string, any> = {};

    const query = strings.reduce(
      (acc, str, i) => acc + str + (values[i] ?? ""),
      ""
    );

    let executed = false;

    const { promise, reject, resolve } = Promise.withResolvers<unknown[]>();

    const wrappedPromise = new Proxy(promise, {
      get(target, property: keyof PromiseLike<unknown[]>) {
        if (
          property === "then" ||
          property === "catch" ||
          property === "finally"
        ) {
          if (!executed) {
            executed = true;

            const queries = query
              .split(";")
              .map((q) => q.trim())
              .filter(Boolean);
            let usedQuery = query;
            if (queries.length > 1) {
              usedQuery = [
                "BEGIN TRANSACTION",
                ...queries,
                "COMMIT TRANSACTION;",
              ].join(";\n");
            }
            surreal.query(usedQuery, queryVars).then(resolve).catch(reject);
          }

          return target[property].bind(target);
        }

        return target[property];
      },
    });

    const api: Api = Object.assign(wrappedPromise, {
      vars(vars: Record<string, any>) {
        queryVars = Object.assign(queryVars, vars);
        return api;
      },
      $type<T>() {
        return api as Api<T>;
      },
    });

    return api;
  };

  return Object.assign(internalSurql, {
    surreal,
  });
}

export type Surql = ReturnType<typeof createSurql>;
