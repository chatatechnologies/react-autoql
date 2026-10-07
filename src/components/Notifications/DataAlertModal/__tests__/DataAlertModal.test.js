import React from 'react'
import { mount } from 'enzyme'
import DataAlertModal from '../DataAlertModal'
import {
  getAllDataAlertsLabels,
  getAllDataAlertsLabelsByProject,
  createDataAlert,
  createManagementDataAlert,
} from 'autoql-fe-utils'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  getAllDataAlertsLabels: jest.fn(),
  getAllDataAlertsLabelsByProject: jest.fn(),
  createDataAlert: jest.fn(),
  createManagementDataAlert: jest.fn(),
}))

describe('DataAlertModal label fetching', () => {
  const authentication = { token: 't', domain: 'd', apiKey: 'k' }

  beforeEach(() => {
    jest.clearAllMocks()
    const resolved = Promise.resolve({ data: { data: { items: [] } } })
    getAllDataAlertsLabels.mockReturnValue(resolved)
    getAllDataAlertsLabelsByProject.mockReturnValue(resolved)
  })

  it('calls getAllDataAlertsLabelsByProject (not getAllDataAlertsLabels) when isManagementPortal is unset', () => {
    mount(<DataAlertModal authentication={authentication} autoQLConfig={{ projectId: 'p1' }} isVisible />)

    expect(getAllDataAlertsLabelsByProject).toHaveBeenCalledTimes(1)
    expect(getAllDataAlertsLabels).not.toHaveBeenCalled()
  })

  it('calls getAllDataAlertsLabels (not getAllDataAlertsLabelsByProject) when isManagementPortal is true', () => {
    mount(
      <DataAlertModal authentication={authentication} autoQLConfig={{ projectId: 'p1' }} isManagementPortal isVisible />,
    )

    expect(getAllDataAlertsLabels).toHaveBeenCalledTimes(1)
    expect(getAllDataAlertsLabelsByProject).not.toHaveBeenCalled()
  })

  it('does not fetch labels when authentication is incomplete', () => {
    mount(<DataAlertModal autoQLConfig={{ projectId: 'p1' }} isVisible />)

    expect(getAllDataAlertsLabels).not.toHaveBeenCalled()
    expect(getAllDataAlertsLabelsByProject).not.toHaveBeenCalled()
  })

  it('does not fetch labels while the modal is closed, and fetches once when it opens', () => {
    const wrapper = mount(<DataAlertModal authentication={authentication} autoQLConfig={{ projectId: 'p1' }} />)

    expect(getAllDataAlertsLabelsByProject).not.toHaveBeenCalled()

    wrapper.setProps({ isVisible: true })

    expect(getAllDataAlertsLabelsByProject).toHaveBeenCalledTimes(1)
  })
})

describe('DataAlertModal save endpoint selection', () => {
  const authentication = { token: 't', domain: 'd', apiKey: 'k' }
  const saved = Promise.resolve({ data: { data: { id: 'new-id' } } })

  beforeEach(() => {
    jest.clearAllMocks()
    getAllDataAlertsLabelsByProject.mockReturnValue(Promise.resolve({ data: { data: { items: [] } } }))
    getAllDataAlertsLabels.mockReturnValue(Promise.resolve({ data: { data: { items: [] } } }))
    createDataAlert.mockReturnValue(saved)
    createManagementDataAlert.mockReturnValue(saved)
  })

  const save = (props) => {
    const wrapper = mount(<DataAlertModal authentication={authentication} isVisible {...props} />)
    const instance = wrapper.find('DataAlertModal').last().instance()
    instance.getDataAlertData = () => ({ title: 'alert' })
    instance.onDataAlertSave()
  }

  it('uses the regular endpoint when only autoQLConfig.projectId is set', () => {
    save({ autoQLConfig: { projectId: 'p1' } })

    expect(createDataAlert).toHaveBeenCalledTimes(1)
    expect(createManagementDataAlert).not.toHaveBeenCalled()
  })

  it('uses the management endpoint when isManagementPortal is true', () => {
    save({ autoQLConfig: { projectId: 'p1' }, isManagementPortal: true })

    expect(createManagementDataAlert).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1' }))
    expect(createDataAlert).not.toHaveBeenCalled()
  })
})
