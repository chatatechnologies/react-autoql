import React from 'react'
import PropTypes from 'prop-types'
import { reportProblem, getAuthentication, authenticationDefault } from 'autoql-fe-utils'

import { Button } from '../Button'
import { SummaryFeedbackModal } from '../SummaryFeedbackModal'
import { authenticationType } from '../../props/types'

import './ChatMessage.scss'

export default class SummaryFooter extends React.Component {
  static propTypes = {
    messageId: PropTypes.string.isRequired,
    queryId: PropTypes.string, // Query ID from the original query response
    authentication: authenticationType,
    onSummaryFeedback: PropTypes.func, // Callback for feedback: (messageId, feedback: 'positive' | 'negative', message?: string) => void
    onSuccessAlert: PropTypes.func,
    onErrorCallback: PropTypes.func,
    tooltipID: PropTypes.string,
  }

  static defaultProps = {
    queryId: undefined,
    authentication: authenticationDefault,
    onSummaryFeedback: () => {},
    onSuccessAlert: () => {},
    onErrorCallback: () => {},
    tooltipID: undefined,
  }

  state = {
    summaryFeedback: null, // 'positive' | 'negative' | null
    isFeedbackModalOpen: false, // Whether the feedback modal is open
    isSubmittingFeedback: false, // Whether feedback is being submitted to API
  }

  handleSummaryFeedback = (feedback) => {
    if (feedback === 'negative') {
      // Open modal for negative feedback
      this.setState({ isFeedbackModalOpen: true })
    } else {
      // For positive feedback, submit to API
      const newFeedback = this.state.summaryFeedback === feedback ? null : feedback
      if (newFeedback === 'positive') {
        this.submitFeedbackToAPI('positive', '')
      } else {
        // Toggling off - just update state
        this.setState({ summaryFeedback: null })
      }
    }
  }

  submitFeedbackToAPI = (feedback, userMessage = '') => {
    // Add [MWT]: prefix for negative feedback with message
    const message = feedback === 'negative' && userMessage 
      ? `[MWT]: ${userMessage}`
      : feedback === 'positive'
      ? '[MWT]: Positive feedback'
      : '[MWT]: Negative feedback'

    this.setState({ isSubmittingFeedback: true, summaryFeedback: feedback })

    const auth = getAuthentication(this.props.authentication)
    if (!auth.apiKey || !auth.domain) {
      this.props.onErrorCallback?.('Missing authentication credentials for feedback submission')
      this.setState({ isSubmittingFeedback: false })
      return
    }

    reportProblem({
      message,
      queryId: this.props.queryId,
      isCorrect: feedback === 'positive', // Set to true when thumbs up is clicked
      ...auth,
    })
      .then(() => {
        // Call the callback
        if (this.props.onSummaryFeedback) {
          this.props.onSummaryFeedback(this.props.messageId, feedback, userMessage)
        }
        // Show success message
        this.props.onSuccessAlert?.('Thank you for your feedback!')
        this.setState({ isSubmittingFeedback: false })
      })
      .catch((error) => {
        this.props.onErrorCallback?.(error)
        this.setState({ isSubmittingFeedback: false, summaryFeedback: null })
      })
  }

  handleFeedbackModalClose = () => {
    this.setState({ isFeedbackModalOpen: false })
  }

  handleFeedbackSubmit = ({ feedback, message, onComplete }) => {
    // Submit feedback to API
    this.submitFeedbackToAPI('negative', message)
    
    // Close modal after a short delay to show success
    setTimeout(() => {
      this.setState({ isFeedbackModalOpen: false })
      if (onComplete) {
        onComplete()
      }
    }, 500)
  }

  render = () => {
    const { summaryFeedback } = this.state

    return (
      <div className='chat-message-summary-footer'>
        <div className='chat-message-summary-feedback-buttons'>
          <span className='chat-message-feedback-label'>How did we do?</span>
          <Button
            type='default'
            size='small'
            icon='thumbs-up'
            iconOnly
            onClick={() => this.handleSummaryFeedback('positive')}
            tooltip='Helpful'
            tooltipID={this.props.tooltipID}
            className={`chat-message-feedback-button ${summaryFeedback === 'positive' ? 'active positive' : ''}`}
          />
          <Button
            type='default'
            size='small'
            icon='thumbs-down'
            iconOnly
            onClick={() => this.handleSummaryFeedback('negative')}
            tooltip='Not helpful'
            tooltipID={this.props.tooltipID}
            className={`chat-message-feedback-button ${summaryFeedback === 'negative' ? 'active negative' : ''}`}
          />
        </div>
        <SummaryFeedbackModal
          isVisible={this.state.isFeedbackModalOpen}
          onClose={this.handleFeedbackModalClose}
          onFeedback={this.handleFeedbackSubmit}
          isSubmitting={this.state.isSubmittingFeedback}
        />
      </div>
    )
  }
}
