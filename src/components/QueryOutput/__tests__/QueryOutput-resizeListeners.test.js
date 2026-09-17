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
  let winAddSpy
  let winRemoveSpy

  beforeEach(() => {
    added = []
    removed = []
    // Record which listeners are registered without suppressing them, so the assertions are about
    // real DOM registration rather than about the mock having been called.
    const realAdd = document.addEventListener.bind(document)
    const realRemove = document.removeEventListener.bind(document)
    addSpy = jest.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => {
      added.push(type)
      return realAdd(type, fn, opts)
    })
    removeSpy = jest.spyOn(document, 'removeEventListener').mockImplementation((type, fn, opts) => {
      removed.push(type)
      return realRemove(type, fn, opts)
    })

    const realWinAdd = window.addEventListener.bind(window)
    const realWinRemove = window.removeEventListener.bind(window)
    winAddSpy = jest.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
      added.push(`window:${type}`)
      return realWinAdd(type, fn, opts)
    })
    winRemoveSpy = jest.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
      removed.push(`window:${type}`)
      return realWinRemove(type, fn, opts)
    })
  })

  afterEach(() => {
    addSpy.mockRestore()
    removeSpy.mockRestore()
    winAddSpy.mockRestore()
    winRemoveSpy.mockRestore()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  test('registers the drag listeners and the offscreen-release fallback', () => {
    const wrapper = mountQueryOutput()
    wrapper.instance().handleResizeStart({ preventDefault: () => {}, clientY: 100 })

    expect(added).toContain('mousemove')
    expect(added).toContain('mouseup')
    expect(added).toContain('window:blur')

    // mouseleave would cancel the resize whenever the pointer crosses the viewport edge, which
    // happens routinely when overshooting while dragging the handle downwards.
    expect(added).not.toContain('mouseleave')

    wrapper.unmount()
  })

  test('a move with no button held ends a resize that was released offscreen', () => {
    // The browser never delivers the mouseup for a release outside the viewport, so isResizing
    // would otherwise stay stuck true and keep ChataChart's refresh loop running.
    const wrapper = mountQueryOutput()
    const inst = wrapper.instance()

    inst.handleResizeStart({ preventDefault: () => {}, clientY: 100 })
    expect(inst.state.isResizing).toBe(true)

    inst.handleMouseMove({ clientY: 400, buttons: 0 })
    expect(inst.state.isResizing).toBe(false)
    expect(document.body.style.cursor).toBe('')

    wrapper.unmount()
  })

  test('a move with the button still held keeps resizing across the viewport edge', () => {
    const wrapper = mountQueryOutput()
    const inst = wrapper.instance()

    inst.handleResizeStart({ preventDefault: () => {}, clientY: 100 })
    inst.handleMouseMove({ clientY: 400, buttons: 1 })

    expect(inst.state.isResizing).toBe(true)

    wrapper.unmount()
  })

  test('window blur ends a resize released offscreen that never comes back', () => {
    const wrapper = mountQueryOutput()
    const inst = wrapper.instance()

    inst.handleResizeStart({ preventDefault: () => {}, clientY: 100 })
    expect(inst.state.isResizing).toBe(true)

    window.dispatchEvent(new Event('blur'))
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
    expect(removed).toContain('window:blur')
    expect(document.body.style.cursor).toBe('')
  })

  test('leaves the body cursor alone on a mouseup that is not a resize', () => {
    // handleMouseUp is reachable outside a drag (window blur, and any host that calls it), and the
    // body cursor may belong to another drag library or a global busy cursor in the host app.
    const wrapper = mountQueryOutput()

    document.body.style.cursor = 'ew-resize'
    wrapper.instance().handleMouseUp()

    expect(document.body.style.cursor).toBe('ew-resize')

    document.body.style.cursor = ''
    wrapper.unmount()
  })

  describe('the rendered drag handle', () => {
    // The handle's onMouseDown used to duplicate handleResizeStart inline — with a different
    // coordinate (pageY vs clientY), no cursor, and an extra `mouseleave` listener that the paired
    // teardown never removed. These assert that the shipped path is the one under test above.
    const mountResizableChart = () => {
      const wrapper = mountQueryOutput()
      wrapper.instance().setState({ displayType: 'bar' })
      wrapper.update()
      return wrapper
    }

    test('renders a handle and starts the resize through handleResizeStart', () => {
      const wrapper = mountResizableChart()
      const inst = wrapper.instance()
      const handle = wrapper.find('.react-autoql-query-output-resize-handle')

      expect(handle.length).toBe(1)

      handle.at(0).simulate('mousedown', { clientY: 100 })

      // The cursor is handleResizeStart's tell — the old inline handler never set it. clientY (not
      // pageY) is what handleMouseMove diffs against, so the start coordinate must come from it too.
      expect(inst.state.isResizing).toBe(true)
      expect(document.body.style.cursor).toBe('ns-resize')
      expect(inst.state.resizeStartY).toBe(100)

      inst.handleMouseUp()
      wrapper.unmount()
    })

    test('registers no mouseleave listener, and removes everything it added', () => {
      const wrapper = mountResizableChart()
      const inst = wrapper.instance()

      added = []
      removed = []
      wrapper.find('.react-autoql-query-output-resize-handle').at(0).simulate('mousedown', { clientY: 100 })

      // mouseleave fires whenever the pointer crosses the viewport edge, which happens routinely
      // while dragging a handle downwards — and the teardown no longer removes it.
      expect(added).not.toContain('mouseleave')
      expect(added).toContain('mousemove')
      expect(added).toContain('mouseup')
      expect(added).toContain('window:blur')

      inst.handleMouseUp()
      added.forEach((type) => expect(removed).toContain(type))

      wrapper.unmount()
    })

    test('does not keep document drag listeners registered outside a drag', () => {
      added = []
      const wrapper = mountResizableChart()

      // Becoming resizable must not register document-level drag handlers — those belong to an
      // in-progress drag only. Only the window resize listener is always-on.
      expect(added).not.toContain('mousemove')
      expect(added).not.toContain('mouseup')
      expect(added).toContain('window:resize')

      wrapper.unmount()
    })
  })
})
