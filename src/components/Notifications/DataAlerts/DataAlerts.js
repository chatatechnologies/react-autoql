import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { fetchDataAlerts, authenticationDefault, getAuthentication } from 'autoql-fe-utils'

import { Tooltip } from '../../Tooltip'
import { LoadingDots } from '../../LoadingDots'
import { DataAlertModal } from '../DataAlertModal'
import DataAlertListItem from './DataAlertListItem/DataAlertListItem'
import { CustomScrollbars } from '../../CustomScrollbars'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { DataAlertDeleteDialog } from '../DataAlertDeleteDialog'

import { withTheme } from '../../../theme'
import { authenticationType } from '../../../props/types'
import emptyStateImg from '../../../images/notifications_empty_state_blue.png'

import './DataAlerts.scss'

class DataAlerts extends React.Component {
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
    tooltipID: 'react-autoql-notification-settings-tooltip',
    onErrorCallback: () => {},
    onDataAlertStatusChange: () => {},
    onDMLinkClick: () => {},
    onDashboardLinkClick: () => {},
    onSuccessAlert: () => {},
  }

  state = {
    isFetchingList: true,
    isEditModalVisible: false,
    activeDataAlert: undefined,

    customAlertsList: undefined,
    projectAlertsList: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.getDataAlerts()
  }

  componentDidUpdate = (prevProps, prevState) => {
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

  getDataAlerts = (type) => {
    fetchDataAlerts({
      ...getAuthentication(this.props.authentication),
      type,
    })
      .then((response) => {
        this._isMounted &&
          this.setState({
            customAlertsList: response?.data?.custom_alerts,
            projectAlertsList: response?.data?.project_alerts,
          })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  onDataAlertSave = () => {
    this.getDataAlerts()
    this.setState({ isEditModalVisible: false })
  }

  onDataAlertDeleteClick = (dataAlertDeleteId) => {
    this.setState({ isDeleteDialogOpen: true, dataAlertDeleteId })
  }

  onDataAlertDelete = (dataAlertId) => {
    const newList = this.state.customAlertsList.filter((dataAlert) => dataAlert.id !== dataAlertId)
    this.setState({
      customAlertsList: newList,
      isEditModalVisible: false,
      isDeleteDialogOpen: false,
      dataAlertDeleteId: undefined,
    })
  }

  renderDeleteDialog = () => {
    return (
      <DataAlertDeleteDialog
        authentication={this.props.authentication}
        dataAlertId={this.state.dataAlertDeleteId}
        isVisible={this.state.isDeleteDialogOpen}
        onDelete={this.onDataAlertDelete}
        onErrorCallback={this.props.onErrorCallback}
        onSuccessAlert={this.props.onSuccessAlert}
        onClose={() => this.setState({ isDeleteDialogOpen: false })}
      />
    )
  }

  renderNotificationEditModal = () => {
    return (
      <DataAlertModal
        ref={(r) => (this.editModalRef = r)}
        key={this.COMPONENT_KEY}
        authentication={this.props.authentication}
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        currentDataAlert={this.state.activeDataAlert}
        onSave={this.onDataAlertSave}
        onErrorCallback={this.props.onErrorCallback}
        onSuccessAlert={this.props.onSuccessAlert}
        onDelete={this.onDataAlertDelete}
        tooltipID={this.props.tooltipID}
        editView
      />
    )
  }

  renderDataAlertGroupTitle = (title, description) => (
    <div className='react-autoql-data-alert-section-title-container'>
      <div style={{ paddingLeft: '10px' }}>
        <div className='react-autoql-data-alert-section-title'>{title}</div>
        <div className='react-autoql-data-alert-section-subtitle'>{description}</div>
      </div>
    </div>
  )

  openEditModal = (activeDataAlert, step) => {
    this.setState({
      activeDataAlert,
      isEditModalVisible: true,
    })

    if (step === 'schedule') {
      setTimeout(() => {
        this.editModalRef?.setStep(this.editModalRef?.FREQUENCY_STEP)
      }, 0)
    }
  }

  renderNotificationlist = (type, list) => {
    if (type === 'project' && !list?.length) {
      return null
    }

    return (
      <div className='data-alerts-list-container'>
        {type === 'custom' && !!list
          ? this.renderDataAlertGroupTitle(
              'Custom Data Alerts',
              <span>
                View and manage your Custom Alerts here. To create a new Custom Alert, simply click on the "Create Data
                Alert" option from a query result in <a onClick={this.props.onDMLinkClick}>Data Messenger</a> or a{' '}
                <a onClick={this.props.onDashboardLinkClick}>Dashboard</a>.
              </span>,
            )
          : null}
        {type === 'custom' && !list?.length && this.renderEmptyListMessage()}
        {type === 'project' &&
          this.renderDataAlertGroupTitle(
            'Project Data Alerts',
            'Choose from a range of ready-to-use Alerts that have been set up for you.',
          )}
        <div className='react-autoql-notification-settings-container'>
          {list &&
            list.map((dataAlert, i) => {
              return (
                <DataAlertListItem
                  authentication={this.props.authentication}
                  key={dataAlert.id}
                  dataAlert={dataAlert}
                  onSuccessCallback={this.props.onSuccessAlert}
                  onErrorCallback={this.props.onErrorCallback}
                  openEditModal={this.openEditModal}
                  onDeleteClick={() => this.onDataAlertDeleteClick(dataAlert?.id)}
                  tooltipID='react-autoql-notification-settings-tooltip'
                  onInitialize={this.getDataAlerts}
                  onDataAlertStatusChange={this.props.onDataAlertStatusChange}
                  showHeader={i === 0}
                />
              )
            })}
        </div>
      </div>
    )
  }

  renderEmptyListMessage = () => (
    <div className='empty-list-message'>
      <img className='empty-list-img' src={emptyStateImg} />
      <span>No Custom Alerts are set up yet.</span>
    </div>
  )

  render = () => {
    if (!this.state.customAlertsList) {
      return (
        <div data-test='notification-settings' style={{ textAlign: 'center', marginTop: '100px' }}>
          <LoadingDots />
        </div>
      )
    }

    const projectAlertsList = this.state?.projectAlertsList ?? []
    const customAlertsList = this.state?.customAlertsList ?? []

    return (
      <ErrorBoundary>
        <CustomScrollbars>
          <div className='react-autoql-notification-settings' data-test='notification-settings'>
            {this.renderNotificationlist('project', projectAlertsList)}
            {this.renderNotificationlist('custom', customAlertsList)}
            {this.renderNotificationEditModal()}
            {this.renderDeleteDialog()}
            <Tooltip tooltipId='react-autoql-notification-settings-tooltip' delayShow={500} />
          </div>
        </CustomScrollbars>
      </ErrorBoundary>
    )
  }
}

export default withTheme(DataAlerts)
