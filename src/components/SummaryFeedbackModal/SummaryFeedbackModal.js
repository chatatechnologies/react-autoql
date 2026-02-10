import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { deepEqual } from 'autoql-fe-utils'

import { Modal } from '../Modal'
import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './SummaryFeedbackModal.scss'

export default class SummaryFeedbackModal extends React.Component {
  static propTypes = {
    onFeedback: PropTypes.func,
    isVisible: PropTypes.bool,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    isVisible: false,
    onFeedback: () => {},
    onClose: () => {},
  }

  state = {
    feedbackMessage: '',
    isSubmitting: false,
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps) => {
    if (!this.props.isVisible && prevProps.isVisible) {
      this.setState({ feedbackMessage: '' })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onConfirm = () => {
    this.setState({ isSubmitting: true })
    this.props.onFeedback({
      feedback: 'negative',
      message: this.state.feedbackMessage,
      onComplete: () => {
        if (this._isMounted) {
          this.setState({ isSubmitting: false, feedbackMessage: '' })
        }
      },
    })
  }

  onClose = () => {
    this.props.onClose()
    this.setState({
      feedbackMessage: '',
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
          confirmLoading={this.state.isSubmitting}
          title='Provide Feedback'
          enableBodyScroll={true}
          width='600px'
          confirmText='Submit'
          confirmDisabled={!this.state.feedbackMessage.trim()}
        >
          <div className='summary-feedback-modal-body'>
            <div className='summary-feedback-modal-header'>
              <Icon type='thumbs-down' />
              <span>Provide more information:</span>
            </div>
            <textarea
              className='summary-feedback-text-area'
              placeholder='Tell us what we can improve...'
              value={this.state.feedbackMessage}
              onChange={(e) =>
                this.setState({
                  feedbackMessage: e.target.value,
                })
              }
              rows={6}
            />
          </div>
        </Modal>
      </ErrorBoundary>
    )
  }
}
