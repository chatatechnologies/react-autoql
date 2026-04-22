jest.mock('autoql-fe-utils', () => {
  const actual = jest.requireActual('autoql-fe-utils')
  return {
    ...actual,
    createMutatorFn: jest.fn(),
  }
})

const { createMutatorFn } = require('autoql-fe-utils')
const React = require('react')
const { mount } = require('enzyme')
const CustomColumnModal = require('../CustomColumnModal').default
const { CustomColumnTypes } = require('autoql-fe-utils')

describe('CustomColumnModal integration with mutator util', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('safeCreateMutatorFn retries when createMutatorFn throws then succeeds', () => {
    // First call throws, second call returns a mutator
    createMutatorFn
      .mockImplementationOnce(() => {
        throw new Error('parse error')
      })
      .mockImplementationOnce((fn) => ({ fn, fnSummary: 'ok' }))

    const fn = [
      { type: CustomColumnTypes.COLUMN, value: '0' },
      { type: CustomColumnTypes.OPERATOR, value: '+' },
      { type: CustomColumnTypes.NUMBER, value: 3.14 },
    ]

    // Call the util directly to avoid mounting side-effects in this focused test
    const tryCreateMutatorWithCoercion = require('../../../utils/customColumnMutator').default

    const res = tryCreateMutatorWithCoercion(fn)

    expect(res).toBeTruthy()
    // createMutatorFn should have been called twice (original, then coerced)
    expect(createMutatorFn).toHaveBeenCalledTimes(2)
  })
})
