import React from 'react'
import { mount } from 'enzyme'
import { act } from 'react-dom/test-utils'
import CustomColumnModal from '../CustomColumnModal'
import { CustomColumnTypes, CustomColumnValues, authenticationDefault, autoQLConfigDefault, dataFormattingDefault } from 'autoql-fe-utils'

jest.mock('../../ChataTable/ChataTable', () => ({
  __esModule: true,
  default: () => null,
}))

describe('CustomColumnModal cleanColumnFn', () => {
  it('preserves explicit zero values (0 and "0") but removes empty tokens', () => {
    const props = {
      columns: [],
      enableWindowFunctions: false,
      authentication: authenticationDefault,
      autoQLConfig: autoQLConfigDefault,
      dataFormatting: dataFormattingDefault,
      onAddColumn: () => {},
      onClose: () => {},
    }

    const instance = new CustomColumnModal(props)

    const cleaned = instance.cleanColumnFn([
      { type: 'number', value: 0 },
      { type: 'number', value: '0' },
      { type: 'number', value: '' },
      { type: 'operator', value: '+' },
    ])

    expect(cleaned).toEqual(expect.arrayContaining([{ type: 'number', value: 0 }, { type: 'number', value: '0' }]))
    expect(cleaned).not.toEqual(expect.arrayContaining([{ type: 'number', value: '' }]))
  })

  it('rejects operator-only formulas (consecutive operators)', () => {
    const columns = [{ field: '0', title: 'Value', is_visible: true }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    inst.setState({
      columnFn: [
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
      ],
    })
    inst.updateTabulatorColumnFn()

    expect(inst.state.isFnValid).toBe(false)
    expect(inst.state.fnError).toBeUndefined()
    wrapper.unmount()
  })

  it('allows leading unary minus (-A) structurally', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    inst.setState({
      columnFn: [
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.SUBTRACTION },
        { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      ],
    })
    expect(inst.isStructurallyValidColumnFn().valid).toBe(true)
    wrapper.unmount()
  })

  it('rejects consecutive operators between variables', () => {
    const columns = [
      { field: '0', title: 'A', is_visible: true, name: 'A' },
      { field: '1', title: 'B', is_visible: true, name: 'B' },
    ]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    inst.setState({
      columnFn: [
        { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.ADDITION },
        { type: CustomColumnTypes.COLUMN, value: 'B', column: columns[1] },
      ],
    })
    inst.updateTabulatorColumnFn()

    expect(inst.state.isFnValid).toBe(false)
    expect(inst.state.fnError).toBeTruthy()
    wrapper.unmount()
  })

  it('rejects mismatched parentheses', () => {
    const columns = [{ field: '0', title: 'A', is_visible: true, name: 'A' }]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    inst.setState({
      columnFn: [
        { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.LEFT_BRACKET },
        { type: CustomColumnTypes.COLUMN, value: 'A', column: columns[0] },
      ],
    })
    inst.updateTabulatorColumnFn()

    expect(inst.state.isFnValid).toBe(false)
    expect(inst.state.fnError).toBe('Mismatched parentheses')
    wrapper.unmount()
  })

  it('treats empty custom number as incomplete until value is entered', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    inst.setState({ columnFn: [{ type: CustomColumnTypes.NUMBER, value: undefined, id: 'num-1' }] })

    expect(inst.isFormulaComplete()).toBe(false)
    expect(inst.hasVariablesInColumnFn()).toBe(false)
    wrapper.unmount()
  })

  it('keeps first custom number placeholder in formula while user types', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    inst.setState({ columnFn: [{ type: CustomColumnTypes.NUMBER, value: undefined, id: 'num-1' }] })
    inst.updateTabulatorColumnFn()

    expect(inst.state.columnFn).toHaveLength(1)
    expect(inst.state.columnFn[0].type).toBe(CustomColumnTypes.NUMBER)
    expect(inst.state.columnFn[0].value).toBeUndefined()
    wrapper.unmount()
  })
})

