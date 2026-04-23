import React from 'react'
import { mount } from 'enzyme'
import CustomColumnModal from '../CustomColumnModal'
import { CustomColumnTypes, CustomColumnValues } from 'autoql-fe-utils'

describe('CustomColumnModal validation (clean/structural checks)', () => {
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

  it('treats empty custom number as incomplete until value is entered', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    inst.setState({
      columnFn: [{ type: CustomColumnTypes.NUMBER, value: undefined, id: 'num-1' }],
    })

    expect(inst.isFormulaComplete()).toBe(false)
    expect(inst.hasVariablesInColumnFn()).toBe(false)
  })

  it('keeps first custom number placeholder in formula while user types', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()
    const placeholder = { type: CustomColumnTypes.NUMBER, value: undefined, id: 'num-1' }

    inst.setState({ columnFn: [placeholder] })
    inst.updateTabulatorColumnFn()

    expect(inst.state.columnFn).toHaveLength(1)
    expect(inst.state.columnFn[0].type).toBe(CustomColumnTypes.NUMBER)
    expect(inst.state.columnFn[0].value).toBeUndefined()
  })
})
