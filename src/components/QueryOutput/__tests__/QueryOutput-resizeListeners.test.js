import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput as QueryOutputWithoutTheme } from '../QueryOutput'

const buildResponse = () => ({
  data: {
    message: 'Success',
    reference_id: '1.1.210',
    data: {
      display_type: 'data',
      query_id: 'q_resize_test',
      text: 'total sales',
      interpretation: 'total sales',
      sql: [''],
      count_rows: 1,
      columns: [
        {
          display_name: 'Total Sales',
          name: 'sale__line_item___sum',
          type: 'DOLLAR_AMT',
          is_visible: true,
          groupable: false,
          active: false,
          multi_series: false,
        },
      ],
      rows: [[100]],
    },
  },
})

const mountQueryOutput = () =>
  mount(<QueryOutputWithoutTheme queryResponse={buildResponse()} enableResizing autoQLConfig={{}} />)

describe('resize listener lifecycle', () => {
  let added
  let removed
  let addSpy
  let removeSpy

  beforeEach(() => {
    added = []
    removed = []
    addSpy = jest.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => {
      added.push(type)
      return Document.prototype.addEventListener.wrappedMethod?.call(document, type, fn, opts)
    })
    removeSpy = jest.spyOn(document, 'removeEventListener').mockImplementation((type) => {
      removed.push(type)
    })
  })

  afterEach(() => {
    addSpy.mockRestore()
    removeSpy.mockRestore()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  test('registers a mouseleave fallback when a resize starts', () => {
    // Without this, releasing the button outside the viewport never delivers mouseup and
    // isResizing stays stuck true, which keeps ChataChart's refresh loop running.
    const wrapper = mountQueryOutput()
    wrapper.instance().handleResizeStart({ preventDefault: () => {}, clientY: 100 })

    expect(added).toContain('mousemove')
    expect(added).toContain('mouseup')
    expect(added).toContain('mouseleave')

    wrapper.unmount()
  })

  test('mouseleave clears isResizing just like mouseup', () => {
    const wrapper = mountQueryOutput()
    const inst = wrapper.instance()

    inst.handleResizeStart({ preventDefault: () => {}, clientY: 100 })
    expect(inst.state.isResizing).toBe(true)

    // handleMouseUp is the handler registered for mouseleave
    inst.handleMouseUp()
    expect(inst.state.isResizing).toBe(false)

    wrapper.unmount()
  })

  test('removes every listener it added on mouse up', () => {
    const wrapper = mountQueryOutput()
    const inst = wrapper.instance()

    inst.handleResizeStart({ preventDefault: () => {}, clientY: 100 })
    removed = []
    inst.handleMouseUp()

    added.forEach((type) => expect(removed).toContain(type))

    wrapper.unmount()
  })

  test('resets the body cursor after a resize ends', () => {
    // Previously only componentWillUnmount cleared this, so the ns-resize cursor persisted.
    const wrapper = mountQueryOutput()
    const inst = wrapper.instance()

    inst.handleResizeStart({ preventDefault: () => {}, clientY: 100 })
    expect(document.body.style.cursor).toBe('ns-resize')

    inst.handleMouseUp()
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')

    wrapper.unmount()
  })

  test('cleans up listeners and cursor if unmounted mid-resize', () => {
    const wrapper = mountQueryOutput()
    const inst = wrapper.instance()

    inst.handleResizeStart({ preventDefault: () => {}, clientY: 100 })
    removed = []
    wrapper.unmount()

    expect(removed).toContain('mousemove')
    expect(removed).toContain('mouseup')
    expect(removed).toContain('mouseleave')
    expect(document.body.style.cursor).toBe('')
  })
})
