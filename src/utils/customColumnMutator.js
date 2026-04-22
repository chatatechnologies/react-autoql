import { createMutatorFn } from 'autoql-fe-utils'

// Try creating a mutator; if parsing fails, retry with numeric token values coerced to strings.
export function tryCreateMutatorWithCoercion(tokens) {
  if (!Array.isArray(tokens)) return createMutatorFn(tokens)

  try {
    return createMutatorFn(tokens)
  } catch (err) {
    const sanitized = tokens.map((tok) => {
      if (!tok) return tok
      if ((tok.type === 'number' || tok.type === 'NUMBER' || tok.type === 'Number') && typeof tok.value !== 'string') {
        return { ...tok, value: String(tok.value) }
      }
      return tok
    })

    return createMutatorFn(sanitized)
  }
}

export default tryCreateMutatorWithCoercion
