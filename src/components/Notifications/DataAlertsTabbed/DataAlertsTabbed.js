import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { fetchDataAlerts, authenticationDefault, getAuthentication } from 'autoql-fe-utils'

import { Tooltip } from '../../Tooltip'
import { DataAlertModal } from '../DataAlertModal'
import { CustomFilteredAlertModal } from '../CompositeAlerts/CustomFilteredAlertModal'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { DataAlertDeleteDialog } from '../DataAlertDeleteDialog'
import DataAlertsList from './DataAlertsList'

import { withTheme } from '../../../theme'
import { authenticationType } from '../../../props/types'

import './DataAlertsTabbed.scss'

const TAB_MY_ALERTS = 'my-alerts'
const TAB_ORG_ALERTS = 'org-alerts'

class DataAlertsTabbed extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    authentication: authenticationType,
    tooltipID: PropTypes.string,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    onDMLinkClick: PropTypes.func,
    onDashboardLinkClick: PropTypes.func,
    onDataAlertStatusChange: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    tooltipID: 'react-autoql-data-alerts-tabbed-tooltip',
    onErrorCallback: () => {},
    onDataAlertStatusChange: () => {},
    onDMLinkClick: () => {},
    onDashboardLinkClick: () => {},
    onSuccessAlert: () => {},
  }

  state = {
    isEditModalVisible: false,
    isCustomFilteredAlertModalVisible: false,
    activeDataAlert: undefined,
    activeTab: TAB_MY_ALERTS,
    loading: true,
    customAlertsList: undefined,
    projectAlertsList: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.getDataAlerts()
  }

  componentDidUpdate = (prevProps) => {
    if (!_isEqual(getAuthentication(this.props.authentication), getAuthentication(prevProps.authentication))) {
      this.getDataAlerts()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  refresh = () => {
    this.getDataAlerts()
  }

  getDataAlerts = () => {
    fetchDataAlerts({ ...getAuthentication(this.props.authentication) })
      .then((response) => {
        this._isMounted &&
          this.setState({
            loading: false,
            customAlertsList: response?.data?.custom_alerts,
            projectAlertsList: response?.data?.project_alerts,
          })
      })
      .catch(console.error)
  }

  onDataAlertSave = () => {
    this.getDataAlerts()
    this.setState({ isEditModalVisible: false })
  }

  onCustomFilteredAlertSave = () => {
    this.getDataAlerts()
    this.setState({ isCustomFilteredAlertModalVisible: false })
  }

  onDataAlertDeleteClick = (dataAlertDeleteId) => {
    this.setState({ isDeleteDialogOpen: true, dataAlertDeleteId })
  }

  onDataAlertDelete = (dataAlertId) => {
    const newList = (this.state.customAlertsList ?? []).filter((a) => a.id !== dataAlertId)
    this.setState({
      customAlertsList: newList,
      isEditModalVisible: false,
      isDeleteDialogOpen: false,
      dataAlertDeleteId: undefined,
    })
  }

  openEditModal = (activeDataAlert, step) => {
    this.setState({ activeDataAlert, isEditModalVisible: true })
    if (step === 'schedule') {
      setTimeout(() => {
        this.editModalRef?.setStep(this.editModalRef?.FREQUENCY_STEP)
      }, 0)
    }
  }

  openCustomFilteredAlertModal = (activeDataAlert) => {
    this.setState({ activeDataAlert, isCustomFilteredAlertModalVisible: true })
  }

  renderModals = () => {
    const sharedProps = {
      authentication: this.props.authentication,
      onErrorCallback: this.props.onErrorCallback,
      onSuccessAlert: this.props.onSuccessAlert,
      onDelete: this.onDataAlertDelete,
      tooltipID: this.props.tooltipID,
    }

    return (
      <>
        <DataAlertModal
          ref={(r) => (this.editModalRef = r)}
          key={`edit-${this.COMPONENT_KEY}`}
          {...sharedProps}
          isVisible={this.state.isEditModalVisible}
          onClose={() => this.setState({ isEditModalVisible: false })}
          currentDataAlert={this.state.activeDataAlert}
          onSave={this.onDataAlertSave}
          editView
        />
        <CustomFilteredAlertModal
          ref={(r) => (this.customFilteredAlertModalRef = r)}
          key={`custom-${this.COMPONENT_KEY}`}
          {...sharedProps}
          isVisible={this.state.isCustomFilteredAlertModalVisible}
          onClose={() => this.setState({ isCustomFilteredAlertModalVisible: false })}
          currentDataAlert={this.state.activeDataAlert}
          onSave={this.onCustomFilteredAlertSave}
          editView
        />
        <DataAlertDeleteDialog
          authentication={this.props.authentication}
          dataAlertId={this.state.dataAlertDeleteId}
          isVisible={this.state.isDeleteDialogOpen}
          onDelete={this.onDataAlertDelete}
          onErrorCallback={this.props.onErrorCallback}
          onSuccessAlert={this.props.onSuccessAlert}
          onClose={() => this.setState({ isDeleteDialogOpen: false })}
        />
      </>
    )
  }

  render = () => {
    const { activeTab, loading } = this.state
    const customAlertsList = this.state.customAlertsList ?? []
    const projectAlertsList = this.state.projectAlertsList ?? []

    const sharedListProps = {
      authentication: this.props.authentication,
      tooltipID: this.props.tooltipID,
      onErrorCallback: this.props.onErrorCallback,
      onSuccessAlert: this.props.onSuccessAlert,
      onDataAlertStatusChange: this.props.onDataAlertStatusChange,
      openEditModal: this.openEditModal,
      openCustomFilteredAlertModal: this.openCustomFilteredAlertModal,
      onDataAlertDeleteClick: this.onDataAlertDeleteClick,
      onInitialize: this.getDataAlerts,
    }

    return (
      <ErrorBoundary>
        <div className='react-autoql-data-alerts-tabbed'>
          <div className='data-alerts-tab-bar'>
            <button
              className={`data-alerts-tab${activeTab === TAB_MY_ALERTS ? ' active' : ''}`}
              onClick={() => this.setState({ activeTab: TAB_MY_ALERTS })}
            >
              My Alerts
              {customAlertsList.length > 0 && (
                <span className='data-alerts-tab-count'>{customAlertsList.length}</span>
              )}
            </button>
            <button
              className={`data-alerts-tab${activeTab === TAB_ORG_ALERTS ? ' active' : ''}`}
              onClick={() => this.setState({ activeTab: TAB_ORG_ALERTS })}
            >
              Available Alerts
              {projectAlertsList.length > 0 && (
                <span className='data-alerts-tab-count'>{projectAlertsList.length}</span>
              )}
            </button>
          </div>

          <div className='data-alerts-tab-content'>
            {activeTab === TAB_MY_ALERTS && (
              <DataAlertsList
                {...sharedListProps}
                type='custom'
                alerts={customAlertsList}
                loading={loading}
                emptyMessage='No Custom Alerts are set up yet.'
                shouldRenderCreateCustomFilteredAlert
              />
            )}
            {activeTab === TAB_ORG_ALERTS && (
              <DataAlertsList
                {...sharedListProps}
                type='project'
                alerts={projectAlertsList}
                loading={loading}
                emptyMessage='No Available Alerts have been set up yet.'
              />
            )}
          </div>

          {this.renderModals()}
          <Tooltip tooltipId={this.props.tooltipID} delayShow={500} />
        </div>
      </ErrorBoundary>
    )
  }
}

export default withTheme(DataAlertsTabbed)
