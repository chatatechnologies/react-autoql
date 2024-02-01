import React from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './AddColumnBtn.scss'
import { ColumnTypes } from 'autoql-fe-utils'

export class AddColumnBtnWithoutRef extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      isAddColumnMenuOpen: false,
    }
  }

  static propTypes = {
    queryResponse: PropTypes.shape({}),
    onAddColumnClick: PropTypes.func,
    queryFn: PropTypes.func,
  }

  static defaultProps = {
    queryResponse: undefined,
    onAddColumnClick: () => {},
    queryFn: undefined,
  }

  onAddColumnClick = (column) => {
    this.props.onAddColumnClick(column)
    this.setState({ isAddColumnMenuOpen: false })
  }

  renderAddColumnMenu = (availableColumns) => {
    return (
      <div className='more-options-menu react-autoql-add-column-menu'>
        <ul className='context-menu-list'>
          <div className='react-autoql-input-label'>Available Columns</div>
          {availableColumns.map((column, i) => {
            return (
              <li key={i} onClick={() => this.onAddColumnClick(column)}>
                <Icon type='plus' />
                <span>{column.display_name}</span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  render = () => {
    const availableColumns = this.props.queryResponse?.data?.data?.available_selects

    if (!availableColumns?.length) {
      return null
    }

    return (
      <ErrorBoundary>
        <Popover
          key={`add-column-button-${this.COMPONENT_KEY}`}
          isOpen={this.state.isAddColumnMenuOpen}
          onClickOutside={() => this.setState({ isAddColumnMenuOpen: false })}
          content={() => this.renderAddColumnMenu(availableColumns)}
          parentElement={this.props.popoverParentElement}
          boundaryElement={this.props.popoverParentElement}
          positions={this.props.popoverPositions ?? ['bottom', 'left', 'right', 'top']}
          align='end'
        >
          <div
            onClick={() => this.setState({ isAddColumnMenuOpen: true })}
            className='react-autoql-table-add-column-btn'
            data-test='react-autoql-table-add-column-btn'
            data-tooltip-content='Add Column'
            data-tooltip-id={this.props.tooltipID}
            size='small'
          >
            <Icon type='plus' />
          </div>
        </Popover>
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <AddColumnBtnWithoutRef innerRef={ref} {...props} />)
