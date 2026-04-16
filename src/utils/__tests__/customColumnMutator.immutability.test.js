jest.mock('autoql-fe-utils', () => ({
  createMutatorFn: jest.fn(),
}))

const { createMutatorFn } = require('autoql-fe-utils')
const tryCreateMutatorWithCoercion = require('../customColumnMutator').default

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
