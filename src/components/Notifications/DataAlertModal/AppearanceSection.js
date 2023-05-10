import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Input } from '../../Input'
import NotificationItem from '../NotificationItem/NotificationItem'

export default class AppearanceSection extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.SAMPLE_CREATED_AT = new Date()
  }

  static propTypes = {
    titleInput: PropTypes.string,
    messageInput: PropTypes.string,
    onTitleInputChange: PropTypes.func,
    onMessageInputChange: PropTypes.func,
    showConditionStatement: PropTypes.bool,
  }

  static defaultProps = {
    titleInput: '',
    messageInput: '',
    showConditionStatement: true,
    queryText: '',
    onTitleInputChange: () => {},
    onMessageInputChange: () => {},
  }

  focusTitleInput = () => {
    this.titleInputRef?.focus()
  }

  getConditionStatement = () => {
    if (this.props.conditionStatement) {
      return this.props.conditionStatement
    }

    const query = this.props.queryText ? `"${this.props.queryText}"` : 'this query'
    return `new data is detected for ${query}`
  }

  renderDataAlertNameInput = () => {
    return (
      <Input
        ref={(r) => (this.titleInputRef = r)}
        className='react-autoql-notification-display-name-input'
        placeholder='eg. "Budget alert!"'
        icon='title'
        maxLength='50'
        label='Title'
        value={this.props.titleInput}
        onChange={this.props.onTitleInputChange}
      />
    )
  }

  renderDataAlertMessageInput = () => {
    return (
      <Input
        className='react-autoql-notification-message-input'
        placeholder='eg. "You have spent 80% of your budget for the month."'
        area
        maxLength='200'
        label='Message (optional)'
        value={this.props.messageInput}
        onChange={this.props.onMessageInputChange}
      />
    )
  }

  renderDataAlertPreview = () => {
    return (
      <div className='data-alert-preview'>
        <NotificationItem
          notification={{
            id: `preview-${this.COMPONENT_KEY}`,
            title: this.props.titleInput || (
              <span>
                <em>{'[Title]'}</em>
              </span>
            ),
            message: this.props.messageInput,
            created_at: this.SAMPLE_CREATED_AT.toISOString(),
            state: 'UNACKNOWLEDGED',
            expanded: false,
          }}
        />
      </div>
    )
  }

  render = () => {
    const conditionStatement = this.props.showConditionStatement ? this.getConditionStatement() : null

    return (
      <div>
        {conditionStatement ? (
          <div className='compose-message-section-condition-statement'>
            <span>
              If {conditionStatement}, you'll receive a notification with this <strong>title and message:</strong>
            </span>
          </div>
        ) : null}
        <div className='compose-message-section'>
          <div className='form-section'>
            {this.renderDataAlertNameInput()}
            {this.renderDataAlertMessageInput()}
          </div>
          <div className='preview-section'>
            <div className='react-autoql-input-label'>Preview</div>
            {this.renderDataAlertPreview()}
          </div>
        </div>
      </div>
    )
  }
}
