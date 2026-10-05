import React from 'react'
import { shallow } from 'enzyme'
import { exportCSV } from 'autoql-fe-utils'
import { OptionsToolbar } from './OptionsToolbar'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  exportCSV: jest.fn(() => Promise.resolve({ data: '', headers: {} })),
}))

// drilldownQueryID is gone - the export now reads the pinned queryId prop, falling back to the
// response's own query id.
const makeResponseRef = (overrides = {}) => ({
  props: {},
  queryID: 'response-query-id',
  queryResponse: { data: { data: { text: 'SELECT 1' } } },
  getCombinedFilters: () => [],
  isFilteringTable: () => false,
  getColumns: () => [],
  ...overrides,
})

// jsdom has no object URL support - the download step is not what these tests exercise
beforeAll(() => {
  window.URL.createObjectURL = jest.fn(() => 'blob:mock')
})

const setup = (responseRefOverrides = {}, props = {}) =>
  shallow(
    <OptionsToolbar
      {...OptionsToolbar.defaultProps}
      responseRef={makeResponseRef(responseRefOverrides)}
      onCSVDownloadStart={jest.fn()}
      onCSVDownloadProgress={jest.fn()}
      onCSVDownloadFinish={jest.fn()}
      {...props}
    />,
  )

describe('OptionsToolbar fetchCSVAndExport query id', () => {
  beforeEach(() => {
    exportCSV.mockClear()
  })

  it('prefers the pinned queryId prop on the response ref', () => {
    const wrapper = setup({ props: { queryId: 'pinned-query-id' } })

    wrapper.instance().fetchCSVAndExport()

    expect(exportCSV).toHaveBeenCalledTimes(1)
    expect(exportCSV.mock.calls[0][0].queryId).toBe('pinned-query-id')

    wrapper.unmount()
  })

  it("falls back to the response's own query id when nothing is pinned", () => {
    const wrapper = setup()

    wrapper.instance().fetchCSVAndExport()

    expect(exportCSV.mock.calls[0][0].queryId).toBe('response-query-id')

    wrapper.unmount()
  })

  it('reports the same query id to onCSVDownloadStart that it exports with', () => {
    const onCSVDownloadStart = jest.fn()
    const wrapper = setup({ props: { queryId: 'pinned-query-id' } }, { onCSVDownloadStart })

    wrapper.instance().fetchCSVAndExport()

    expect(onCSVDownloadStart).toHaveBeenCalledWith(expect.objectContaining({ queryId: 'pinned-query-id' }))

    wrapper.unmount()
  })
})

describe('OptionsToolbar fetchCSVAndExport failures', () => {
  let consoleError

  beforeEach(() => {
    exportCSV.mockClear()
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('reports an error when the export rejects with a response', async () => {
    exportCSV.mockImplementationOnce(() => Promise.reject({ status: 502, data: {} }))
    const onCSVDownloadFinish = jest.fn()
    const wrapper = setup({}, { onCSVDownloadFinish })

    await wrapper.instance().fetchCSVAndExport()

    expect(onCSVDownloadFinish).toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }))

    wrapper.unmount()
  })

  // exportCSV rejects with error.response, which is undefined when the browser
  // never hands back a usable response - a 502 from a gateway, for one. That
  // used to reach onCSVDownloadFinish with no error and show "successfully
  // downloaded".
  it('reports an error when the export rejects with nothing', async () => {
    exportCSV.mockImplementationOnce(() => Promise.reject(undefined))
    const onCSVDownloadFinish = jest.fn()
    const wrapper = setup({}, { onCSVDownloadFinish })

    await wrapper.instance().fetchCSVAndExport()

    expect(onCSVDownloadFinish).toHaveBeenCalledTimes(1)
    expect(onCSVDownloadFinish.mock.calls[0][0].error).toBeTruthy()

    wrapper.unmount()
  })
})
