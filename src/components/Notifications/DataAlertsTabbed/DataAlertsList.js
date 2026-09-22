import React from 'react'
import PropTypes from 'prop-types'
import { CUSTOM_TYPE } from 'autoql-fe-utils'

import emptyStateImg from '../../../images/notifications_empty_state_blue.png'
import { authenticationType } from '../../../props/types'
import { observeContainer } from '../../Charts/measureObserver'
import DataAlertRow from './DataAlertRow'

import './DataAlertRow.scss'

const SKELETON_COUNT = 4

// Below this the six column grid can't hold its columns without squashing them,
// so rows render as stacked cards instead. This is measured on the list itself
// rather than the viewport (or the device): the component is exported and gets
// embedded in host layouts that are often much narrower than the window.
const NARROW_WIDTH = 700

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

  state = {
    isNarrow: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.stopObserving = observeContainer(this.containerRef, ({ width }) => {
      // A width of 0 means the list is detached or hidden (inactive tab) - don't
      // let that flip the layout, the next real measurement will settle it.
      if (!width) {
        return
      }

      const isNarrow = width < NARROW_WIDTH
      if (this._isMounted && isNarrow !== this.state.isNarrow) {
        this.setState({ isNarrow })
      }
    })
  }

  componentWillUnmount = () => {
    this._isMounted = false
    this.stopObserving?.()
  }

  // Actions column is only meaningful when there's something to show in it
  hasActionsColumn = () => {
    const { alerts, type, shouldRenderCreateCustomFilteredAlert } = this.props
    if (shouldRenderCreateCustomFilteredAlert) return true
    return type === 'custom' || alerts.some((a) => a.type === CUSTOM_TYPE)
  }

  renderSkeletonRows = (showActionsColumn) => {
    const noActionsClass = showActionsColumn ? '' : ' no-actions-column'

    return Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <div key={i} className={`data-alert-skeleton-row${noActionsClass}`}>
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
        {showActionsColumn && <div className='data-alert-skeleton-cell' />}
      </div>
    ))
  }

  renderSkeletonCards = () =>
    Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <div key={i} className='data-alert-skeleton-card'>
        <div className='data-alert-skeleton-block' />
        <div className='data-alert-skeleton-block short' />
        <div className='data-alert-skeleton-block medium' />
      </div>
    ))

  renderRows = (showActionsColumn) => {
    const {
      alerts,
      type,
      authentication,
      tooltipID,
      onErrorCallback,
      onSuccessAlert,
      onDataAlertStatusChange,
      openEditModal,
      openCustomFilteredAlertModal,
      onDataAlertDeleteClick,
      onInitialize,
      shouldRenderCreateCustomFilteredAlert,
    } = this.props

    return alerts.map((dataAlert) => (
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
        isNarrow={this.state.isNarrow}
      />
    ))
  }

  renderCardList = () => (
    <div className='data-alerts-card-list'>
      {this.props.loading ? this.renderSkeletonCards() : this.renderRows(this.hasActionsColumn())}
    </div>
  )

  renderTable = () => {
    const showActionsColumn = this.hasActionsColumn()
    const noActionsClass = showActionsColumn ? '' : ' no-actions-column'

    return (
      <div className='data-alerts-table'>
        {/* Header and rows share one scroll container so the columns can never
            drift out of alignment when it scrolls sideways. */}
        <div className='data-alerts-table-scroll'>
          <div className={`data-alerts-table-inner${noActionsClass}`}>
            <div className={`data-alert-table-header${noActionsClass}`}>
              <div className='data-alert-header-cell'>Data Alert</div>
              <div className='data-alert-header-cell'>Frequency</div>
              <div className='data-alert-header-cell'>State</div>
              <div className='data-alert-header-cell'>Next Check</div>
              <div className='data-alert-header-cell'>Status</div>
              {showActionsColumn && <div className='data-alert-header-cell'>Actions</div>}
            </div>

            <div className='data-alerts-table-body'>
              {this.props.loading ? this.renderSkeletonRows(showActionsColumn) : this.renderRows(showActionsColumn)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  renderContent = () => {
    const { alerts, loading, emptyMessage } = this.props

    if (!loading && !alerts.length) {
      return (
        <div className='data-alerts-empty-state'>
          <img src={emptyStateImg} alt='' className='data-alerts-empty-img' />
          <span>{emptyMessage}</span>
        </div>
      )
    }

    return this.state.isNarrow ? this.renderCardList() : this.renderTable()
  }

  render() {
    return (
      <div
        ref={(r) => (this.containerRef = r)}
        className={`data-alerts-list${this.state.isNarrow ? ' data-alerts-list-narrow' : ''}`}
      >
        {this.renderContent()}
      </div>
    )
  }
}
