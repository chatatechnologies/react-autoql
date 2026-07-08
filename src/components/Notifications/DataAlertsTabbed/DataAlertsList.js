import React from 'react'
import PropTypes from 'prop-types'
import { CUSTOM_TYPE } from 'autoql-fe-utils'
import { isMobile } from 'react-device-detect'

import emptyStateImg from '../../../images/notifications_empty_state_blue.png'
import { authenticationType } from '../../../props/types'
import DataAlertRow from './DataAlertRow'

import './DataAlertRow.scss'

const SKELETON_COUNT = 4

export default class DataAlertsList extends React.Component {
  static propTypes = {
    alerts: PropTypes.arrayOf(PropTypes.shape({})),
    type: PropTypes.oneOf(['custom', 'project']),
    authentication: authenticationType,
    tooltipID: PropTypes.string,
    emptyMessage: PropTypes.string,
    loading: PropTypes.bool,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    onDataAlertStatusChange: PropTypes.func,
    openEditModal: PropTypes.func,
    openCustomFilteredAlertModal: PropTypes.func,
    onDataAlertDeleteClick: PropTypes.func,
    onInitialize: PropTypes.func,
    shouldRenderCreateCustomFilteredAlert: PropTypes.bool,
  }

  static defaultProps = {
    alerts: [],
    type: 'custom',
    tooltipID: undefined,
    emptyMessage: 'No alerts found.',
    loading: false,
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onDataAlertStatusChange: () => {},
    openEditModal: () => {},
    openCustomFilteredAlertModal: () => {},
    onDataAlertDeleteClick: () => {},
    onInitialize: () => {},
    shouldRenderCreateCustomFilteredAlert: false,
  }

  // Actions column is only meaningful when there's something to show in it
  hasActionsColumn = () => {
    const { alerts, type, shouldRenderCreateCustomFilteredAlert } = this.props
    if (isMobile) return false
    if (shouldRenderCreateCustomFilteredAlert) return true
    return type === 'custom' || alerts.some((a) => a.type === CUSTOM_TYPE)
  }

  renderSkeletonRows = () =>
    Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <div key={i} className='data-alert-skeleton-row'>
        <div className='data-alert-skeleton-cell'>
          <div className='data-alert-skeleton-block' />
        </div>
        <div className='data-alert-skeleton-cell'>
          <div className='data-alert-skeleton-block medium' />
        </div>
        <div className='data-alert-skeleton-cell'>
          <div className='data-alert-skeleton-block short' />
        </div>
        <div className='data-alert-skeleton-cell'>
          <div className='data-alert-skeleton-block short' />
        </div>
        <div className='data-alert-skeleton-cell'>
          <div className='data-alert-skeleton-block medium' />
        </div>
        <div className='data-alert-skeleton-cell' />
      </div>
    ))

  render() {
    const {
      alerts,
      type,
      authentication,
      tooltipID,
      emptyMessage,
      loading,
      onErrorCallback,
      onSuccessAlert,
      onDataAlertStatusChange,
      openEditModal,
      openCustomFilteredAlertModal,
      onDataAlertDeleteClick,
      onInitialize,
      shouldRenderCreateCustomFilteredAlert,
    } = this.props

    const showActionsColumn = this.hasActionsColumn()
    const noActionsClass = showActionsColumn ? '' : ' no-actions-column'

    if (!loading && !alerts.length) {
      return (
        <div className='data-alerts-empty-state'>
          <img src={emptyStateImg} alt='' className='data-alerts-empty-img' />
          <span>{emptyMessage}</span>
        </div>
      )
    }

    return (
      <div className='data-alerts-table'>
        <div className={`data-alert-table-header${noActionsClass}`}>
          <div className='data-alert-header-cell'>Data Alert</div>
          <div className='data-alert-header-cell'>Frequency</div>
          <div className='data-alert-header-cell'>State</div>
          <div className='data-alert-header-cell'>Next Check</div>
          <div className='data-alert-header-cell'>Status</div>
          {showActionsColumn && <div className='data-alert-header-cell'>Actions</div>}
        </div>

        <div className='data-alerts-table-body'>
          {loading
            ? this.renderSkeletonRows()
            : alerts.map((dataAlert) => (
                <DataAlertRow
                  key={`${type}-${dataAlert.id}`}
                  dataAlert={dataAlert}
                  authentication={authentication}
                  tooltipID={tooltipID}
                  onErrorCallback={onErrorCallback}
                  onSuccessAlert={onSuccessAlert}
                  onDataAlertStatusChange={onDataAlertStatusChange}
                  openEditModal={openEditModal}
                  openCustomFilteredAlertModal={openCustomFilteredAlertModal}
                  onDeleteClick={() => onDataAlertDeleteClick(dataAlert?.id)}
                  onInitialize={onInitialize}
                  shouldRenderCreateCustomFilteredAlert={shouldRenderCreateCustomFilteredAlert}
                  showActionsColumn={showActionsColumn}
                  className={noActionsClass}
                />
              ))}
        </div>
      </div>
    )
  }
}