describe('CustomColumnModal parenthesis matrix', () => {
  it('single-token wrapped operands are unwrapped and produce invalid structure', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const outerVariants = [
      { token: { type: CustomColumnTypes.NUMBER, value: 8 } },
      { token: { type: CustomColumnTypes.COLUMN, value: 'A', column: { field: '0', name: 'A' } } },
    ]
    const innerVariants = [
      { token: { type: CustomColumnTypes.NUMBER, value: 2 } },
      { token: { type: CustomColumnTypes.COLUMN, value: 'B', column: { field: '1', name: 'B' } } },
    ]

    for (const outer of outerVariants) {
      for (const inner of innerVariants) {
        const fn = [
          outer.token,
          { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.LEFT_BRACKET },
          inner.token,
          { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.RIGHT_BRACKET },
        ]
        const cleaned = inst.cleanColumnFn(fn)
        expect(cleaned.find((t) => t?.value === CustomColumnValues.LEFT_BRACKET)).toBeUndefined()
        expect(cleaned.find((t) => t?.value === CustomColumnValues.RIGHT_BRACKET)).toBeUndefined()
        inst.setState({ columnFn: cleaned })
        expect(inst.isStructurallyValidColumnFn().valid).toBe(false)
      }
    }

    wrapper.unmount()
  })

  it('standard math expressions are structurally valid', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const A = (v = 'a') => ({ type: CustomColumnTypes.COLUMN, value: v, column: { field: v, name: v } })
    const N = (n) => ({ type: CustomColumnTypes.NUMBER, value: n })
    const op = (v) => ({ type: CustomColumnTypes.OPERATOR, value: v })
    const ops = CustomColumnValues

    const examples = [
      [A('a'), op(ops.ADDITION), A('b'), op(ops.MULTIPLICATION), A('c'), op(ops.SUBTRACTION), A('d')],
      [op(ops.LEFT_BRACKET), A('a'), op(ops.ADDITION), A('b'), op(ops.RIGHT_BRACKET), op(ops.MULTIPLICATION), op(ops.LEFT_BRACKET), A('c'), op(ops.SUBTRACTION), A('d'), op(ops.RIGHT_BRACKET)],
      [A('a'), op(ops.DIVISION), op(ops.LEFT_BRACKET), A('b'), op(ops.MULTIPLICATION), op(ops.LEFT_BRACKET), A('c'), op(ops.ADDITION), A('d'), op(ops.RIGHT_BRACKET), op(ops.RIGHT_BRACKET)],
      [op(ops.LEFT_BRACKET), A('a'), op(ops.SUBTRACTION), A('b'), op(ops.ADDITION), A('c'), op(ops.RIGHT_BRACKET), op(ops.DIVISION), A('d')],
      [A('a'), op(ops.SUBTRACTION), A('b'), op(ops.MULTIPLICATION), op(ops.LEFT_BRACKET), A('c'), op(ops.DIVISION), N(0.1), op(ops.RIGHT_BRACKET)],
      [A('a'), op(ops.MULTIPLICATION), op(ops.LEFT_BRACKET), A('b'), op(ops.ADDITION), A('c'), op(ops.RIGHT_BRACKET)],
      [op(ops.LEFT_BRACKET), A('a'), op(ops.SUBTRACTION), A('b'), op(ops.RIGHT_BRACKET), op(ops.MULTIPLICATION), A('c')],
    ]

    for (const fn of examples) {
      const cleaned = inst.cleanColumnFn(fn)
      inst.setState({ columnFn: cleaned })
      expect(inst.isStructurallyValidColumnFn().valid).toBe(true)
    }

    wrapper.unmount()
  })

  it('adjacent operands remain invalid', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const A = (v = 'a') => ({ type: CustomColumnTypes.COLUMN, value: v, column: { field: v, name: v } })

    for (const fn of [
      [A('a'), A('b')],
      [A('a'), { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.LEFT_BRACKET }, { type: CustomColumnTypes.NUMBER, value: 1000 }, { type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.RIGHT_BRACKET }],
    ]) {
      const cleaned = inst.cleanColumnFn(fn)
      inst.setState({ columnFn: cleaned })
      expect(inst.isStructurallyValidColumnFn().valid).toBe(false)
    }

    wrapper.unmount()
  })
})

describe('CustomColumnModal function parameter normalization', () => {
  it('onAddFunction stores numeric params as strings and populates params mirror', async () => {
    const columns = [
      { field: '0', name: 'Sales', title: 'Sales', is_visible: true },
      { field: '1', name: 'Date', title: 'Date', is_visible: true },
    ]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    await act(async () => {
      inst.setState({
        selectedFnColumn: '0',
        selectedFnNTileNumber: 5,
        selectedFnOperatorValue: 10,
        selectedFnRowsOrRangeOptionPreNValue: 3,
        selectedFnRowsOrRangeOptionPostNValue: 2,
        selectedFnMovingAverageTimeInterval: 7,
      })
    })
    await act(async () => { inst.onAddFunction() })
    wrapper.update()

    const inserted = wrapper.state('columnFn').at(-1)
    expect(inserted).toBeTruthy()
    expect(inserted.type).toBe(CustomColumnTypes.FUNCTION)
    expect(typeof inserted.nTileNumber).toBe('string')
    expect(typeof inserted.operatorValue).toBe('string')
    expect(typeof inserted.rowsOrRangeOptionPreNValue).toBe('string')
    expect(typeof inserted.rowsOrRangeOptionPostNValue).toBe('string')
    expect(typeof inserted.movingAvgTimeInterval).toBe('string')
    expect(inserted.params).toBeTruthy()
    expect(inserted.params.nTileNumber).toBe(inserted.nTileNumber)
    expect(inserted.params.operatorValue).toBe(inserted.operatorValue)
    expect(inserted.params.rowsOrRangeOptionPreNValue).toBe(inserted.rowsOrRangeOptionPreNValue)
    expect(inserted.params.rowsOrRangeOptionPostNValue).toBe(inserted.rowsOrRangeOptionPostNValue)
    expect(inserted.params.movingAvgTimeInterval).toBe(inserted.movingAvgTimeInterval)

    wrapper.unmount()
  })
})
