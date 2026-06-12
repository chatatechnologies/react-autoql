import { transformDivisionExpression, normalizeCoalesceParentheses } from 'autoql-fe-utils'

describe('customColumn SQL helpers', () => {
  test('transformDivisionExpression wraps simple division', () => {
    expect(transformDivisionExpression('A / B')).toBe('COALESCE(A / NULLIF(B, 0), 0)')
  })

  test('transformDivisionExpression wraps parenthesized division', () => {
    expect(transformDivisionExpression('(A + B) / (C - D)')).toBe('COALESCE((A + B) / NULLIF((C - D), 0), 0)')
  })

  test('transformDivisionExpression does not double-wrap existing NULLIF/COALESCE', () => {
    const s = 'COALESCE(A / NULLIF(B, 0), 0)'
    expect(transformDivisionExpression(s)).toBe(s)
  })

  test('transformDivisionExpression normalizes double-parenthesized COALESCE', () => {
    const s = 'COALESCE((pgs.completions / NULLIF(pgs.passing_attempts, 0), 0))'
    expect(normalizeCoalesceParentheses(transformDivisionExpression(s))).toBe(
      'COALESCE(pgs.completions / NULLIF(pgs.passing_attempts, 0), 0)',
    )
  })

  test('transformDivisionExpression handles negative numeric denominators', () => {
    expect(transformDivisionExpression('A / (-1)')).toBe('COALESCE(A / NULLIF((-1), 0), 0)')
  })

  test('transformDivisionExpression handles decimal denominators', () => {
    expect(transformDivisionExpression('A / 1.5')).toBe('COALESCE(A / NULLIF(1.5, 0), 0)')
  })

  test('transformDivisionExpression skips wrapping when division is inside function args', () => {
    const input = 'foo(A / B, C)'
    expect(transformDivisionExpression(input)).toBe(input)
  })

  test('normalizeCoalesceParentheses collapses double parentheses', () => {
    expect(normalizeCoalesceParentheses('COALESCE((x / NULLIF(y, 0), 0))')).toBe('COALESCE(x / NULLIF(y, 0), 0)')
  })
})
