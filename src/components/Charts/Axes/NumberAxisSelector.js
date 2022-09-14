import React, { Fragment } from 'react'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { Popover } from 'react-tiny-popover'
import { SelectableList } from '../../SelectableList'
import { Button } from '../../Button'
import {
  axesDefaultProps,
  axesPropTypes,
  dataStructureChanged,
} from '../helpers'
import { CustomScrollbars } from '../../CustomScrollbars'

export default class NumberAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.currencySelectRef
    this.quantitySelectRef
    this.ratioSelectRef

    this.state = {
      ...this.getSelectorState(props),
      isOpen: false,
    }
  }

  static propTypes = axesPropTypes
  static defaultProps = axesDefaultProps

  componentDidUpdate = (prevProps) => {
    if (dataStructureChanged(this.props, prevProps)) {
      this.setState({
        ...this.getSelectorState(this.props),
      })
    }
  }

  openSelector = () => {
    this.setState({ isOpen: true })
  }

  closeSelector = () => {
    this.setState({ isOpen: false })
  }

  getSelectorState = (props) => {
    const { columns, numberColumnIndices } = props

    if (!columns || !numberColumnIndices) {
      return
    }

    const currencyItems = []
    const quantityItems = []
    const ratioItems = []

    columns.forEach((col, i) => {
      if (!col.is_visible || col.pivot) {
        return
      }

      const item = {
        content: col.title,
        checked: numberColumnIndices.includes(i),
        columnIndex: i,
      }

      if (col.type === 'DOLLAR_AMT') {
        currencyItems.push(item)
      } else if (col.type === 'QUANTITY') {
        quantityItems.push(item)
      } else if (col.type === 'RATIO' || col.type === 'PERCENT') {
        ratioItems.push(item)
      }
    })

    return {
      activeNumberType: _get(columns, `[${numberColumnIndices[0]}].type`),
      currencySelectorState: currencyItems,
      quantitySelectorState: quantityItems,
      ratioSelectorState: ratioItems,
    }
  }

  renderSelectorContent = (selectedColumn) => {
    const { currencySelectorState, quantitySelectorState, ratioSelectorState } =
      this.state

    return (
      <div
        id="chata-chart-popover"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="axis-selector-container">
          <CustomScrollbars autoHide={false}>
            {!!currencySelectorState.length && (
              <Fragment>
                <div className="number-selector-header">
                  {this.props.columns && this.props.legendColumn !== undefined
                    ? this.props.legendColumn.display_name
                    : 'Currency'}
                </div>
                <SelectableList
                  ref={(r) => (this.currencySelectRef = r)}
                  items={currencySelectorState}
                  onSelect={() => {
                    this.quantitySelectRef &&
                      this.quantitySelectRef.unselectAll()
                    this.ratioSelectRef && this.ratioSelectRef.unselectAll()
                  }}
                  onChange={(currencySelectorState) => {
                    const newQuantitySelectorState = quantitySelectorState.map(
                      (item) => {
                        return { ...item, checked: false }
                      }
                    )
                    const newRatioSelectorState = ratioSelectorState.map(
                      (item) => {
                        return { ...item, checked: false }
                      }
                    )

                    this.setState({
                      activeNumberType: 'DOLLAR_AMT',
                      currencySelectorState,
                      quantitySelectorState: newQuantitySelectorState,
                      ratioSelectorState: newRatioSelectorState,
                    })
                  }}
                />
              </Fragment>
            )}

            {!!quantitySelectorState.length && (
              <Fragment>
                <div className="number-selector-header">
                  {' '}
                  {this.props.columns && this.props.legendColumn !== undefined
                    ? this.props.legendColumn.display_name
                    : 'Quantity'}
                </div>
                <SelectableList
                  ref={(r) => (this.quantitySelectRef = r)}
                  items={quantitySelectorState}
                  onSelect={() => {
                    this.currencySelectRef &&
                      this.currencySelectRef.unselectAll()
                    this.ratioSelectRef && this.ratioSelectRef.unselectAll()
                  }}
                  onChange={(quantitySelectorState) => {
                    const newCurrencySelectorState = currencySelectorState.map(
                      (item) => {
                        return { ...item, checked: false }
                      }
                    )
                    const newRatioSelectorState = ratioSelectorState.map(
                      (item) => {
                        return { ...item, checked: false }
                      }
                    )
                    this.setState({
                      activeNumberType: 'QUANTITY',
                      quantitySelectorState,
                      currencySelectorState: newCurrencySelectorState,
                      ratioSelectorState: newRatioSelectorState,
                    })
                  }}
                />
              </Fragment>
            )}

            {!!ratioSelectorState.length && (
              <Fragment>
                <div className="number-selector-header">
                  {' '}
                  {this.props.columns && this.props.legendColumn !== undefined
                    ? this.props.legendColumn.display_name
                    : 'Ratio'}
                </div>
                <SelectableList
                  ref={(r) => (this.ratioSelectRef = r)}
                  items={ratioSelectorState}
                  onSelect={() => {
                    this.currencySelectRef &&
                      this.currencySelectRef.unselectAll()
                    this.quantitySelectRef &&
                      this.quantitySelectRef.unselectAll()
                  }}
                  onChange={(ratioSelectorState) => {
                    const newCurrencySelectorState = currencySelectorState.map(
                      (item) => {
                        return { ...item, checked: false }
                      }
                    )
                    const newQuantitySelectorState = quantitySelectorState.map(
                      (item) => {
                        return { ...item, checked: false }
                      }
                    )

                    this.setState({
                      activeNumberType: 'RATIO',
                      ratioSelectorState,
                      currencySelectorState: newCurrencySelectorState,
                      quantitySelectorState: newQuantitySelectorState,
                    })
                  }}
                />
              </Fragment>
            )}
          </CustomScrollbars>
        </div>
        <div className="axis-selector-apply-btn">
          <Button
            style={{ width: 'calc(100% - 10px)' }}
            type="primary"
            disabled={
              this.state.ratioSelectorState.every((item) => !item.checked) &&
              this.state.currencySelectorState.every((item) => !item.checked) &&
              this.state.quantitySelectorState.every((item) => !item.checked)
            }
            onClick={() => {
              let activeNumberTypeColumns = []
              if (this.state.activeNumberType === 'DOLLAR_AMT') {
                activeNumberTypeColumns = this.state.currencySelectorState
              } else if (this.state.activeNumberType === 'QUANTITY') {
                activeNumberTypeColumns = this.state.quantitySelectorState
              } else if (this.state.activeNumberType === 'RATIO') {
                activeNumberTypeColumns = this.state.ratioSelectorState
              }

              if (activeNumberTypeColumns.length) {
                this.closeSelector()
                const activeNumberTypeIndices = activeNumberTypeColumns
                  .filter((item) => item.checked)
                  .map((item) => item.columnIndex)

                this.props.changeNumberColumnIndices(activeNumberTypeIndices)
              }
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    )
  }

  render = () => {
    return (
      <Popover
        isOpen={this.state.isOpen}
        content={this.renderSelectorContent()}
        onClickOutside={this.closeSelector}
        positions={this.props.positions}
        align={this.props.align}
        ref={(r) => (this.popoverRef = r)}
      >
        <rect
          {...this.props.childProps}
          className="axis-label-border"
          data-test="axis-label-border"
          onClick={this.openSelector}
          fill="transparent"
          stroke="transparent"
          strokeWidth="1px"
          rx="4"
        />
      </Popover>
    )
  }
}
