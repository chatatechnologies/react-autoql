import React from 'react'
import PropTypes from 'prop-types'
import { deleteDataAlert, authenticationDefault, getAuthentication } from 'autoql-fe-utils'

import { ConfirmModal } from '../../ConfirmModal'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { authenticationType } from '../../../props/types'

export default class DataAlertDeleteDialog extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      isDeletingDataAlert: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    dataAlertId: PropTypes.string,
    isVisible: PropTypes.bool,
    currentDataAlert: PropTypes.shape({}),
    onClose: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    dataAlertId: undefined,
    isVisible: false,
    currentDataAlert: undefined,
    onClose: () => {},
    onErrorCallback: () => {},
  }

  onDataAlertDelete = () => {
    if (this.props.dataAlertId) {
      this.setState({
        isDeletingDataAlert: true,
      })

      deleteDataAlert(this.props.dataAlertId, getAuthentication(this.props.authentication))
        .then(() => {
          this.props.onDelete(this.props.dataAlertId)
          this.props.onSuccessAlert('Data Alert was successfully deleted.')
        })
        .catch((error) => {
          console.error(error)
          this.props.onErrorCallback(error)
        })
        .finally(() => {
          this.setState({
            isDeletingDataAlert: false,
          })
        })
    }
  }
  getHeadingText = () => {
    const { currentDataAlert } = this.props

    if (!currentDataAlert?.title) {
      return 'Are you sure you want to delete this Data Alert?'
    }

    const alertType = currentDataAlert.project?.id === 'composite' ? 'composite alert' : 'alert'
    return `Are you sure you want to delete '${currentDataAlert.title}' ${alertType}?`
  }
  render = () => {
    return (
      <ErrorBoundary>
        <ConfirmModal
          isVisible={this.props.isVisible}
          onConfirm={this.onDataAlertDelete}
          confirmLoading={this.state.isDeletingDataAlert}
          onClose={this.props.onClose}
          backText='Go back'
          confirmText='Delete'
          width='450px'
        >
          <h3>{this.getHeadingText()}</h3>
          <p>You will no longer be notified about these changes in your data.</p>
        </ConfirmModal>
      </ErrorBoundary>
    )
  }
}
