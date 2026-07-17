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
