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

const clickCustomOption = (toolbar, name) => {
  const menu = mount(<div>{toolbar.instance().renderMoreOptionsMenu({}, {})}</div>)
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
})
