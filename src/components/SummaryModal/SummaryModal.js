import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { getAuthentication, fetchLLMSummary, authenticationDefault, autoQLConfigDefault } from 'autoql-fe-utils'

import { Modal } from '../Modal'
import { LoadingDots } from '../LoadingDots'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { Input } from '../Input'
import SummaryFooter from '../ChatMessage/SummaryFooter'
import SummaryContent from '../SummaryContent/SummaryContent'
import { CustomScrollbars } from '../CustomScrollbars'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import { authenticationType, autoQLConfigType } from '../../props/types'

import './SummaryModal.scss'

export default class SummaryModal extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
      summary: null,
      isGenerating: false,
      focusPromptUsed: '',
      focusError: null,
      queryId: null,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
    responseRef: PropTypes.object, // QueryOutput ref
    queryResponse: PropTypes.object, // Query response data
    onSuccessAlert: PropTypes.func,
    onErrorCallback: PropTypes.func,
    tooltipID: PropTypes.string,
    initialFocusPrompt: PropTypes.string, // Focus prompt passed from popover
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    isOpen: false,
    onClose: () => {},
    responseRef: null,
    queryResponse: null,
    onSuccessAlert: () => {},
    onErrorCallback: () => {},
    tooltipID: undefined,
    initialFocusPrompt: '',
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentDidUpdate = (prevProps) => {
    // Reset state when modal opens and auto-generate summary
    if (this.props.isOpen && !prevProps.isOpen) {
      const focusPrompt = this.props.initialFocusPrompt || ''
      this.setState({
        summary: null,
        isGenerating: false,
        focusPromptUsed: focusPrompt,
        focusError: null,
        queryId: this.props.queryResponse?.data?.data?.query_id || null,
      })
      
      // Auto-generate summary when modal opens (with or without focus prompt)
      // Small delay to ensure state is set
      setTimeout(() => {
        this.handleGenerateSummary(focusPrompt)
      }, 100)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  handleGenerateSummary = async (focusPrompt = '') => {
    const queryResponse = this.props.queryResponse || this.props.responseRef?.queryResponse
    if (!queryResponse?.data?.data?.rows || !queryResponse?.data?.data?.columns) {
      return
    }

    const auth = getAuthentication(this.props.authentication, this.props.autoQLConfig)
    if (!auth.apiKey || !auth.domain) {
      this.props.onErrorCallback?.('Missing authentication credentials for summary generation')
      return
    }

    // Use provided focus prompt or fall back to prop
    const promptToUse = focusPrompt || this.props.initialFocusPrompt || ''

    this.setState({ isGenerating: true, focusError: null, focusPromptUsed: promptToUse })

    try {
      // Get filtered data from QueryOutput's tableData (already filtered)
      const filteredRows = this.props.responseRef?.tableData || queryResponse.data.data.rows

      const response = await fetchLLMSummary({
        data: {
          additional_context: {
            text: queryResponse.data.data.text,
            interpretation: queryResponse.data.data.interpretation,
            focus_prompt: promptToUse.trim() || '',
          },
          rows: filteredRows,
          columns: queryResponse.data.data.columns,
        },
        queryID: queryResponse.data.data.query_id,
        apiKey: auth.apiKey,
        token: auth.token,
        domain: auth.domain,
      })

      const summary = response?.data?.data?.summary

      if (summary) {
        this.setState({
          summary,
          focusPromptUsed: promptToUse.trim() || '',
          queryId: queryResponse.data.data.query_id,
        })
      } else {
        const errorMessage = response?.data?.data?.message || response?.data?.message || response?.message
        const displayMessage = errorMessage || 'Failed to generate summary. Please try again.'
        this.setState({ focusError: displayMessage })
        this.props.onErrorCallback?.(displayMessage)
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.data?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to generate summary. Please try again.'

      this.setState({ focusError: errorMessage })
      this.props.onErrorCallback?.(errorMessage)
    } finally {
      if (this._isMounted) {
        this.setState({ isGenerating: false })
      }
    }
  }

  renderContent = () => {
    const queryResponse = this.props.queryResponse || this.props.responseRef?.queryResponse
    const rows = queryResponse?.data?.data?.rows || []
    const rowCount = rows.length
    const hasNoData = rowCount === 0

    if (this.state.isGenerating) {
      return (
        <div className='summary-modal-loading'>
          <LoadingDots />
          <p>Generating summary...</p>
        </div>
      )
    }

    if (this.state.summary) {
      // Get the focus prompt that was used (stored before clearing)
      const focusPromptUsed = this.state.focusPromptUsed || ''
      
      return (
        <CustomScrollbars className='summary-modal-scroll-container'>
          <div className='summary-modal-content'>
            <SummaryContent
              content={this.state.summary}
              focusPromptUsed={focusPromptUsed}
              className='summary-modal-summary-content'
              titleClassName='summary-modal-title'
              markdownClassName='summary-modal-markdown'
            />
            <div className='summary-modal-feedback-footer'>
              <SummaryFooter
                messageId={`summary-modal-${this.COMPONENT_KEY}`}
                queryId={this.state.queryId}
                authentication={this.props.authentication}
                onSuccessAlert={this.props.onSuccessAlert}
                onErrorCallback={this.props.onErrorCallback}
                tooltipID={this.props.tooltipID}
              />
            </div>
          </div>
        </CustomScrollbars>
      )
    }

    // Show error if generation failed
    if (this.state.focusError) {
      return (
        <div className='summary-modal-empty'>
          <Icon type='magic-wand' size='large' />
          <h3>Generate Summary</h3>
          <p className='summary-modal-error'>{this.state.focusError}</p>
        </div>
      )
    }

    return (
      <div className='summary-modal-empty'>
        <Icon type='magic-wand' size='large' />
        <h3>Generate Summary</h3>
        <p>Generating an AI-powered summary of your data...</p>
        {hasNoData && (
          <p className='summary-modal-error'>No data available to generate a summary.</p>
        )}
      </div>
    )
  }

  renderFooter = () => {
    // No footer - errors are shown in the modal body
    return null
  }

  render = () => {
    const queryResponse = this.props.queryResponse || this.props.responseRef?.queryResponse
    const title = queryResponse?.data?.data?.text || 'Generate Summary'
    const footer = this.renderFooter()

    return (
      <ErrorBoundary>
        <Modal
          className='summary-modal'
          contentClassName='summary-modal-content-wrapper'
          title={title}
          isVisible={this.props.isOpen}
          width='90vw'
          height='90vh'
          showFooter={!!footer}
          footer={footer}
          enableBodyScroll={false}
          shouldRender={this.props.isOpen}
          onClose={this.props.onClose}
        >
          {this.renderContent()}
        </Modal>
      </ErrorBoundary>
    )
  }
}
