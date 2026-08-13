import React from 'react'
import { mount, shallow } from 'enzyme'
import { MenuItem } from '../Menu'
import { DashboardToolbarWithoutRef as DashboardToolbar } from './DashboardToolbar'

const EXPORT_TITLE = 'Export Snapshot (.aqldash)'

const setup = (props = {}) =>
  mount(<DashboardToolbar tooltipID='toolbar-tooltip' onDownloadClick={() => {}} {...props} />)

const exportItem = (wrapper) => shallow(wrapper.instance().optionsMenu()).findWhere((n) => n.prop('title') === EXPORT_TITLE)

describe('DashboardToolbar export snapshot option', () => {
  it('is hidden entirely on a project-based dashboard', () => {
    const wrapper = setup({ isProjectDashboard: true, isEditable: true, isDashboardFullyExecuted: true })
    expect(exportItem(wrapper)).toHaveLength(0)
    wrapper.unmount()
  })

  it('is shown on a custom dashboard', () => {
    const wrapper = setup({ isProjectDashboard: false, isEditable: true, isDashboardFullyExecuted: true })
    const item = exportItem(wrapper)
    expect(item).toHaveLength(1)
    expect(item.prop('disabled')).toBe(false)
    expect(item.prop('tooltip')).toBeUndefined()
    wrapper.unmount()
  })

  it('is disabled with an explanatory tooltip until every tile has executed', () => {
    const wrapper = setup({ isProjectDashboard: false, isEditable: true, isDashboardFullyExecuted: false })
    const item = exportItem(wrapper)
    expect(item.prop('disabled')).toBe(true)
    expect(item.prop('tooltip')).toBe('All tiles must complete successfully with data before you can export.')
    expect(item.prop('tooltipID')).toBe('toolbar-tooltip')
    wrapper.unmount()
  })

  it('does not fire onDownloadClick while disabled', () => {
    const onDownloadClick = jest.fn()
    const wrapper = setup({ isProjectDashboard: false, isEditable: true, isDashboardFullyExecuted: false })
    const item = mount(<MenuItem {...exportItem(wrapper).props()} onClick={onDownloadClick} />)

    item.simulate('click')

    expect(onDownloadClick).not.toHaveBeenCalled()
    item.unmount()
    wrapper.unmount()
  })
})

describe('DashboardToolbar options menu visibility', () => {
  const hasOptionsButton = (wrapper) => wrapper.find('ButtonWithoutRef[icon="more-vertical"]').exists()

  it('hides the whole options menu on a non-editable project dashboard (export is its only entry)', () => {
    const wrapper = setup({ isProjectDashboard: true, isEditable: false, isDashboardFullyExecuted: true })
    expect(hasOptionsButton(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it('shows the options menu on a non-editable custom dashboard once it is fully executed', () => {
    const wrapper = setup({ isProjectDashboard: false, isEditable: false, isDashboardFullyExecuted: true })
    expect(hasOptionsButton(wrapper)).toBe(true)
    wrapper.unmount()
  })

  it('shows the options menu on an editable project dashboard (edit/delete are still available)', () => {
    const wrapper = setup({ isProjectDashboard: true, isEditable: true, isDashboardFullyExecuted: false })
    expect(hasOptionsButton(wrapper)).toBe(true)
    wrapper.unmount()
  })

  it('hides the options menu when nothing is available', () => {
    const wrapper = setup({ isProjectDashboard: false, isEditable: false, isDashboardFullyExecuted: false })
    expect(hasOptionsButton(wrapper)).toBe(false)
    wrapper.unmount()
  })
})
