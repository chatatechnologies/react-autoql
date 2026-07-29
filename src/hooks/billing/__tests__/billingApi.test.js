import { dedupeBillingRequest } from '../billingApi'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('dedupeBillingRequest', () => {
  it('collapses concurrent callers for the same key into a single factory invocation', async () => {
    const request = deferred()
    const factory = jest.fn(() => request.promise)

    const first = dedupeBillingRequest('key-1', factory)
    const second = dedupeBillingRequest('key-1', factory)

    expect(factory).toHaveBeenCalledTimes(1)

    request.resolve({ status: 200, ok: true, data: { billing_customer_key: 'bck_acme_ABCDEFGH' } })

    await expect(first).resolves.toEqual({ status: 200, ok: true, data: { billing_customer_key: 'bck_acme_ABCDEFGH' } })
    await expect(second).resolves.toBe(await first)
  })

  it('propagates a rejection to every caller sharing the in-flight request', async () => {
    const request = deferred()
    const factory = jest.fn(() => request.promise)
    const error = new Error('Network failure')

    const first = dedupeBillingRequest('key-2', factory)
    const second = dedupeBillingRequest('key-2', factory)

    request.reject(error)

    await expect(first).rejects.toBe(error)
    await expect(second).rejects.toBe(error)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('clears the cache once a request settles, so a later call re-invokes the factory', async () => {
    const factory = jest.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, data: 'first' })
      .mockResolvedValueOnce({ status: 200, ok: true, data: 'second' })

    await expect(dedupeBillingRequest('key-3', factory)).resolves.toEqual({ status: 200, ok: true, data: 'first' })
    await expect(dedupeBillingRequest('key-3', factory)).resolves.toEqual({ status: 200, ok: true, data: 'second' })

    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('clears the cache after a rejection too, so a retried call re-invokes the factory', async () => {
    const factory = jest.fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce({ status: 200, ok: true, data: 'recovered' })

    await expect(dedupeBillingRequest('key-4', factory)).rejects.toThrow('first failure')
    await expect(dedupeBillingRequest('key-4', factory)).resolves.toEqual({ status: 200, ok: true, data: 'recovered' })

    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('does not dedupe callers using different keys', () => {
    const factory = jest.fn(() => Promise.resolve({ status: 200, ok: true, data: null }))

    dedupeBillingRequest('key-5a', factory)
    dedupeBillingRequest('key-5b', factory)

    expect(factory).toHaveBeenCalledTimes(2)
  })
})
