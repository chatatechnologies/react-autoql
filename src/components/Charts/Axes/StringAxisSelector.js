import React from 'react'
import { Popover } from 'react-tiny-popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { v4 as uuid } from 'uuid'
import { isColumnDateType } from '../../QueryOutput/columnHelpers'

export default class StringAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
  }

  getDateColumnIndices = () => {
    const dateColumnIndices = []
    this.props.columns.forEach((col, i) => {
      if (isColumnDateType(col) && col.is_visible) {
        dateColumnIndices.push(i)
      }
    })
    return dateColumnIndices
  }

  renderSelectorContent = ({ position, childRect, popoverRect }) => {
    if (this.props.hidden) {
      return null
    }

    let maxHeight = 300
    const minHeight = 35
    const padding = 50

    const chartHeight = this.props.chartContainerRef?.clientHeight
    if (chartHeight && chartHeight > minHeight + padding) {
      maxHeight = chartHeight - padding
    } else if (chartHeight && chartHeight < minHeight + padding) {
      maxHeight = minHeight
    }

    if (maxHeight > Window.innerHeight) {
      maxHeight = Window.innerHeight
    }

    let columnIndices = this.props.stringColumnIndices
    if (this.props.dateColumnsOnly) {
      columnIndices = this.getDateColumnIndices()
    }

    return (
      <div className='string-axis-selector-popover-content'>
        <CustomScrollbars autoHide={false} autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight}>
          <div
            className='axis-selector-container'
            id='string-column-selector-content'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <ul className='axis-selector-content'>
              {columnIndices.map((colIndex, i) => {
                return (
                  <li
                    className={`string-select-list-item ${colIndex === this.props.stringColumnIndex ? 'active' : ''}`}
                    key={`string-column-select-${i}`}
                    onClick={() => {
                      this.props.closeSelector()
                      this.props.changeStringColumnIndex(colIndex)
                    }}
                  >
                    {this.props.columns?.[colIndex]?.display_name}
                  </li>
                )
              })}
            </ul>
          </div>
        </CustomScrollbars>
      </div>
    )
  }

  render = () => {
    if (!this.props.children) {
      return null
    }

    return (
      <Popover
        id={`string-axis-selector-${this.COMPONENT_KEY}`}
        ref={this.props.axisSelectorRef}
        isOpen={this.props.isOpen}
        content={this.renderSelectorContent}
        onClickOutside={this.props.closeSelector}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
        reposition={true}
        padding={10}
      >
        {this.props.children}
      </Popover>
    )
  }
}
