import React from 'react'
import { mount } from 'enzyme'
import CustomFilteredAlertModal from '../CustomFilteredAlertModal'
import {
  getAllDataAlertsLabels,
  getAllDataAlertsLabelsByProject,
  createDataAlert,
  createManagementDataAlert,
  previewDataAlert,
  previewManagementDataAlert,
} from 'autoql-fe-utils'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  getAllDataAlertsLabels: jest.fn(),
  getAllDataAlertsLabelsByProject: jest.fn(),
  createDataAlert: jest.fn(),
  createManagementDataAlert: jest.fn(),
  previewDataAlert: jest.fn(),
  previewManagementDataAlert: jest.fn(),
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
    const wrapper = mount(<CustomFilteredAlertModal authentication={authentication} autoQLConfig={{}} isVisible />)
    wrapper.setProps({ autoQLConfig: { projectId: 'p1' } })

    expect(getAllDataAlertsLabelsByProject).toHaveBeenCalledTimes(1)
    expect(getAllDataAlertsLabels).not.toHaveBeenCalled()
  })

  it('calls getAllDataAlertsLabels (not getAllDataAlertsLabelsByProject) when isManagementPortal is true', () => {
    const wrapper = mount(
      <CustomFilteredAlertModal authentication={authentication} autoQLConfig={{}} isManagementPortal isVisible />,
    )
    wrapper.setProps({ autoQLConfig: { projectId: 'p1' } })

    expect(getAllDataAlertsLabels).toHaveBeenCalledTimes(1)
    expect(getAllDataAlertsLabelsByProject).not.toHaveBeenCalled()
  })

  it('does not fetch labels when authentication is incomplete', () => {
    const wrapper = mount(<CustomFilteredAlertModal autoQLConfig={{}} isVisible />)
    wrapper.setProps({ autoQLConfig: { projectId: 'p1' } })

    expect(getAllDataAlertsLabels).not.toHaveBeenCalled()
    expect(getAllDataAlertsLabelsByProject).not.toHaveBeenCalled()
  })

  it('does not fetch labels while the modal is closed, and fetches once when it opens', () => {
    const wrapper = mount(
      <CustomFilteredAlertModal authentication={authentication} autoQLConfig={{ projectId: 'p1' }} />,
    )

    expect(getAllDataAlertsLabelsByProject).not.toHaveBeenCalled()

    wrapper.setProps({ isVisible: true })

    expect(getAllDataAlertsLabelsByProject).toHaveBeenCalledTimes(1)
  })
})

describe('CustomFilteredAlertModal endpoint selection', () => {
  const authentication = { token: 't', domain: 'd', apiKey: 'k' }
  const resolved = Promise.resolve({ data: { data: { id: 'new-id', items: [] } } })

  beforeEach(() => {
    jest.clearAllMocks()
    getAllDataAlertsLabels.mockReturnValue(resolved)
    getAllDataAlertsLabelsByProject.mockReturnValue(resolved)
    createDataAlert.mockReturnValue(resolved)
    createManagementDataAlert.mockReturnValue(resolved)
    previewDataAlert.mockReturnValue(resolved)
    previewManagementDataAlert.mockReturnValue(resolved)
  })

  const getInstance = (props) => {
    const wrapper = mount(<CustomFilteredAlertModal authentication={authentication} isVisible {...props} />)
    return wrapper.find('CustomFilteredAlertModal').last().instance()
  }

  it('saves and previews through the regular endpoints when only autoQLConfig.projectId is set', async () => {
    const instance = getInstance({ autoQLConfig: { projectId: 'p1' } })
    instance.getDataAlertData = () => ({ title: 'alert' })
    instance.getBaseDataAlertId = () => 'base-id'

    await instance.onDataAlertSave()
    instance.loadBasePreview()

    expect(createDataAlert).toHaveBeenCalledTimes(1)
    expect(previewDataAlert).toHaveBeenCalledTimes(1)
    expect(createManagementDataAlert).not.toHaveBeenCalled()
    expect(previewManagementDataAlert).not.toHaveBeenCalled()
  })

  it('saves and previews through the management endpoints when isManagementPortal is true', async () => {
    const instance = getInstance({ autoQLConfig: { projectId: 'p1' }, isManagementPortal: true })
    instance.getDataAlertData = () => ({ title: 'alert' })
    instance.getBaseDataAlertId = () => 'base-id'

    await instance.onDataAlertSave()
    instance.loadBasePreview()

    expect(createManagementDataAlert).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1' }))
    expect(previewManagementDataAlert).toHaveBeenCalledTimes(1)
    expect(createDataAlert).not.toHaveBeenCalled()
    expect(previewDataAlert).not.toHaveBeenCalled()
  })
})
