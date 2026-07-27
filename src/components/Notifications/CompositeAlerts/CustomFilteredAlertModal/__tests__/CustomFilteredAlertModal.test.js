import React from 'react'
import { mount } from 'enzyme'
import CustomFilteredAlertModal from '../CustomFilteredAlertModal'
import { getAllDataAlertsLabels, getAllDataAlertsLabelsByProject } from 'autoql-fe-utils'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  getAllDataAlertsLabels: jest.fn(),
  getAllDataAlertsLabelsByProject: jest.fn(),
}))

describe('CustomFilteredAlertModal label fetching', () => {
  const authentication = { token: 't', domain: 'd', apiKey: 'k' }

  beforeEach(() => {
    jest.clearAllMocks()
    const resolved = Promise.resolve({ data: { data: { items: [] } } })
    getAllDataAlertsLabels.mockReturnValue(resolved)
    getAllDataAlertsLabelsByProject.mockReturnValue(resolved)
  })

  it('calls getAllDataAlertsLabelsByProject (not getAllDataAlertsLabels) when isManagementPortal is unset', () => {
    const wrapper = mount(<CustomFilteredAlertModal authentication={authentication} autoQLConfig={{}} />)
    wrapper.setProps({ autoQLConfig: { projectId: 'p1' } })

    expect(getAllDataAlertsLabelsByProject).toHaveBeenCalledTimes(1)
    expect(getAllDataAlertsLabels).not.toHaveBeenCalled()
  })

  it('calls getAllDataAlertsLabels (not getAllDataAlertsLabelsByProject) when isManagementPortal is true', () => {
    const wrapper = mount(
      <CustomFilteredAlertModal authentication={authentication} autoQLConfig={{}} isManagementPortal />,
    )
    wrapper.setProps({ autoQLConfig: { projectId: 'p1' } })

    expect(getAllDataAlertsLabels).toHaveBeenCalledTimes(1)
    expect(getAllDataAlertsLabelsByProject).not.toHaveBeenCalled()
  })

  it('does not fetch labels when authentication is incomplete', () => {
    const wrapper = mount(<CustomFilteredAlertModal autoQLConfig={{}} />)
    wrapper.setProps({ autoQLConfig: { projectId: 'p1' } })

    expect(getAllDataAlertsLabels).not.toHaveBeenCalled()
    expect(getAllDataAlertsLabelsByProject).not.toHaveBeenCalled()
  })
})
