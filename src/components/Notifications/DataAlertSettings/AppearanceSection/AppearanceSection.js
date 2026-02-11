import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { withTheme } from '../../../../theme'
import { Input } from '../../../Input'
import { Select } from '../../../Select'
import NotificationItemWithoutData from '../../NotificationItem/NotificationItemWithoutData'

import './AppearanceSection.scss'

class AppearanceSection extends React.Component {
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

    descriptionInput: PropTypes.string,
    selectedCategory: PropTypes.string,
    onDescriptionInputChange: PropTypes.func,
    onCategorySelectChange: PropTypes.func,
    categories: PropTypes.array,
    enableAlphaAlertSettings: PropTypes.bool,
    isCompositeAlert: PropTypes.bool,
    isPreviewMode: PropTypes.bool,
  }

  static defaultProps = {
    titleInput: '',
    messageInput: '',
    showConditionStatement: true,
    onTitleInputChange: () => {},
    onMessageInputChange: () => {},

    descriptionInput: '',
    selectedCategory: '',
    onDescriptionInputChange: () => {},
    onCategorySelectChange: () => {},
    categories: [],
    enableAlphaAlertSettings: false,
    isCompositeAlert: false,
    isPreviewMode: false,
  }

  renderDataAlertDescriptionInput = () => {
    return (
      <Input
        className='react-autoql-notification-description-input'
        placeholder='eg. "Notify when we&apos;ve spent 80% of our Marketing budget for the month"'
        area
        maxLength='200'
        fullWidth={true}
        label='Alert Description (optional)'
        value={this.props.descriptionInput || ''}
        onChange={this.props.onDescriptionInputChange}
      />
    )
  }

  renderDataAlertCategorySelect = () => {
    const options =
      this.props?.categories?.length > 0
        ? this.props?.categories?.map((label) => {
          return {
            value: label.id,
            label: label.name,
          }
        })
        : [
          {
            value: '-1',
            label: 'No Categories Available',
            disabled: true,
          },
        ]
    return (
      <Select
        label='Alert Category (optional)'
        placeholder='Select a category'
        fullWidth={true}
        options={options}
        value={this.props.selectedCategory || ''}
        onChange={this.props.onCategorySelectChange}
      />
    )
  }

  focusTitleInput = () => {
    this.titleInputRef?.focus()
  }

  renderDataAlertNameInput = () => {
    return (
      <Input
        ref={(r) => (this.titleInputRef = r)}
        className='react-autoql-notification-display-name-input'
        placeholder='eg. "Budget alert!"'
        icon='title'
        maxLength='75'
        fullWidth={true}
        label='Alert Name'
        value={this.props.titleInput}
        onChange={this.props.onTitleInputChange}
      />
    )
  }

  renderDataAlertMessageInput = () => {
    return (
      <Input
        className='react-autoql-notification-message-input'
        placeholder='eg. "Marketing budget is running out!"'
        area
        maxLength='200'
        fullWidth={true}
        label='Notification Message (optional)'
        value={this.props.messageInput}
        onChange={this.props.onMessageInputChange}
      />
    )
  }

  renderDataAlertPreview = () => {
    return (
      <div className='data-alert-preview'>
        <NotificationItemWithoutData
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
          isBuildingCustomFilteredAlert={this.props.isCompositeAlert}
        />
      </div>
    )
  }

  render = () => {
    const conditionStatement = this.props.conditionStatement ?? 'the Data Alert is triggered'

    return (
      <div>
        {this.props.showConditionStatement ? (
          <div className='compose-message-section-condition-statement'>
            <span>
              If {conditionStatement}, you'll receive a notification with this <strong>title and message:</strong>
            </span>
          </div>
        ) : null}
        {this.props?.enableAlphaAlertSettings ? (
          <div className='alert-information-container'>
            <div className='alert-information-item'>{this.renderDataAlertNameInput()}</div>
            <div className='alert-information-item'>{this.renderDataAlertCategorySelect()}</div>
            <div className='alert-information-item'>{this.renderDataAlertMessageInput()}</div>
            <div className='alert-information-item'>{this.renderDataAlertDescriptionInput()}</div>
            <div className='alert-information-item full-width'>
              <div className='react-autoql-input-label'>Notification Preview</div>
              {this.renderDataAlertPreview()}
            </div>
          </div>
        ) : (
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
        )}
      </div>
    )
  }
}

export default withTheme(AppearanceSection)
