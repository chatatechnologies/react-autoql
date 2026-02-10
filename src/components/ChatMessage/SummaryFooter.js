import React from 'react'
import PropTypes from 'prop-types'

import { Button } from '../Button'
import { SummaryFeedbackModal } from '../SummaryFeedbackModal'

import './ChatMessage.scss'

export default class SummaryFooter extends React.Component {
  static propTypes = {
    messageId: PropTypes.string.isRequired,
    onSummaryFeedback: PropTypes.func, // Callback for feedback: (messageId, feedback: 'positive' | 'negative', message?: string) => void
    onSuccessAlert: PropTypes.func,
    tooltipID: PropTypes.string,
  }

  static defaultProps = {
    onSummaryFeedback: () => {},
    onSuccessAlert: () => {},
    tooltipID: undefined,
  }

  state = {
    summaryFeedback: null, // 'positive' | 'negative' | null
    isFeedbackModalOpen: false, // Whether the feedback modal is open
  }

  handleSummaryFeedback = (feedback) => {
    if (feedback === 'negative') {
      // Open modal for negative feedback
      this.setState({ isFeedbackModalOpen: true })
    } else {
      // For positive feedback, set it and show success message
      const newFeedback = this.state.summaryFeedback === feedback ? null : feedback
      this.setState({ summaryFeedback: newFeedback })
      if (this.props.onSummaryFeedback) {
        this.props.onSummaryFeedback(this.props.messageId, newFeedback)
      }
      // Show success message when feedback is submitted
      if (newFeedback === 'positive') {
        this.props.onSuccessAlert?.('Thank you for your feedback!')
      }
    }
  }

  handleFeedbackModalClose = () => {
    this.setState({ isFeedbackModalOpen: false })
  }

  handleFeedbackSubmit = ({ feedback, message, onComplete }) => {
    // Set feedback state
    this.setState({ summaryFeedback: 'negative' })
    
    // Call the callback with the feedback and message
    if (this.props.onSummaryFeedback) {
      this.props.onSummaryFeedback(this.props.messageId, 'negative', message)
    }
    
    // Show success message
    this.props.onSuccessAlert?.('Thank you for your feedback!')
    
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
        />
      </div>
    )
  }
}
