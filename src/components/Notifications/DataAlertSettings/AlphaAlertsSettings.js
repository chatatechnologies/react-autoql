import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Input } from '../../Input'

export default class AlphaAlertsSettings extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.SAMPLE_CREATED_AT = new Date()
  }

  static propTypes = {
    billingUnitsInput: PropTypes.string,
    onBillingUnitsInputChange: PropTypes.func,
  }

  static defaultProps = {
    billingUnitsInput: '',
    onBillingUnitsInputChange: () => { },
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
        label='Subscription Units (optional)'
        value={this.props.billingUnitsInput || ''}
        onChange={this.onBillingUnitsChange}
        fullWidth={true}
      />
    )
  }

  render = () => {
    return (
      <div>
        <div className='compose-message-section'>
          <div className='form-section'>
            {this.renderDataAlertBillingUnitsInput()}
          </div>
        </div>
      </div>
    )
  }
}
