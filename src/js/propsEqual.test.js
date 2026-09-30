import { arePropsEqualByIdentity, isShallowEqual } from './propsEqual'

describe('arePropsEqualByIdentity', () => {
  const IDENTITY_KEYS = new Set(['response'])

  const makeResponse = () => ({ data: { data: { rows: [[1], [2]] } } })

  it('treats the same reference as equal', () => {
    const props = { response: makeResponse() }
    expect(arePropsEqualByIdentity(props, props, IDENTITY_KEYS)).toBe(true)
  })

  it('passes a shared response through without walking it', () => {
    const response = makeResponse()
    expect(
      arePropsEqualByIdentity({ response, id: 'a' }, { response, id: 'a' }, IDENTITY_KEYS),
    ).toBe(true)
  })

  it('reports a replaced response even when it is structurally identical', () => {
    expect(
      arePropsEqualByIdentity({ response: makeResponse() }, { response: makeResponse() }, IDENTITY_KEYS),
    ).toBe(false)
  })

  it('still deep-compares the props that are not named', () => {
    expect(arePropsEqualByIdentity({ filters: [{ a: 1 }] }, { filters: [{ a: 1 }] }, IDENTITY_KEYS)).toBe(true)
    expect(arePropsEqualByIdentity({ filters: [{ a: 1 }] }, { filters: [{ a: 2 }] }, IDENTITY_KEYS)).toBe(false)
  })

  it('does not treat a rebuilt inline arrow as a change', () => {
    const a = { onClick: () => 'hello' }
    const b = { onClick: () => 'hello' }
    expect(arePropsEqualByIdentity(a, b, IDENTITY_KEYS)).toBe(true)
  })

  it('does report a function whose body differs', () => {
    const a = { onClick: () => 'hello' }
    const b = { onClick: () => 'goodbye' }
    expect(arePropsEqualByIdentity(a, b, IDENTITY_KEYS)).toBe(false)
  })

  it('reports an added or removed prop', () => {
    expect(arePropsEqualByIdentity({ a: 1 }, { a: 1, b: 2 }, IDENTITY_KEYS)).toBe(false)
    expect(arePropsEqualByIdentity({ a: 1, b: 2 }, { a: 1 }, IDENTITY_KEYS)).toBe(false)
  })

  it('handles null and non-objects', () => {
    expect(arePropsEqualByIdentity(null, {}, IDENTITY_KEYS)).toBe(false)
    expect(arePropsEqualByIdentity(undefined, undefined, IDENTITY_KEYS)).toBe(true)
  })

  it('treats two undefined values under an identity key as equal', () => {
    expect(arePropsEqualByIdentity({ response: undefined }, { response: undefined }, IDENTITY_KEYS)).toBe(true)
  })
})

describe('isShallowEqual', () => {
  it('treats the same reference as equal', () => {
    const state = { messages: [] }
    expect(isShallowEqual(state, state)).toBe(true)
  })

  it('treats two objects with identical values as equal', () => {
    const messages = []
    expect(isShallowEqual({ messages, isQueryRunning: false }, { messages, isQueryRunning: false })).toBe(true)
  })

  it('reports a changed value', () => {
    const messages = []
    expect(isShallowEqual({ messages, isQueryRunning: false }, { messages, isQueryRunning: true })).toBe(false)
  })

  it('reports a replaced array even when its contents match - identity is the signal', () => {
    expect(isShallowEqual({ messages: [] }, { messages: [] })).toBe(false)
  })

  it('reports an added or removed key', () => {
    expect(isShallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(isShallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
  })

  it('does not treat a missing key as matching an undefined value', () => {
    expect(isShallowEqual({ a: undefined }, { b: undefined })).toBe(false)
  })

  it('handles null and non-objects', () => {
    expect(isShallowEqual(null, {})).toBe(false)
    expect(isShallowEqual(undefined, undefined)).toBe(true)
    expect(isShallowEqual(1, 1)).toBe(true)
    expect(isShallowEqual('a', 'b')).toBe(false)
  })
})
