import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { QueryOutput } from '../QueryOutput'
import { Modal } from '../Modal'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { reportProblem } from '../../js/queryService'
import { authenticationType } from '../../props/types'
import { authenticationDefault, getAuthentication } from '../../props/defaults'

export default class ReportProblemModal extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    onReportProblem: PropTypes.func,
    isVisible: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    responseRef: undefined,
    isVisible: false,
    onReportProblem: () => {},
  }

  state = {
    reportProblemMessage: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  reportQueryProblem = (reason) => {
    const queryId = _get(this.props.responseRef, 'queryResponse.data.data.query_id')
    this.setState({ isReportingProblem: true })
    reportProblem({
      message: reason,
      queryId,
      ...getAuthentication(this.props.authentication),
    })
      .then(() => {
        this.props.onReportProblem({
          successMessage: 'Thank you for your feedback! To continue, try asking another query.',
        })
        if (this._isMounted) {
          this.setState({ isReportingProblem: false })
        }
      })
      .catch((error) => {
        this.props.onReportProblem({ error })
        if (this._isMounted) {
          this.setState({ isReportingProblem: false })
        }
      })
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          className={this.props.className}
          contentClassName={this.props.contentClassName}
          isVisible={this.props.isVisible}
          onClose={() => {
            this.props.onClose()
            this.setState({
              reportProblemMessage: undefined,
            })
          }}
          onConfirm={() => {
            this.reportQueryProblem(this.state.reportProblemMessage)
            this.setState({
              reportProblemMessage: undefined,
            })
          }}
          confirmLoading={this.state.isReportingProblem}
          title='Report a Problem'
          enableBodyScroll={true}
          width='600px'
          confirmText='Report'
          confirmDisabled={this.state.reportProblemMessage ? false : true}
        >
          Please tell us more about the problem you are experiencing:
          <textarea
            className='report-problem-text-area'
            onChange={(e) =>
              this.setState({
                reportProblemMessage: e.target.value,
              })
            }
          />
        </Modal>
      </ErrorBoundary>
    )
  }
}
