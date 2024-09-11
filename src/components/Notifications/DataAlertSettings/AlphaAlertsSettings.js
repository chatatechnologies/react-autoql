import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Input } from '../../Input'
import { Select } from '../../Select'

export default class AlphaAlertsSettings extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.SAMPLE_CREATED_AT = new Date()
  }

  static propTypes = {
    billingUnitsInput: PropTypes.string,
    descriptionInput: PropTypes.string,
    selectedCategory: PropTypes.string,
    onBillingUnitsInputChange: PropTypes.func,
    onDescriptionInputChange: PropTypes.func,
    onCategorySelectChange: PropTypes.func,
    categories: PropTypes.array,
  }

  static defaultProps = {
    billingUnitsInput: '',
    descriptionInput: '',
    selectedCategory: '',
    onBillingUnitsInputChange: () => { },
    onDescriptionInputChange: () => { },
    onCategorySelectChange: () => { },
    categories: [],
  }

  onBillingUnitsChange = (e) => {
    const value = e.target.value
    if (((/^\d+$/.test(value)) && Number.parseInt(value) > -1) || value === '') {
      this.props.onBillingUnitsInputChange(value)
    }
  }

  renderDataAlertBillingUnitsInput = () => {
    return (
      <Input
        ref={(r) => (this.billingUnitsRef = r)}
        className='react-autoql-notification-billing-units-input'
        placeholder='eg. 10'
        number='number'
        maxLength='75'
        label='Billing Units (optional)'
        value={this.props.billingUnitsInput || ''}
        onChange={this.onBillingUnitsChange}
      />
    )
  }

  renderDataAlertDescriptionInput = () => {
    return (
      <Input
        className='react-autoql-notification-description-input'
        placeholder='eg. "Notify when we&apos;ve spent 80% of our Marketing budget for the month"'
        area
        maxLength='200'
        label='Description (optional)'
        value={this.props.descriptionInput || ''}
        onChange={this.props.onDescriptionInputChange}
      />
    )
  }

  renderDataAlertLabelsSelect = () => {
    const options = this.props?.categories?.length > 0 ? this.props?.categories?.map((label) => {
      return {
        value: label.id,
        label: label.name,
      }
    }) :
      [{
        value: '-1',
        label: 'No Categories Available',
        disabled: true
      }]
    return (
      <Select
        label='Category (optional)'
        placeholder='Select a category'
        fullWidth={true}
        options={options}
        value={this.props.selectedCategory || ''}
        onChange={this.props.onCategorySelectChange}
      />
    )
  }

  render = () => {
    return (
      <div>
        <div className='compose-message-section'>
          <div className='form-section'>
            {this.renderDataAlertLabelsSelect()}
            {this.renderDataAlertDescriptionInput()}
            {this.renderDataAlertBillingUnitsInput()}
          </div>
        </div>
      </div>
    )
  }
}
