import React from 'react'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { isColumnNumberType } from 'autoql-fe-utils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

export default class SingleNumberAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
  }

  renderSelectorContent = ({ position, childRect, popoverRect }) => {
    const { hidden, scale, columns } = this.props
    if (hidden || !scale || !columns) {
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

    const filteredColumns = columns.filter((col) => col.is_visible)

    return (
      <div
        className={isMobile ? 'mobile-string-axis-selector-popover-content' : 'string-axis-selector-popover-content'}
      >
        <CustomScrollbars autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight}>
          <div
            className='axis-selector-container'
            id='string-column-selector-content'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <ul className='axis-selector-content'>
              {filteredColumns
                .filter((col) => isColumnNumberType(col))
                .map((col) => {
                  const colIndex = columns.find((origColumn) => origColumn.id === col.id)?.index

                  return (
                    <li
                      className={`string-select-list-item ${col.id === scale.column?.id ? 'active' : ''}`}
                      key={`string-column-select-${col.id}`}
                      onClick={() => {
                        this.props.closeSelector()
                        scale.changeColumnIndices([colIndex])
                      }}
                    >
                      {col.display_name}
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
