import { createMutatorFn } from 'autoql-fe-utils'

// Retry createMutatorFn once with numeric values coerced to strings.
const FUNCTION_LIKE_TYPES = new Set(['function', 'FUNCTION', 'Function', 'window_function', 'WINDOW_FUNCTION'])
const NUMERIC_FUNCTION_FIELDS = [
  'nTileNumber',
  'operatorValue',
  'rowsOrRangeOptionPreNValue',
  'rowsOrRangeOptionPostNValue',
  'movingAvgTimeInterval',
]

const coerceFunctionLikeToken = (tok) => {
  const copy = { ...tok }
  for (const field of NUMERIC_FUNCTION_FIELDS) {
    if (typeof copy[field] === 'number') copy[field] = String(copy[field])
  }

  if (copy.params && typeof copy.params === 'object') {
    copy.params = { ...copy.params }
    for (const key of Object.keys(copy.params)) {
      if (typeof copy.params[key] === 'number') {
        copy.params[key] = String(copy.params[key])
      }
    }
  }

  return copy
}

export function tryCreateMutatorWithCoercion(tokens) {
  if (!Array.isArray(tokens)) return createMutatorFn(tokens)

  try {
    return createMutatorFn(tokens)
  } catch (err) {
    const sanitized = tokens.map((tok) => {
      if (!tok) return tok

      if ((tok.type === 'number' || tok.type === 'NUMBER' || tok.type === 'Number') && typeof tok.value === 'number') {
        return { ...tok, value: String(tok.value) }
      }

      if (FUNCTION_LIKE_TYPES.has(tok.type)) {
        return coerceFunctionLikeToken(tok)
      }

      return tok
    })

    return createMutatorFn(sanitized)
  }
}

export default tryCreateMutatorWithCoercion
