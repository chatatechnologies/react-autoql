import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { Modal } from '../Modal'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { reportProblem } from '../../js/queryService'
import { authenticationType } from '../../props/types'
import { authenticationDefault, getAuthentication } from '../../props/defaults'
import { Radio } from '../Radio'
import { deepEqual } from '../../js/Util'

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
    problemType: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps) => {
    if (!this.props.isVisible && prevProps.isVisible) {
      this.setState({ problemType: undefined, reportProblemMessage: undefined })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  reportQueryProblem = () => {
    let message = this.state.problemType
    if (this.state.problemType === 'Other') {
      message = this.state.reportProblemMessage
    } else if (this.state.reportProblemMessage) {
      message = `${message} - ${this.state.reportProblemMessage}`
    }

    const queryId = _get(this.props.responseRef, 'queryResponse.data.data.query_id')
    this.setState({ isReportingProblem: true })
    reportProblem({
      message,
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

  onConfirm = () => {
    this.reportQueryProblem()
    this.setState({
      reportProblemMessage: undefined,
    })
  }

  onClose = () => {
    this.props.onClose()
    this.setState({
      reportProblemMessage: undefined,
    })
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          className={this.props.className}
          contentClassName={this.props.contentClassName}
          isVisible={this.props.isVisible}
          onClose={this.onClose}
          onConfirm={this.onConfirm}
          confirmLoading={this.state.isReportingProblem}
          title='Report a Problem'
          enableBodyScroll={true}
          width='600px'
          confirmText='Report'
          confirmDisabled={
            !this.state.problemType || (this.state.problemType === 'Other' && !this.state.reportProblemMessage)
          }
        >
          <div className='report-problem-modal-body'>
            <h3>What's happening?</h3>
            <Radio
              className='report-problem-radio-group'
              options={['The data is incorrect', 'The data is incomplete', 'Other']}
              data-test='report-problem-radio-group'
              value={this.state.problemType}
              onChange={(value) => this.setState({ problemType: value })}
            />
            Please tell us more about the problem you are experiencing:
            <textarea
              className='report-problem-text-area'
              onChange={(e) =>
                this.setState({
                  reportProblemMessage: e.target.value,
                })
              }
            />
          </div>
        </Modal>
      </ErrorBoundary>
    )
  }
}
