import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { Checkbox } from '../Checkbox'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './SelectableList.scss'

export default class SelectableList extends React.Component {
  constructor(props) {
    super(props)

    this.KEY = uuid()

    this.state = {
      selected: [],
    }
  }

  static propTypes = {
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    items: PropTypes.arrayOf(PropTypes.shape({})),
  }

  static defaultProps = {
    onChange: () => {},
    onSelect: () => {},
    columns: [],
    items: [],
  }

  selectAll = () => {
    const selected = []
    this.props.items.forEach((item, i) => {
      if (!item.disabled) {
        selected.push(i)
      }
    })

    this.setState({ selected })
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

  handleShiftSelect = (index, item) => {
    if (this.state.selected.length) {
      const currentFirstSelected = Math.min(...this.state.selected)
      let newSelected = [index]
      if (index < currentFirstSelected) {
        newSelected = this.interpolateArray(index, currentFirstSelected)
      } else if (index > currentFirstSelected) {
        newSelected = this.interpolateArray(currentFirstSelected, index)
      }

      newSelected = newSelected.filter((i) => !this.props.items[i].disabled)

      const newSelectedItems = newSelected.map((selectedIndex) => {
        return {
          ...this.props.items[selectedIndex],
        }
      })
      this.props.onSelect(newSelected, newSelectedItems)
      this.setState({ selected: newSelected })
    } else {
      // Nothing currently selected, just select the clicked row
      this.props.onSelect([index], [item])
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

  checkAll = () => {
    const items = this.props.items.map((item) => ({
      ...item,
      checked: !item.disabled ? true : item.checked,
    }))
    this.props.onChange(items, items, true)
  }

  unCheckAll = () => {
    const items = this.props.items.map((item) => ({
      ...item,
      checked: !item.disabled ? false : item.checked,
    }))
    this.props.onChange(items, items, false)
  }

  handleMultipleCheck = (items) => {
    const { selected } = this.state
    const allItemsChecked = selected.every((index) => items[index].checked)

    let checked = true
    const newItems = this.props.items.map((item, i) => {
      if (allItemsChecked && selected.includes(i)) {
        checked = false
        return {
          ...item,
          checked: false,
        }
      } else if (selected.includes(i)) {
        return {
          ...item,
          checked: true,
        }
      }
      return item
    })

    this.props.onChange(newItems, selected, checked)
  }

  render = () => {
    const { items } = this.props

    return (
      <ErrorBoundary>
        <div className='react-autoql-selectable-list' data-test='selectable-list'>
          {!!this.props.columns?.length && (
            <div className='col-visibility-header'>
              {this.props.columns.map((col, index) => {
                if (index === this.props.columns.length - 1) {
                  const allItemsChecked =
                    items.find((col) => col.checked) && items.every((col) => col.checked || col.disabled)
                  return (
                    <div key={`list-header-${index}`}>
                      {col.name}
                      <Checkbox
                        checked={allItemsChecked}
                        disabled={items.every((col) => col.disabled)}
                        style={{ marginLeft: '10px' }}
                        onChange={(e) => {
                          if (allItemsChecked) {
                            this.unCheckAll()
                          } else {
                            this.checkAll()
                          }
                        }}
                      />
                    </div>
                  )
                }
                return <div key={`list-header-${index}`}>{col.name}</div>
              })}
            </div>
          )}
          {!!items?.length &&
            items.map((item, index) => {
              return (
                <div
                  key={item.key ?? `list-item-${index}-${this.KEY}`}
                  className={`react-autoql-list-item
                ${this.state.selected.includes(index) ? 'selected' : ''}
                ${item.disabled ? 'disabled' : ''}
                ${item.checked ? 'checked' : ''}`}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      this.handleShiftSelect(index, item)
                    } else if (e.ctrlKey || e.metaKey) {
                      this.handleCtrlSelect(index, item)
                    } else {
                      this.props.onSelect([index], [item])
                      this.setState({ selected: [index] })
                    }
                  }}
                >
                  <div className='react-autoql-selectable-list-item-content-container'>{item.content}</div>
                  <div>
                    <Checkbox
                      checked={item.checked}
                      disabled={item.disabled}
                      onChange={() => {
                        if (this.state.selected.length > 1 && this.state.selected.includes(index)) {
                          this.handleMultipleCheck(items)
                        } else {
                          const newItems = items.map((newItem, i) => {
                            if (index === i) {
                              return {
                                ...newItem,
                                checked: !newItem.checked,
                              }
                            }

                            return newItem
                          })

                          this.props.onChange(newItems, [item], !item.checked)
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
