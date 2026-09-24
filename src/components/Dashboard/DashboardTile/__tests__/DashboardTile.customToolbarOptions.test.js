import React from 'react'
import { mount } from 'enzyme'
import { DashboardTile } from '../DashboardTile'

const makeTile = (overrides = {}) => ({
  i: 'tile-1',
  key: 'tile-1',
  query: 'total aum by advisor',
  title: 'AUM by advisor',
  columns: [],
  tableFilters: [],
  orders: [],
  filters: [],
  ...overrides,
})

const mountTile = (props = {}) =>
  mount(
    <DashboardTile tile={makeTile()} setParamsForTile={() => {}} dashboardId='dash-9' tileKey='tile-1' {...props} />,
  )

describe('DashboardTile custom toolbar options', () => {
  it('tells an option’s callback which dashboard and tile it was chosen on', () => {
    const callback = jest.fn()
    const wrapper = mountTile({ customToolbarOptions: [{ name: 'Add to Report...', icon: 'description', callback }] })

    const [option] = wrapper.instance().getCustomToolbarOptions()
    expect(option).toMatchObject({ name: 'Add to Report...', icon: 'description' })
    option.callback({ query: 'total aum by advisor', queryId: 'q1' })

    expect(callback).toHaveBeenCalledWith(
      {
        query: 'total aum by advisor',
        queryId: 'q1',
        tileKey: 'tile-1',
        dashboardId: 'dash-9',
      },
      undefined,
    )
    wrapper.unmount()
  })

  it('passes on the toolbar’s second argument (the capture function)', () => {
    const callback = jest.fn()
    const wrapper = mountTile({ customToolbarOptions: [{ name: 'Add to Report...', callback }] })
    const extra = { captureForReport: () => ({ ok: true }) }
    wrapper.instance().getCustomToolbarOptions()[0].callback({ query: 'q' }, extra)
    expect(callback).toHaveBeenCalledWith({ query: 'q', tileKey: 'tile-1', dashboardId: 'dash-9' }, extra)
    wrapper.unmount()
  })

  it('falls back to the tile’s own key, then its id', () => {
    const callback = jest.fn()
    const wrapper = mountTile({
      tileKey: undefined,
      tile: makeTile({ key: undefined, i: 'from-i' }),
      customToolbarOptions: [{ name: 'x', callback }],
    })
    wrapper.instance().getCustomToolbarOptions()[0].callback({})
    expect(callback).toHaveBeenCalledWith({ tileKey: 'from-i', dashboardId: 'dash-9' }, undefined)
    wrapper.unmount()
  })

  it('hands the toolbar the same array until the options or the tile change', () => {
    const options = [{ name: 'x', callback: () => {} }]
    const wrapper = mountTile({ customToolbarOptions: options })
    const instance = wrapper.instance()
    const first = instance.getCustomToolbarOptions()

    expect(instance.getCustomToolbarOptions()).toBe(first)
    wrapper.setProps({ dashboardId: 'dash-10' })
    expect(instance.getCustomToolbarOptions()).not.toBe(first)
    wrapper.unmount()
  })

  it('leaves no options, and options without a callback, as they are', () => {
    const wrapper = mountTile({ customToolbarOptions: undefined })
    expect(wrapper.instance().getCustomToolbarOptions()).toBeUndefined()

    const plain = { name: 'label only' }
    wrapper.setProps({ customToolbarOptions: [plain] })
    expect(wrapper.instance().getCustomToolbarOptions()[0]).toBe(plain)
    wrapper.unmount()
  })
})
