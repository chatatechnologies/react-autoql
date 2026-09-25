import TableWrapper from './TableWrapper'

const createInstance = () => new TableWrapper({ options: {} })

describe('silenceProgressiveLoadNextPageRejections', () => {
  test('patched nextPage swallows rejections', async () => {
    const instance = createInstance()
    const tabulator = {
      modules: { page: { nextPage: () => Promise.reject(new Error('page changed mid-load')) } },
    }

    instance.silenceProgressiveLoadNextPageRejections(tabulator)

    await expect(tabulator.modules.page.nextPage()).resolves.toBeUndefined()
  })

  test('patched nextPage still resolves successful loads', async () => {
    const instance = createInstance()
    const tabulator = {
      modules: { page: { nextPage: () => Promise.resolve('ok') } },
    }

    instance.silenceProgressiveLoadNextPageRejections(tabulator)

    await expect(tabulator.modules.page.nextPage()).resolves.toBe('ok')
  })

  test('only patches the page module once', () => {
    const instance = createInstance()
    const pageModule = { nextPage: jest.fn(() => Promise.resolve()) }
    const tabulator = { modules: { page: pageModule } }

    instance.silenceProgressiveLoadNextPageRejections(tabulator)
    const patched = pageModule.nextPage
    instance.silenceProgressiveLoadNextPageRejections(tabulator)

    expect(pageModule.nextPage).toBe(patched)
    expect(pageModule.__nextPagePatched).toBe(true)
  })

  test('does nothing when page module is missing', () => {
    const instance = createInstance()
    expect(() => instance.silenceProgressiveLoadNextPageRejections({ modules: {} })).not.toThrow()
    expect(() => instance.silenceProgressiveLoadNextPageRejections(undefined)).not.toThrow()
  })
})


// The sizing here is circular: the container takes its height from its content, and
// Tabulator is configured `height: '100%'` so it takes its height from the container.
// Built while visible that resolves upwards. Built inside a `display: none` subtree it
// resolves downwards - Tabulator measures nothing, settles on its minHeight, and the
// container lands on its floor. Nothing can repair that afterwards, because by then the
// container really is that short. So the table waits for a box instead.
describe('deferring the build until the table has a box', () => {
  let observed

  beforeEach(() => {
    jest.useFakeTimers()
    observed = []
    global.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback
        observed.push(this)
      }
      observe() {}
      disconnect() {}
      emit(height) {
        this.callback([{ contentRect: { height } }])
      }
    }
    global.requestAnimationFrame = (cb) => setTimeout(cb, 16)
    global.cancelAnimationFrame = (id) => clearTimeout(id)
  })

  afterEach(() => {
    jest.useRealTimers()
    delete global.ResizeObserver
  })

  const flushFrame = () => jest.advanceTimersByTime(32)

  // offsetParent is null for an element inside a `display: none` subtree, which is how
  // isVisible tells the two apart.
  const setVisible = (instance, visible) => {
    Object.defineProperty(instance.tableRef, 'offsetParent', {
      configurable: true,
      get: () => (visible ? document.body : null),
    })
  }

  const mountInstance = ({ visible }) => {
    const instance = createInstance()
    instance.tableRef = document.createElement('div')
    setVisible(instance, visible)
    instance.instantiateTabulator = jest.fn(() => {
      instance.tabulator = { redraw: jest.fn() }
    })

    instance.componentDidMount()

    return instance
  }

  test('builds immediately when it already has a box', () => {
    const instance = mountInstance({ visible: true })

    expect(instance.instantiateTabulator).toHaveBeenCalledTimes(1)
    expect(instance.buildDeferred).toBe(false)
  })

  test('does not build while off screen', () => {
    const instance = mountInstance({ visible: false })

    expect(instance.instantiateTabulator).not.toHaveBeenCalled()
    expect(instance.buildDeferred).toBe(true)
  })

  test('builds on the first height the observer reports, with no preceding zero', () => {
    const instance = mountInstance({ visible: false })
    setVisible(instance, true)

    observed[0].emit(412)
    flushFrame()

    expect(instance.instantiateTabulator).toHaveBeenCalledTimes(1)
    expect(instance.buildDeferred).toBe(false)
  })

  test('builds when told directly, without waiting for the observer', () => {
    const instance = mountInstance({ visible: false })
    setVisible(instance, true)

    instance.buildWhenVisible()

    expect(instance.instantiateTabulator).toHaveBeenCalledTimes(1)
  })

  test('builds only once when both routes fire', () => {
    const instance = mountInstance({ visible: false })
    setVisible(instance, true)

    instance.buildWhenVisible()
    observed[0].emit(412)
    flushFrame()

    expect(instance.instantiateTabulator).toHaveBeenCalledTimes(1)
  })

  test('stays deferred if something fires while it is still off screen', () => {
    const instance = mountInstance({ visible: false })

    instance.buildWhenVisible()
    observed[0].emit(412)
    flushFrame()

    expect(instance.instantiateTabulator).not.toHaveBeenCalled()
    expect(instance.buildDeferred).toBe(true)
  })

  test('never builds a table that unmounted before it was revealed', () => {
    const instance = mountInstance({ visible: false })

    instance.componentWillUnmount()
    setVisible(instance, true)
    instance.buildWhenVisible()

    expect(instance.instantiateTabulator).not.toHaveBeenCalled()
  })

  test('builds immediately when ResizeObserver is unavailable and the table is visible', () => {
    delete global.ResizeObserver
    const instance = mountInstance({ visible: true })

    expect(instance.instantiateTabulator).toHaveBeenCalledTimes(1)
    expect(instance.heightObserver).toBeUndefined()
  })
})
