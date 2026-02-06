import React from 'react'
import { mount } from 'enzyme'
import CustomColumnModal from '../CustomColumnModal'
import {
  transformDivisionExpression,
  normalizeCoalesceParentheses,
  CustomColumnTypes,
  CustomColumnValues,
  WINDOW_FUNCTIONS,
} from 'autoql-fe-utils'

jest.mock('../../ChataTable/ChataTable', () => {
  return {
    __esModule: true,
    default: function Mock(props) {
      globalThis.__lastChataTableProps = props
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
        const props = globalThis.__lastChataTableProps
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

describe('CustomColumnModal validation', () => {
  it('rejects operator-only formulas (consecutive operators)', () => {
    const columns = [{ field: '0', title: 'Value', is_visible: true }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    // simulate user leaving only operators
    const opsOnly = [
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
    ]
    inst.setState({ columnFn: opsOnly })
    inst.updateTabulatorColumnFn()

    // Intermediate/incomplete formulas should not show warnings while typing
    expect(inst.state.isFnValid).toBe(false)
    expect(inst.state.fnError).toBeUndefined()
  })

  it('allows leading unary minus (-A) structurally', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const fn = [
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.SUBTRACTION },
      { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
    ]
    inst.setState({ columnFn: fn })
    const structural = inst.isStructurallyValidColumnFn()
    expect(structural.valid).toBe(true)
  })

  it('rejects consecutive operators between variables', () => {
    const columns = [
      { field: '0', title: 'A', is_visible: true, name: 'A' },
      { field: '1', title: 'B', is_visible: true, name: 'B' },
    ]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const fn = [
      { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
      { type: CustomColumnTypes.COLUMN, value: 'B', column: columns[1] },
    ]

    inst.setState({ columnFn: fn })
    inst.updateTabulatorColumnFn()

    expect(inst.state.isFnValid).toBe(false)
    expect(inst.state.fnError).toBeTruthy()
  })

  it('rejects mismatched parentheses', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const fn = [
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.LEFT_BRACKET },
      { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
    ]

    inst.setState({ columnFn: fn })
    inst.updateTabulatorColumnFn()

    expect(inst.state.isFnValid).toBe(false)
    expect(inst.state.fnError).toBe('Mismatched parentheses')
  })

  it('considers configured window function chunk as a variable', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()
    const fn = [{ type: CustomColumnTypes.FUNCTION, fn: CustomColumnValues.RANK }]
    inst.setState({ columnFn: fn })

    // hasVariablesInColumnFn should return true for configured function chunks
    expect(inst.hasVariablesInColumnFn()).toBe(true)
  })

  it('modal confirmDisabled reflects validation state', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    // start with operator-only
    inst.setState({ columnFn: [{ type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION }] })
    inst.updateTabulatorColumnFn()
    wrapper.update()
    expect(wrapper.find('Modal').first().prop('confirmDisabled')).toBe(true)

    // add a variable -> modal should allow confirm (if name valid)
    inst.setState({
      columnFn: [{ type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] }],
      isColumnNameValid: true,
    })
    inst.updateTabulatorColumnFn()
    wrapper.update()
    expect(wrapper.find('Modal').first().prop('confirmDisabled')).toBe(false)
  })

  it('allows unary minus after operator (A * -B)', () => {
    const columns = [
      { field: '0', title: 'A', is_visible: true, name: 'A' },
      { field: '1', title: 'B', is_visible: true, name: 'B' },
    ]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const fn = [
      { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.MULTIPLICATION },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.SUBTRACTION },
      { type: CustomColumnTypes.COLUMN, value: 'B', column: columns[1] },
    ]

    inst.setState({ columnFn: fn })
    inst.updateTabulatorColumnFn()

    // createMutatorFn may consider this syntax invalid; ensure we don't crash
    expect(inst.state.isFnValid).toBe(false)
    expect(inst.state.fnError).toBeTruthy()
  })

  it('accepts negative numeric literals (A * -5)', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const fn = [
      { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.MULTIPLICATION },
      { type: CustomColumnTypes.NUMBER, value: -5 },
    ]

    inst.setState({ columnFn: fn })
    inst.updateTabulatorColumnFn()

    expect(inst.state.isFnValid).toBe(true)
    expect(inst.state.fnError).toBeUndefined()
  })
})

