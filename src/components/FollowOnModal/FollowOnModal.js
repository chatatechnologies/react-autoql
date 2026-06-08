import React from 'react'
import PropTypes from 'prop-types'
import { dataFormattingDefault, getAuthentication, fetchFollowOnQuery } from 'autoql-fe-utils'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { Input } from '../Input'
import { Icon } from '../Icon'
import { Spinner } from '../Spinner'
import { CustomScrollbars } from '../CustomScrollbars'
import SimpleTable from '../SimpleTable/SimpleTable'

import './FollowOnModal.scss'

export default class FollowOnModal extends React.Component {
  static propTypes = {
    isVisible: PropTypes.bool,
    onClose: PropTypes.func,
    initialResults: PropTypes.arrayOf(PropTypes.shape({})),
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    queryResponse: PropTypes.shape({}),
    responseRef: PropTypes.shape({}),
  }

  static defaultProps = {
    isVisible: false,
    onClose: () => {},
    initialResults: [],
    dataFormatting: dataFormattingDefault,
    queryResponse: undefined,
    responseRef: undefined,
  }

  constructor(props) {
    super(props)
    this.state = {
      results: props.initialResults || [],
      queryText: '',
      isLoading: false,
      error: null,
    }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.isVisible && this.props.isVisible) {
      this.setState({ results: this.props.initialResults || [], queryText: '', error: null })
      setTimeout(() => this.scrollToBottom(), 100)
    }

    if (prevProps.initialResults !== this.props.initialResults) {
      this.setState({ results: this.props.initialResults || [] })
    }

    if (this.state.results.length !== (prevProps.initialResults || []).length) {
      this.scrollToBottom()
    }
  }

  scrollToBottom = () => {
    this.scrollbarsRef?.scrollToBottom()
  }

  handleTextChange = (e) => {
    this.setState({ queryText: e.target.value, error: null })
  }

  handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.handleSubmit()
    }
  }

  handleSubmit = async () => {
    const { queryText } = this.state
    if (!queryText.trim() || this.state.isLoading) return

    this.setState({ isLoading: true, error: null })

    try {
      const auth = getAuthentication(this.props.authentication, this.props.autoQLConfig)
      const queryResponse = this.props.responseRef?.queryResponse || this.props.queryResponse
      const filteredRows = this.props.responseRef?.tableData || queryResponse?.data?.data?.rows

      const response = await fetchFollowOnQuery({
        data: {
          question: queryText.trim(),
          additional_context: {
            text: queryResponse?.data?.data?.text,
            interpretation: queryResponse?.data?.data?.interpretation,
            focus_prompt: '',
          },
          columns: queryResponse?.data?.data?.columns,
          rows: filteredRows,
        },
        queryID: queryResponse?.data?.data?.query_id,
        apiKey: auth.apiKey,
        token: auth.token,
        domain: auth.domain,
      })

      const { columns, rows } = response?.data ?? {}
      const question = queryText.trim()

      this.setState(
        (prev) => ({
          queryText: '',
          results: [...prev.results, { id: Date.now(), question, columns, rows }],
        }),
        () => setTimeout(() => this.scrollToBottom(), 50),
      )
    } catch (error) {
      const errorMessage =
        error?.response?.data?.data?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong. Please try again.'
      this.setState({ error: errorMessage })
    } finally {
      this.setState({ isLoading: false })
    }
  }

  renderResults = () => {
    const { results } = this.state

    if (results.length === 0) {
      return (
        <div className='follow-on-modal-empty'>
          <Icon type='reply' />
          <span>Ask a follow-up question about this data</span>
        </div>
      )
    }

    return results.map((result) => (
      <div key={result.id} className='follow-on-modal-result'>
        <div className='follow-on-modal-result-question'>
          <Icon type='reply' />
          <span>{result.question}</span>
        </div>
        <div className='follow-on-modal-result-table'>
          <SimpleTable columns={result.columns} rows={result.rows} dataFormatting={this.props.dataFormatting} maxHeight={400} />
        </div>
      </div>
    ))
  }

  render() {
    const { queryText, isLoading, error } = this.state

    return (
      <Modal
        title='Follow-up Questions'
        titleIcon={<Icon type='reply' />}
        subtitle={this.props.queryResponse?.data?.data?.text}
        isVisible={this.props.isVisible}
        onClose={this.props.onClose}
        showFooter={false}
        width='700px'
        height='600px'
        enableBodyScroll={false}
        bodyClassName='follow-on-modal-body-override'
      >
        <div className='follow-on-modal-body'>
          <CustomScrollbars
            ref={(r) => (this.scrollbarsRef = r)}
            className='follow-on-modal-messages'
            autoHide={false}
            suppressScrollX
          >
            <div className='follow-on-modal-messages-inner'>
              {this.renderResults()}
            </div>
          </CustomScrollbars>
          <div className='follow-on-modal-input-area'>
            {error && <div className='follow-on-modal-error'>{error}</div>}
            <div className='follow-on-modal-input-row'>
              <Input
                value={queryText}
                onChange={this.handleTextChange}
                onKeyDown={this.handleKeyDown}
                placeholder='Ask a follow-up question...'
                disabled={isLoading}
                inputStyle={{ paddingLeft: '14px' }}
                autoFocus
              />
              <Button
                type='primary'
                size='small'
                onClick={this.handleSubmit}
                disabled={!queryText.trim() || isLoading}
              >
                {isLoading ? <Spinner /> : <Icon type='send' />}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    )
  }
}
