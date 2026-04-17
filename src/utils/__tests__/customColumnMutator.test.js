jest.mock('autoql-fe-utils', () => ({
  createMutatorFn: jest.fn(),
}))

const { createMutatorFn } = require('autoql-fe-utils')
const tryCreateMutatorWithCoercion = require('../customColumnMutator').default

describe('tryCreateMutatorWithCoercion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns value when createMutatorFn succeeds on first try', () => {
    createMutatorFn.mockImplementationOnce((fn) => ({ result: 'ok-first', fn }))

    const tokens = [{ type: 'number', value: 5 }]
    const res = tryCreateMutatorWithCoercion(tokens)

    expect(res).toBeTruthy()
    expect(res.result).toBe('ok-first')
    expect(createMutatorFn).toHaveBeenCalledTimes(1)
    expect(createMutatorFn).toHaveBeenCalledWith(tokens)
  })

  test('retries with coerced numeric token values when first call throws', () => {
    // First call throws, second call returns success
    createMutatorFn
      .mockImplementationOnce(() => {
        throw new Error('parse error')
      })
      .mockImplementationOnce((fn) => ({ result: 'ok-second', fn }))

    const tokens = [
      { type: 'number', value: 3.14 },
      { type: 'column', value: 'A' },
    ]

    const res = tryCreateMutatorWithCoercion(tokens)

    expect(res).toBeTruthy()
    expect(res.result).toBe('ok-second')
    // Two attempts: original tokens, then sanitized tokens
    expect(createMutatorFn).toHaveBeenCalledTimes(2)

    const firstArg = createMutatorFn.mock.calls[0][0]
    const secondArg = createMutatorFn.mock.calls[1][0]

    // Original tokens preserved on first attempt
    expect(firstArg[0].value).toBe(3.14)
    // Second attempt should coerce numeric token to string
    expect(typeof secondArg[0].value).toBe('string')
    expect(secondArg[0].value).toBe(String(3.14))
  })

  test('propagates error if both attempts fail', () => {
    createMutatorFn.mockImplementation(() => {
      throw new Error('always fail')
    })

    const tokens = [{ type: 'number', value: 1 }]
    expect(() => tryCreateMutatorWithCoercion(tokens)).toThrow('always fail')
    // First attempt with original tokens, second attempt with coerced tokens
    expect(createMutatorFn).toHaveBeenCalledTimes(2)
  })
})

describe('tryCreateMutatorWithCoercion immutability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('does not mutate original tokens array when retrying', () => {
    // First call throws to force retry path, second call succeeds
    createMutatorFn
      .mockImplementationOnce(() => {
        throw new Error('parse error')
      })
      .mockImplementationOnce((fn) => ({ result: 'ok', fn }))

    const tokens = [
      { type: 'number', value: 42 },
      { type: 'column', value: 'A' },
    ]
    const tokensCopy = JSON.parse(JSON.stringify(tokens))

    const res = tryCreateMutatorWithCoercion(tokens)

    expect(res).toBeTruthy()
    expect(res.result).toBe('ok')
    // original array and objects remain unchanged
    expect(tokens).toEqual(tokensCopy)
  })
})