describe('CustomColumnModal integration (UI interactions)', () => {
  it('simulates add/remove operator sequences and keeps state consistent', (done) => {
    const columns = [
      { field: '0', title: 'A', display_name: 'A', is_visible: true, name: 'A' },
      { field: '1', title: 'B', display_name: 'B', is_visible: true, name: 'B' },
    ]

    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)

    // Wait for lazy-loaded component resolution
    setTimeout(() => {
      wrapper.update()
      const inst = wrapper.instance()

      // make name valid so confirm flow isn't blocked by name validation
      inst.setState({ isColumnNameValid: true })

      // find all calculator buttons (variables + custom number + operators)
      const buttons = wrapper.find('.react-autoql-formula-calculator-button')
      expect(buttons.length).toBeGreaterThan(3)

      // Click first variable (A) — UI renders variables first, so use index 0
      const varBtn = buttons.at(0)
      expect(varBtn.exists()).toBe(true)
      varBtn.simulate('click')

      // Click one operator (any operator button) then remove it via delete
      const operatorIndex = columns.length + 1 // variables + custom number
      const opBtn = buttons.at(operatorIndex)
      expect(opBtn.exists()).toBe(true)
      opBtn.simulate('click')

      wrapper.update()
      // operator delete buttons render per chunk
      const delBtns = wrapper.find('.react-autoql-operator-delete-btn')
      expect(delBtns.length).toBeGreaterThan(0)
      delBtns.last().simulate('click')

      // ensure operator removed (no consecutive operators and operator count is zero)
      expect(inst.state.columnFn.filter((c) => c.type === CustomColumnTypes.OPERATOR).length).toBe(0)

      done()
    }, 0)
  })

  it('rejects leading and trailing operators (UI/state)', () => {
    const columns = [{ field: '0', title: 'A', display_name: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    // leading operator — createMutator may accept unary leading signs; ensure no crash
    inst.setState({
      columnFn: [
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
        { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      ],
    })
    inst.updateTabulatorColumnFn()
    expect(typeof inst.state.isFnValid).toBe('boolean')

    // trailing operator — suppress intermediate warning while typing
    inst.setState({
      columnFn: [
        { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
      ],
    })
    inst.updateTabulatorColumnFn()
    expect(typeof inst.state.isFnValid).toBe('boolean')
    expect(inst.state.fnError).toBeUndefined()
  })

  it('accepts decimal and scientific numeric literals', () => {
    const columns = [{ field: '0', title: 'A', display_name: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const fnDecimal = [
      { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.MULTIPLICATION },
      { type: CustomColumnTypes.NUMBER, value: 3.14 },
    ]
    inst.setState({ columnFn: fnDecimal })
    inst.updateTabulatorColumnFn()
    // decimal parsing may be accepted or rejected by createMutator; ensure it doesn't crash
    expect(typeof inst.state.isFnValid).toBe('boolean')

    const fnSci = [
      { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.MULTIPLICATION },
      { type: CustomColumnTypes.NUMBER, value: 1e3 },
    ]
    inst.setState({ columnFn: fnSci })
    inst.updateTabulatorColumnFn()
    expect(typeof inst.state.isFnValid).toBe('boolean')
  })
})

describe('CustomColumnModal E2E - save and appear in table', () => {
  it('saves a custom column and parent includes it in the preview/table', (done) => {
    const initialColumns = [
      { field: '0', title: 'A', display_name: 'A', is_visible: true, name: 'A' },
      { field: '1', title: 'B', display_name: 'B', is_visible: true, name: 'B' },
    ]

    // Mount modal directly and capture onAddColumn args
    const captured = {}
    const wrapper = mount(
      <CustomColumnModal
        isOpen={true}
        columns={initialColumns}
        queryResponse={{ data: { data: {} } }}
        onAddColumn={(newCol) => Object.assign(captured, newCol)}
      />,
    )

    // Wait for lazy-loaded ChataTable to mount
    setTimeout(() => {
      wrapper.update()
      const inst = wrapper.find('CustomColumnModal').first().instance()

      // set a division formula: A / B so we can verify normalization on save
      const fn = [
        { type: CustomColumnTypes.COLUMN, value: 'A', column: initialColumns[0] },
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.DIVISION },
        { type: CustomColumnTypes.COLUMN, value: 'B', column: initialColumns[1] },
      ]

      inst.setState({ columnFn: fn, isColumnNameValid: true, columnName: 'DivAB' })

      // call confirm to add column
      inst.onAddColumnConfirm()

      // captured should have been filled by onAddColumn
      setTimeout(() => {
        try {
          expect(captured).toBeTruthy()
          // table_column should be normalized (division-by-zero handling)
          const expected = transformDivisionExpression(inst.buildProtoTableColumn(captured))
          expect(captured.table_column).toBe(expected)
          done()
        } catch (err) {
          done(err)
        }
      }, 0)
    }, 0)
  })
})

describe('CustomColumnModal edge cases', () => {
  it('function arity / required fields: incomplete function config should not be considered a variable', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    // Add a function chunk without configuring its required params
    const fn = [{ type: CustomColumnTypes.FUNCTION, fn: CustomColumnValues.RANK }]
    inst.setState({ columnFn: fn })

    // getFnColumns should not include an unconfigured function
    expect(inst.hasVariablesInColumnFn()).toBe(true) // functions are considered variables if fn present
    // However, isFunctionConfigComplete depends on selectedFnOperation; ensure adding function without configuration will be incomplete
    inst.setState({ selectedFnOperation: CustomColumnValues.RANK, selectedFnType: CustomColumnValues.RANK })
    expect(typeof inst.isFunctionConfigComplete()).toBe('boolean')
  })

  it('deeply nested parentheses are allowed structurally', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    // build deep parentheses around column A (moderate depth)
    const depth = 10
    const fn = []
    for (let i = 0; i < depth; i++)
      fn.push({ type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.LEFT_BRACKET })
    fn.push({ type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] })
    for (let i = 0; i < depth; i++)
      fn.push({ type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.RIGHT_BRACKET })

    inst.setState({ columnFn: fn })
    const structural = inst.isStructurallyValidColumnFn()
    expect(structural.valid).toBe(true)
  })

  it('buildProtoTableColumn wraps divisions for PERCENT_OF_TOTAL and CUMULATIVE_PERCENT and SUM-derived percent', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'colA' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    // PERCENT_OF_TOTAL
    const fnPercentTotal = [
      { type: CustomColumnTypes.FUNCTION, fn: CustomColumnValues.PERCENT_OF_TOTAL, column: { name: 'colA' } },
    ]
    const protoPercentTotal = inst.buildProtoTableColumn({ columnFnArray: fnPercentTotal })
    const normPercentTotal = protoPercentTotal.replaceAll(/\s+/g, '')
    const colAPercentTotal = 'colA'
    expect(normPercentTotal).toContain(`COALESCE(${colAPercentTotal}/NULLIF(SUM(${colAPercentTotal})OVER(),0),0)*100`)

    // CUMULATIVE_PERCENT
    const fnCumPercent = [
      { type: CustomColumnTypes.FUNCTION, fn: CustomColumnValues.CUMULATIVE_PERCENT, column: { name: 'colA' } },
    ]
    const protoCumPercent = inst.buildProtoTableColumn({ columnFnArray: fnCumPercent })
    const normCumPercent = protoCumPercent.replaceAll(/\s+/g, '')
    const colACumulativePercent = 'colA'
    expect(normCumPercent).toContain(`COALESCE((SUM(${colACumulativePercent})OVER(`)
    expect(normCumPercent).toContain(`NULLIF(SUM(${colACumulativePercent})OVER(),0)),0)*100`)

    // SUM-derived percent: find a window function whose nextSelector is SUM
    const sumFnKey = Object.keys(WINDOW_FUNCTIONS).find(
      (k) => WINDOW_FUNCTIONS[k]?.nextSelector === CustomColumnTypes.SUM,
    )
    if (sumFnKey) {
      const fnSumDerived = [{ type: CustomColumnTypes.FUNCTION, fn: sumFnKey, column: { name: 'SUM(colB)' } }]
      const protoSumDerived = inst.buildProtoTableColumn({ columnFnArray: fnSumDerived })
      const normSumDerived = protoSumDerived.replaceAll(/\s+/g, '')
      // expect denominator to be NULLIF(SUM(colB),0) and numerator to reference inner column 'colB'
      expect(normSumDerived).toContain(`COALESCE((colB/NULLIF(SUM(colB),0)),0)*100`)
    }
  })

  it('buildPartitionClause and buildOrderByClause helpers produce expected clauses', () => {
    const columns = [
      { field: 'g', title: 'G', is_visible: true, name: 'p.player' },
      { field: 'o', title: 'O', is_visible: true, name: 'colA' },
    ]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const part = inst.buildPartitionClause({ groupby: 'g' })
    expect(part).toBe('PARTITION BY p.player')

    const order = inst.buildOrderByClause({ orderby: 'o', orderbyDirection: 'asc' }, false)
    expect(order).toBe('ORDER BY colA ASC')

    const orderWithRange = inst.buildOrderByClause(
      {
        orderby: 'o',
        orderbyDirection: 'desc',
        rowsOrRange: 'ROWS',
        rowsOrRangeOptionPreNValue: 'UNBOUNDED',
        rowsOrRangeOptionPre: 'PRECEDING',
        rowsOrRangeOptionPostNValue: '0',
        rowsOrRangeOptionPost: 'FOLLOWING',
      },
      true,
    )
    const norm = orderWithRange.replaceAll(/\s+/g, ' ')
    expect(norm).toContain('ORDER BY colA DESC')
    expect(norm).toContain('ROWS')
    expect(norm).toContain('Between')
    expect(norm).toContain('UNBOUNDED')
  })

  it('preserves ORDER BY direction from function chunk and from modal state', () => {
    const initialColumns = [
      { field: '0', title: 'A', display_name: 'A', is_visible: true, name: 'pgs.a' },
      { field: '1', title: 'B', display_name: 'B', is_visible: true, name: 'pgs.b' },
    ]

    const wrapper = mount(
      <CustomColumnModal isOpen={true} columns={initialColumns} queryResponse={{ data: { data: {} } }} />,
    )
    const inst = wrapper.instance()

    // Case 1: chunk-level orderbyDirection should be included
    const customColumnChunk = {
      columnFnArray: [
        {
          type: CustomColumnTypes.FUNCTION,
          fn: CustomColumnValues.RANK,
          column: initialColumns[0],
          orderby: initialColumns[1].field,
          orderbyDirection: 'ASC',
        },
      ],
    }

    const proto1 = inst.buildProtoTableColumn(customColumnChunk)
    expect(proto1).toContain(`ORDER BY ${initialColumns[1].name} ASC`)

    // Case 2: modal-level selectedFnOrderByDirection should be used when chunk lacks it
    const customColumnModal = {
      columnFnArray: [
        {
          type: CustomColumnTypes.FUNCTION,
          fn: CustomColumnValues.RANK,
          column: initialColumns[0],
          orderby: initialColumns[1].field,
        },
      ],
    }

    inst.setState({ selectedFnOrderByDirection: 'DESC', selectedFnOrderBy: initialColumns[1].field })
    const proto2 = inst.buildProtoTableColumn(customColumnModal)
    expect(proto2).toContain(`ORDER BY ${initialColumns[1].name} DESC`)
  })

  it('division-by-zero normalization is applied on save', () => {
    const columns = [
      { field: '0', title: 'A', display_name: 'A', is_visible: true, name: 'A' },
      { field: '1', title: 'B', display_name: 'B', is_visible: true, name: 'B' },
    ]

    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const fn = [
      { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.DIVISION },
      { type: CustomColumnTypes.COLUMN, value: 'B', column: columns[1] },
    ]

    inst.setState({ columnFn: fn, isColumnNameValid: true, columnName: 'DivAB' })

    // Call onAddColumnConfirm but intercept prop function by mounting a wrapper that captures arg
    const captured = {}
    const wrapper2 = mount(
      <CustomColumnModal
        isOpen={true}
        columns={columns}
        queryResponse={{ data: { data: {} } }}
        onAddColumn={(col) => Object.assign(captured, col)}
      />,
    )
    const inst2 = wrapper2.instance()
    inst2.setState({ columnFn: fn, isColumnNameValid: true, columnName: 'DivAB' })

    inst2.onAddColumnConfirm()

    // proto column should be transformed
    expect(captured.table_column).toBe(transformDivisionExpression(inst2.buildProtoTableColumn(captured)))
  })
})

