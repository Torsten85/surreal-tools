import assert from 'node:assert'

import { afterAll, beforeAll, expect, it } from 'bun:test'

import { setupSurql } from './utils'
import type { Surql } from '../src/createSurql'

let surql!: Surql

beforeAll(async () => {
  surql = await setupSurql()
})

afterAll(async () => {
  await surql.close()
})

it('executes a simple query', async () => {
  const result = await surql`RETURN "test"`.$type<string>()
  expect(result).toBe('test')
})

it('executes multiple queries', async () => {
  const result = await surql`
    SELECT * FROM ONLY "test1";
    SELECT * FROM ONLY "test2";
  `.$type<string[]>()
  expect(result).toEqual(['test1', 'test2'])
})

it('executes in transaction', async () => {
  try {
    await surql`
      SELECT * FROM ONLY "test1";
      THROW "STOP";
    `
    expect.unreachable()
  } catch (error) {
    assert(error instanceof Error)
    expect(error.message).toBe(
      'The query was not executed due to a failed transaction',
    )
  }
})

it('can deactivate the transaction', async () => {
  try {
    await surql`
      SELECT * FROM ONLY "test1";
      THROW "STOP";
    `.options({ transaction: false })
    expect.unreachable()
  } catch (error) {
    assert(error instanceof Error)
    expect(error.message).toBe('An error occurred: STOP')
  }
})
