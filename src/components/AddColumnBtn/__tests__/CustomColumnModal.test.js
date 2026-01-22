import React from 'react'
import { mount } from 'enzyme'
import CustomColumnModal from '../CustomColumnModal'
import { transformDivisionExpression, normalizeCoalesceParentheses } from 'autoql-fe-utils'

jest.mock('../../ChataTable/ChataTable', () => {
  return {
    __esModule: true,
    default: function Mock(props) {
      global.__lastChataTableProps = props
      return null
    },
  }
})

describe('CustomColumnModal preview normalization', () => {
  it('wraps scalar rows into a 2D array and provides columns/query_id', (done) => {
    const columns = [{ field: '0', title: 'Value', is_visible: true }]
    const queryResponse = { data: { data: { rows: 1480824, columns: [{ name: 'Value' }], query_id: 'q1' } } }

    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={queryResponse} />)

    // Wait for lazy-loaded component resolution
    setTimeout(() => {
      wrapper.update()

      try {
        const props = global.__lastChataTableProps
        expect(props).toBeTruthy()
        expect(Array.isArray(props.response.data.data.rows)).toBe(true)
        expect(Array.isArray(props.response.data.data.rows[0])).toBe(true)
        expect(props.response.data.data.rows[0][0]).toBe(1480824)
        expect(props.response.data.data.columns).toBeDefined()
        expect(props.response.data.data.query_id).toBeDefined()
        done()
      } catch (err) {
        done(err)
      }
    }, 0)
  })
})

describe('customColumnHelpers', () => {
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
    expect(transformDivisionExpression(s)).toBe('COALESCE(pgs.completions / NULLIF(pgs.passing_attempts, 0), 0)')
  })

  test('normalizeCoalesceParentheses collapses double parentheses', () => {
    const s = 'COALESCE((x / NULLIF(y, 0), 0))'
    expect(normalizeCoalesceParentheses(s)).toBe('COALESCE(x / NULLIF(y, 0), 0)')
  })
})