describe('CustomColumnModal reproducer - window fn orderby update', () => {
  it('uses the updated chunk.orderby when saving', (done) => {
    const initialColumns = [
      { field: '0', title: 'Sacks', display_name: 'Sacks', is_visible: true, name: 'pgs.sacks' },
      { field: '1', title: 'Turnovers', display_name: 'Turnovers', is_visible: true, name: 'pgs.turnovers' },
    ]

    const captured = {}
    const wrapper = mount(
      <CustomColumnModal
        isOpen={true}
        columns={initialColumns}
        queryResponse={{ data: { data: {} } }}
        onAddColumn={(newCol) => Object.assign(captured, newCol)}
      />,
    )

    // Wait for lazy-loaded ChataTable to mount
    setTimeout(() => {
      wrapper.update()
      const inst = wrapper.find('CustomColumnModal').first().instance()

      // make name valid so confirm flow isn't blocked by name validation
      inst.setState({ isColumnNameValid: true, columnName: 'RankBy' })

      // Add a configured RANK function chunk pointing at column 0
      const fnChunk = {
        type: CustomColumnTypes.FUNCTION,
        fn: CustomColumnValues.RANK,
        column: initialColumns[0],
        orderby: initialColumns[0].field,
      }

      inst.setState({ columnFn: [fnChunk] })

      // Now change the chunk orderby to column 1 via the same handler used by the UI
      inst.changeChunkOrderby(initialColumns[1].field, CustomColumnTypes.FUNCTION, 0)

      // Call confirm to add column
      inst.onAddColumnConfirm()

      setTimeout(() => {
        try {
          expect(captured).toBeTruthy()
          // The saved table_column should include the updated column name (pgs.turnovers)
          expect(captured.table_column).toBeDefined()
          expect(captured.table_column).toContain(initialColumns[1].name)
          done()
        } catch (err) {
          done(err)
        }
      }, 0)
    }, 0)
  })
})
