import type { Surreal } from 'surrealdb'

interface Options {
  transaction?: boolean
}

type Api<T> = Promise<T> & {
  vars(vars: Record<string, any>): Api<T>
  options(options: Options): Api<T>
  $type<U>(): Api<U>
}

export function createSurql(surreal: Surreal) {
  const internalSurql = (
    strings: TemplateStringsArray,
    ...values: any[]
  ): Api<unknown> => {
    let queryVars: Record<string, any> = {}
    let options: Options = {}
    const query = strings.reduce(
      (acc, str, i) => acc + str + (values[i] ?? ''),
      '',
    )

    let executed = false

    const { promise, reject, resolve } = Promise.withResolvers<unknown>()

    const wrappedPromise = new Proxy(promise, {
      get(target, property: keyof PromiseLike<unknown[]>) {
        if (
          property === 'then' ||
          property === 'catch' ||
          property === 'finally'
        ) {
          if (!executed) {
            executed = true

            const queries = query
              .split(';')
              .map((q) => q.trim())
              .filter(Boolean)

            if (queries.length === 0) {
              resolve(undefined)
            } else if (queries.length === 1) {
              surreal
                .query(query, queryVars)
                .then((result) => {
                  resolve(result[0])
                })
                .catch(reject)
            } else if (options.transaction !== false) {
              const wrappedQuery = [
                'BEGIN TRANSACTION',
                ...queries,
                'COMMIT TRANSACTION;',
              ].join(';\n')

              surreal
                .query(wrappedQuery, queryVars)
                .then((result) => result.slice(1, -1))
                .then(resolve)
                .catch(reject)
            } else {
              surreal.query(query, queryVars).then(resolve).catch(reject)
            }
          }

          return target[property].bind(target)
        }

        return target[property]
      },
    })

    const api: Api<unknown> = Object.assign(wrappedPromise, {
      vars(vars: Record<string, any>) {
        queryVars = Object.assign(queryVars, vars)
        return api
      },
      options(opts: Options) {
        options = opts
        return api
      },
      $type<T>() {
        return api as Api<T>
      },
    })

    return api
  }

  return Object.assign(internalSurql, {
    surreal,
    close() {
      return surreal.close()
    },
  })
}

export type Surql = ReturnType<typeof createSurql>
