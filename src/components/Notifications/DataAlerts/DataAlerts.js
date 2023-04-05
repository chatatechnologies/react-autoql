import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'

import { Icon } from '../../Icon'
import { Tooltip } from '../../Tooltip'
import { LoadingDots } from '../../LoadingDots'
import { DataAlertModal } from '../DataAlertModal'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import DataAlertListItem from './DataAlertListItem'
import emptyStateImg from '../../../images/notifications_empty_state_blue.png'
import { fetchDataAlerts, updateDataAlertStatus } from '../../../js/notificationService'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'
import { withTheme } from '../../../theme'

import './DataAlerts.scss'

class DataAlerts extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,

    onSuccessAlert: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onErrorCallback: () => {},
    onAlertInitializationCallback: () => {},
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
    this._isMounted && this.getDataAlerts()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(getAuthentication(this.props.authentication), getAuthentication(prevProps.authentication))) {
      this.getDataAlerts()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
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

  onEditClick = (e, notification) => {
    e.stopPropagation()
    this.setState({
      isEditModalVisible: true,
      activeDataAlert: notification,
    })
  }

  onDataAlertSave = () => {
    this.getDataAlerts()
    this.props.onSuccessAlert('Notification created!')
    this.setState({
      isEditModalVisible: false,
    })
  }

  onDataAlertDelete = (dataAlertId) => {
    const newList = this.state.customAlertsList.filter((dataAlert) => dataAlert.id !== dataAlertId)
    this.setState({
      customAlertsList: newList,
      isEditModalVisible: false,
    })
  }

  onEnableSwitchChange = (e, dataAlert) => {
    const newStatus = e.target.checked ? 'ACTIVE' : 'INACTIVE'

    const listType = dataAlert.type === 'CUSTOM' ? 'customAlertsList' : 'projectAlertsList'

    const newList = this.state[listType].map((n) => {
      if (dataAlert.id === n.id) {
        return {
          ...n,
          status: newStatus,
        }
      }
      return n
    })

    this.setState({ [`${listType}`]: newList })

    updateDataAlertStatus({
      dataAlertId: dataAlert.id,
      type: dataAlert.type,
      status: newStatus,
      ...getAuthentication(this.props.authentication),
    }).catch((error) => {
      console.error(error)
      this.props.onErrorCallback(new Error('Something went wrong. Please try again.'))

      // Get original state
      this.getDataAlerts()
    })
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
        onDelete={this.onDataAlertDelete}
        title={this.state.activeDataAlert ? 'Edit Data Alert' : 'Create Data Alert'}
        titleIcon={this.state.activeDataAlert ? <Icon type='edit' /> : <span />}
        selectedDemoProjectId={this.props.selectedDemoProjectId}
        tooltipID={this.props.tooltipID}
      />
    )
  }

  renderNotificationGroupTitle = (title, description) => (
    <div className='react-autoql-notification-title-container'>
      <div style={{ paddingLeft: '10px' }}>
        <div style={{ fontSize: '17px' }}>{title}</div>
        <div style={{ fontSize: '11px', opacity: 0.6 }}>{description}</div>
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

  onInitializeClick = (dataAlert) => {
    this.props.onAlertInitializationCallback(
      dataAlert,
      this.props.selectedDemoProjectId,
      getAuthentication(this.props.authentication),
    )
  }

  renderNotificationlist = (type, list) => {
    if (type === 'project' && !list?.length) {
      return null
    }

    return (
      <div className='data-alerts-list-container'>
        {type === 'custom' && list?.length
          ? this.renderNotificationGroupTitle('Custom Data Alerts', 'View and manage your custom Data Alerts')
          : null}
        {type === 'custom' && !list?.length && this.renderEmptyListMessage()}
        {type === 'project' &&
          this.renderNotificationGroupTitle(
            'Subscribe to a Data Alert',
            'Choose from a range of ready-to-use Alerts that have been set up for you',
          )}
        <div className='react-autoql-notification-settings-container'>
          {list &&
            list.map((dataAlert, i) => {
              return (
                <DataAlertListItem
                  authentication={this.props.authentication}
                  key={`react-autoql-notification-setting-item-${i}`}
                  dataAlert={dataAlert}
                  onSuccessCallback={this.props.onSuccessAlert}
                  onErrorCallback={this.props.onErrorCallback}
                  openEditModal={this.openEditModal}
                  onInitializeClick={this.onInitializeClick}
                />
              )
            })}
        </div>
      </div>
    )
  }

  renderEmptyListMessage = () => (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <div className='empty-list-message'>
        <img className='empty-list-img' src={emptyStateImg} />
      </div>
      <span style={{ opacity: 0.6 }}>No Alerts are set up yet.</span>
      <br />
      <span style={{ opacity: 0.6, width: '350px', display: 'inline-block' }}>
        To create one, select the “Create a Data Alert” option from a data response in Data Messenger.
      </span>
      <br />
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
        <div className='react-autoql-notification-settings' data-test='notification-settings'>
          {this.renderNotificationlist('project', projectAlertsList)}
          {this.renderNotificationlist('custom', customAlertsList)}
          {this.renderNotificationEditModal()}
          <Tooltip
            className='react-autoql-tooltip'
            id='react-autoql-notification-settings-tooltip'
            effect='solid'
            delayShow={500}
            html
          />
        </div>
      </ErrorBoundary>
    )
  }
}

export default withTheme(DataAlerts)
