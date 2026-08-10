import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { getAuthentication, fetchLLMSummary, authenticationDefault, autoQLConfigDefault, MAX_DATA_PAGE_SIZE } from 'autoql-fe-utils'

import { Modal } from '../Modal'
import { LoadingDots } from '../LoadingDots'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { Input } from '../Input'
import SummaryFooter from '../ChatMessage/SummaryFooter'
import SummaryContent from '../SummaryContent/SummaryContent'
import { CustomScrollbars } from '../CustomScrollbars'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { MagicWandBillingGateNotice } from '../MagicWandBillingGate'
import { getMagicWandBillingErrorState } from '../../hooks/billing'

import { authenticationType, autoQLConfigType } from '../../props/types'

import './SummaryModal.scss'

export default class SummaryModal extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.markdownContentRef = React.createRef()

    this.state = {
      summary: null,
      isGenerating: false,
      focusPromptUsed: '',
      focusError: null,
      billingGateState: null,
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
    enableBillingGate: PropTypes.bool,
    quotaStatus: PropTypes.string,
    billingExecutionType: PropTypes.oneOf(['STRIPE', 'EXPORT']),
    onQuotaExceeded: PropTypes.func,
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
    enableBillingGate: false,
    quotaStatus: undefined,
    billingExecutionType: undefined,
    onQuotaExceeded: undefined,
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
        billingGateState: null,
        queryId: this.props.queryResponse?.data?.data?.query_id || null,
      })

      // Auto-generate summary when modal opens (with or without focus prompt)
      // Small delay to ensure state is set
      clearTimeout(this.generateSummaryTimeout)
      this.generateSummaryTimeout = setTimeout(() => {
        this.handleGenerateSummary(focusPrompt)
      }, 100)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.generateSummaryTimeout)
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

    if (this.props.enableBillingGate && this.props.quotaStatus === 'at_or_over_quota') {
      this.setState({ focusError: null, billingGateState: 'over_quota', focusPromptUsed: promptToUse })
      return
    }

    this.setState({ isGenerating: true, focusError: null, billingGateState: null, focusPromptUsed: promptToUse })

    try {
      // Get filtered data from QueryOutput's tableData (already filtered)
      const filteredRows = this.props.responseRef?.tableData || queryResponse.data.data.rows

      const isOverRowLimit = filteredRows.length > MAX_DATA_PAGE_SIZE
      const response = await fetchLLMSummary({
        data: {
          additional_context: {
            text: queryResponse.data.data.text,
            interpretation: queryResponse.data.data.interpretation,
            focus_prompt: promptToUse.trim() || '',
          },
          rows: isOverRowLimit ? [] : filteredRows,
          columns: isOverRowLimit ? [] : queryResponse.data.data.columns,
          ...(isOverRowLimit && { override_row_limit: true }),
        },
        queryID: queryResponse.data.data.query_id,
        apiKey: auth.apiKey,
        token: auth.token,
        domain: auth.domain,
      })

      const summary = response?.data?.data?.summary

      if (summary) {
        if (this._isMounted) {
          this.setState({
            summary,
            focusPromptUsed: promptToUse.trim() || '',
            queryId: queryResponse.data.data.query_id,
          })
        }
      } else {
        const errorMessage = response?.data?.data?.message || response?.data?.message || response?.message
        const displayMessage = errorMessage || 'Failed to generate summary. Please try again.'
        if (this._isMounted) {
          this.setState({ focusError: displayMessage })
        }
        this.props.onErrorCallback?.(displayMessage)
      }
    } catch (error) {
      const gateState = this.props.enableBillingGate ? getMagicWandBillingErrorState(error) : null
      if (gateState) {
        if (this._isMounted) {
          this.setState({ billingGateState: gateState })
        }
      } else {
        const errorMessage =
          error?.response?.data?.data?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to generate summary. Please try again.'

        if (this._isMounted) {
          this.setState({ focusError: errorMessage })
        }
        this.props.onErrorCallback?.(errorMessage)
      }
    } finally {
      if (this._isMounted) {
        this.setState({ isGenerating: false })
      }
    }
  }

  copyMarkdownAsPlainText = async () => {
    if (!this.state.summary || !this.markdownContentRef.current) {
      return
    }

    try {
      const text = this.markdownContentRef.current.innerText

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        this.props.onSuccessAlert?.('Successfully copied Analysis to clipboard!')
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        this.props.onSuccessAlert?.('Successfully copied Analysis to clipboard!')
      }
    } catch (error) {
      console.error('Failed to copy markdown:', error)
      this.props.onErrorCallback?.(error)
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
          <p>Analyzing data...</p>
        </div>
      )
    }

    if (this.state.summary) {
      // Get the focus prompt that was used (stored before clearing)
      const focusPromptUsed = this.state.focusPromptUsed || ''

      return (
        <CustomScrollbars className='summary-modal-scroll-container' suppressScrollX>
          <div className='summary-modal-content'>
            <div className='summary-modal-actions'>
              <Button
                onClick={this.copyMarkdownAsPlainText}
                className='summary-modal-copy-btn'
                tooltip='Copy analysis'
                tooltipID={this.props.tooltipID}
                data-test='summary-modal-copy-markdown-btn'
                size='small'
              >
                <Icon type='copy' />
              </Button>
            </div>
            <div ref={this.markdownContentRef}>
              <SummaryContent
                content={this.state.summary}
                focusPromptUsed={focusPromptUsed}
                className='summary-modal-summary-content'
                titleClassName='summary-modal-title'
                markdownClassName='summary-modal-markdown'
              />
            </div>
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

    // Show the proactive/reactive billing gate notice in place of the generic error
    if (this.state.billingGateState) {
      return (
        <div className='summary-modal-empty'>
          <Icon type='magic-wand' size='large' />
          <h3>Auto Analyze</h3>
          <MagicWandBillingGateNotice
            state={this.state.billingGateState}
            onIncreaseQuota={this.props.onQuotaExceeded}
            billingExecutionType={this.props.billingExecutionType}
          />
        </div>
      )
    }

    // Show error if generation failed
    if (this.state.focusError) {
      return (
        <div className='summary-modal-empty'>
          <Icon type='magic-wand' size='large' />
          <h3>Auto Analyze</h3>
          <p className='summary-modal-error'>{this.state.focusError}</p>
        </div>
      )
    }

    return (
      <div className='summary-modal-empty'>
        <Icon type='magic-wand' size='large' />
        <h3>Auto Analyze</h3>
        <p>Generating an AI-powered summary of your data...</p>
        {hasNoData && <p className='summary-modal-error'>No data available to generate a summary.</p>}
      </div>
    )
  }

  renderFooter = () => {
    // No footer - errors are shown in the modal body
    return null
  }

  render = () => {
    const queryResponse = this.props.queryResponse || this.props.responseRef?.queryResponse
    const title = queryResponse?.data?.data?.text || 'Analyze'
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