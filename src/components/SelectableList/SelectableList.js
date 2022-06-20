import React from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import _get from 'lodash.get'
import { v4 as uuid } from 'uuid'

import { Checkbox } from '../Checkbox'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { themeConfigType } from '../../props/types'
import { getThemeConfig, themeConfigDefault } from '../../props/defaults'

import './SelectableList.scss'

export default class SelectableList extends React.Component {
  static propTypes = {
    themeConfig: themeConfigType,
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    items: PropTypes.arrayOf(PropTypes.shape({})),
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    onChange: () => {},
    onSelect: () => {},
    columns: [],
    items: [],
  }

  state = {
    selected: [],
  }

  unselectAll = () => {
    this.setState({ selected: [] })
  }

  interpolateArray = (num1, num2) => {
    const lowEnd = Math.min(num1, num2)
    const highEnd = Math.max(num1, num2)
    const array = []
    for (let i = lowEnd; i <= highEnd; i++) {
      array.push(i)
    }
    return array
  }

  handleShiftSelect = (index) => {
    if (this.state.selected.length) {
      const currentFirstSelected = Math.min(...this.state.selected)
      let newSelected = [index]
      if (index < currentFirstSelected) {
        newSelected = this.interpolateArray(index, currentFirstSelected)
      } else if (index > currentFirstSelected) {
        newSelected = this.interpolateArray(currentFirstSelected, index)
      }

      this.props.onSelect(newSelected)
      this.setState({ selected: newSelected })
    } else {
      // Nothing currently selected, just select the clicked row
      this.props.onSelect([index])
      this.setState({ selected: [index] })
    }
  }

  handleCtrlSelect = (index) => {
    let newSelected = []
    if (this.state.selected.includes(index)) {
      newSelected = this.state.selected.filter((i) => i !== index)
    } else {
      newSelected = [...this.state.selected, index]
    }
    this.props.onSelect(newSelected)
    this.setState({ selected: newSelected })
  }

  handleMultipleCheck = (items) => {
    const allItemsChecked = this.state.selected.every(
      (index) => items[index].checked
    )

    if (allItemsChecked) {
      this.state.selected.forEach((index) => {
        items[index].checked = false
      })
    } else {
      this.state.selected.forEach((index) => {
        items[index].checked = true
      })
    }

    this.props.onChange(items)
  }

  render = () => {
    const items = _cloneDeep(this.props.items)

    return (
      <ErrorBoundary>
        <div
          className="react-autoql-selectable-list"
          data-test="selectable-list"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {!!_get(this.props.columns, 'length') && (
            <div className="col-visibility-header">
              {this.props.columns.map((col, index) => {
                if (index === this.props.columns.length - 1) {
                  const allItemsChecked = items.every((col) => col.checked)
                  return (
                    <div key={`list-header-${uuid()}`}>
                      {col.name}
                      <Checkbox
                        checked={allItemsChecked}
                        style={{ marginLeft: '10px' }}
                        onChange={() => {
                          if (allItemsChecked) {
                            items.forEach((item) => {
                              item.checked = false
                            })
                          } else {
                            items.forEach((item) => {
                              item.checked = true
                            })
                          }
                          this.props.onChange(items)
                        }}
                      />
                    </div>
                  )
                }
                return <div key={`list-header-${uuid()}`}>{col.name}</div>
              })}
            </div>
          )}
          {items.map((item, index) => {
            return (
              <div
                key={`list-item-${uuid()}`}
                className={`react-autoql-list-item${
                  this.state.selected.includes(index) ? ' selected' : ''
                }`}
                onClick={(e) => {
                  if (e.shiftKey) {
                    this.handleShiftSelect(index)
                  } else if (e.ctrlKey || e.metaKey) {
                    this.handleCtrlSelect(index)
                  } else {
                    this.props.onSelect([index])
                    this.setState({ selected: [index] })
                  }
                }}
              >
                <div>{item.content} </div>
                <div>
                  <Checkbox
                    checked={item.checked}
                    onChange={() => {
                      if (
                        this.state.selected.length > 1 &&
                        this.state.selected.includes(index)
                      ) {
                        this.handleMultipleCheck(items)
                      } else {
                        item.checked = !item.checked
                        this.props.onChange(items)
                      }
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </ErrorBoundary>
    )
  }
}
