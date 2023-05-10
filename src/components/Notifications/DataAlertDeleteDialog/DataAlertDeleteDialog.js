import React from 'react'
import PropTypes from 'prop-types'

import { ConfirmModal } from '../../ConfirmModal'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { deleteDataAlert } from '../../../js/notificationService'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

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
    onClose: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    dataAlertId: undefined,
    isVisible: false,
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
          <h3>Are you sure you want to delete this Data Alert?</h3>
          <p>You will no longer be notified about these changes in your data.</p>
        </ConfirmModal>
      </ErrorBoundary>
    )
  }
}
