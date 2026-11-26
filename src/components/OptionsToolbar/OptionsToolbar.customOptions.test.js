import React from 'react'
import { mount } from 'enzyme'
import { OptionsToolbar } from './OptionsToolbar'
import responseTestCases from '../../../test/responseTestCases'

// A custom option's callback gets the answer's payload, and — as a second argument that callbacks written
// before it ignore — a way to capture the answer as it's shown (QueryOutput.captureForReport).

const responseRef = (overrides = {}) => ({
  state: { displayType: 'table', customColumnSelects: [] },
  queryResponse: responseTestCases[8],
  getColumns: () => [],
  isFilteringTable: () => false,
  getTabulatorHeaderFilters: () => [],
  getCombinedFilters: () => [],
  ...overrides,
})

// The menu is handed the toolbar's own visibility flags, as it is in render: custom
// options only show when those say so.
const clickCustomOption = (toolbar, name) => {
  const instance = toolbar.instance()
  const menu = mount(<div>{instance.renderMoreOptionsMenu({}, instance.getShouldShowButtonObj(toolbar.props()))}</div>)
  menu
    .find('li')
    .filterWhere((li) => li.text().includes(name))
    .first()
    .simulate('click')
  menu.unmount()
}

describe('OptionsToolbar custom options', () => {
  it('pass the payload first, and a capture function second', () => {
    const callback = jest.fn()
    const capture = { ok: true, capture: { version: 1 } }
    const ref = responseRef({ captureForReport: jest.fn(() => capture) })
    const toolbar = mount(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        responseRef={ref}
        customOptions={[{ name: 'Add to Report...', icon: 'description', callback }]}
      />,
    )

    clickCustomOption(toolbar, 'Add to Report...')
    expect(callback).toHaveBeenCalledTimes(1)
    const [payload, extra] = callback.mock.calls[0]
    expect(payload).toHaveProperty('queryResponse')
    expect(payload).not.toHaveProperty('captureForReport')
    expect(extra.captureForReport({ maxTableRows: 50 })).toBe(capture)
    expect(ref.captureForReport).toHaveBeenCalledWith({ maxTableRows: 50 })
    toolbar.unmount()
  })

  it('say there is nothing to capture when the answer cannot', () => {
    const callback = jest.fn()
    const toolbar = mount(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        responseRef={responseRef()}
        customOptions={[{ name: 'Add to Report...', callback }]}
      />,
    )
    clickCustomOption(toolbar, 'Add to Report...')
    expect(callback.mock.calls[0][1].captureForReport()).toStrictEqual({ ok: false, reason: 'unsupported' })
    toolbar.unmount()
  })

  it("give the tile's saved query id, not a cached run's", () => {
    const callback = jest.fn()
    const { data } = responseTestCases[8]
    const queryResponse = {
      ...responseTestCases[8],
      data: { ...data, data: { ...data.data, query_id: 'q_cached_run', drilldown_query_id: 'q_saved' } },
    }
    const ref = responseRef({ queryResponse, props: { queryId: 'q_cached_run' }, queryID: 'q_cached_run' })
    const toolbar = mount(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        responseRef={ref}
        customOptions={[{ name: 'Add to Report...', callback }]}
      />,
    )
    clickCustomOption(toolbar, 'Add to Report...')
    expect(callback.mock.calls[0][0].queryId).toBe('q_saved')
    toolbar.unmount()
  })
})

// With `placement: 'toolbar'` an option is a button of its own rather than a menu item: named for screen readers,
// and handing its callback what a menu item hands its own.
describe('OptionsToolbar custom options on the toolbar', () => {
  const FOLLOW = 'Follow markets from this answer…'
  const follow = (overrides = {}) => ({
    name: FOLLOW,
    icon: 'star',
    placement: 'toolbar',
    callback: jest.fn(),
    ...overrides,
  })
  const dashboard = (overrides = {}) => ({
    name: 'Add to Dashboard…',
    icon: 'dashboard',
    callback: jest.fn(),
    ...overrides,
  })

  const mountToolbar = (props) =>
    mount(<OptionsToolbar {...OptionsToolbar.defaultProps} responseRef={responseRef()} {...props} />)
  const toolbarButton = (toolbar, name) =>
    toolbar.find('button').filterWhere((button) => button.prop('aria-label') === name)

  it('render as a button named for the option, with its tooltip', () => {
    const toolbar = mountToolbar({ customOptions: [follow({ tooltip: 'Follow markets' })] })
    const button = toolbarButton(toolbar, FOLLOW)
    expect(button).toHaveLength(1)
    expect(button.prop('data-tooltip-html')).toBe('Follow markets')
    toolbar.unmount()
  })

  it('take their tooltip from the name when they give none', () => {
    const toolbar = mountToolbar({ customOptions: [follow()] })
    expect(toolbarButton(toolbar, FOLLOW).prop('data-tooltip-html')).toBe(FOLLOW)
    toolbar.unmount()
  })

  it('hand the callback what a menu item hands it', () => {
    const onToolbar = follow()
    const inMenu = dashboard()
    const capture = { ok: true, capture: { version: 1 } }
    const toolbar = mountToolbar({
      responseRef: responseRef({ captureForReport: jest.fn(() => capture) }),
      customOptions: [onToolbar, inMenu],
    })

    toolbarButton(toolbar, FOLLOW).simulate('click')
    clickCustomOption(toolbar, 'Add to Dashboard…')

    expect(onToolbar.callback).toHaveBeenCalledTimes(1)
    const [payload, extra] = onToolbar.callback.mock.calls[0]
    expect(payload).toHaveProperty('queryResponse')
    expect(payload).toStrictEqual(inMenu.callback.mock.calls[0][0])
    expect(extra.captureForReport()).toBe(capture)
    toolbar.unmount()
  })

  it('stay out of the menu', () => {
    const toolbar = mountToolbar({ customOptions: [follow(), dashboard()] })
    const instance = toolbar.instance()
    const menu = mount(
      <div>{instance.renderMoreOptionsMenu({}, instance.getShouldShowButtonObj(toolbar.props()))}</div>,
    )
    expect(menu.text()).toContain('Add to Dashboard…')
    expect(menu.text()).not.toContain(FOLLOW)
    menu.unmount()
    toolbar.unmount()
  })

  // With copy, CSV, SQL and data alerts off, custom options are all the menu could hold.
  it('leave no More options button when the menu would have held only them', () => {
    const shouldShow = (customOptions) => {
      const toolbar = mountToolbar({
        enableCopyBtn: false,
        autoQLConfig: { ...OptionsToolbar.defaultProps.autoQLConfig, enableCSVDownload: false },
        customOptions,
      })
      const shown = toolbar.instance().getShouldShowButtonObj(toolbar.props())
      toolbar.unmount()
      return shown
    }

    expect(shouldShow([follow()])).toMatchObject({ showCustomToolbarOptions: true, showMoreOptionsButton: false })
    expect(shouldShow([follow(), dashboard()])).toMatchObject({ showCustomOptions: true, showMoreOptionsButton: true })
  })

  // The same reason as the menu's: the callback would be handed a preview's rows as the answer.
  it('are withdrawn with the menu items on a truncated answer', () => {
    const toolbar = mountToolbar({ isDataTruncated: true, customOptions: [follow()] })
    expect(toolbarButton(toolbar, FOLLOW)).toHaveLength(0)
    toolbar.unmount()
  })
})
