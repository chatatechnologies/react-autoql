import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'

import { AGG_TYPES, ColumnTypes, getHiddenColumns, getSelectableColumns } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { CustomScrollbars } from '../CustomScrollbars'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './AddColumnBtn.scss'

export class AddColumnBtnWithoutRef extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
      isAddColumnMenuOpen: false,
      aggPopoverActiveID: undefined,
    }
  }

  static propTypes = {
    queryResponse: PropTypes.shape({}),
    allowCustom: PropTypes.bool,
    onAddColumnClick: PropTypes.func,
    onCustomClick: PropTypes.func,
    tooltipID: PropTypes.string,
    disableAddCustomColumnOption: PropTypes.bool,
  }

  static defaultProps = {
    queryResponse: undefined,
    allowCustom: true,
    onAddColumnClick: () => { },
    onCustomClick: () => { },
    tooltipID: undefined,
    disableAddCustomColumnOption: false,
  }

  onAddColumnClick = (column, aggType, isHiddenColumn) => {
    this.props.onAddColumnClick(column, aggType, isHiddenColumn)
    this.setState({ isAddColumnMenuOpen: false, aggPopoverActiveID: undefined })
  }

  onCustomClick = () => {
    this.setState({ isAddColumnMenuOpen: false, aggPopoverActiveID: undefined })
    this.props.onCustomClick()
  }

  renderAggMenu = (column) => {
    return (
      <CustomScrollbars autoHide={false}>
        <div className='more-options-menu react-autoql-add-column-menu'>
          <ul className='context-menu-list'>
            <div className='react-autoql-input-label'>Aggregation</div>
            {Object.keys(AGG_TYPES)
              .filter((aggType) => !!AGG_TYPES[aggType]?.sqlFn)
              .map((aggType, i) => {
                let icon = AGG_TYPES[aggType].symbol
                if (AGG_TYPES[aggType].icon) {
                  icon = <Icon type={AGG_TYPES[aggType].icon} />
                }

                return (
                  <li
                    key={`agg-menu-item-${i}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      this.onAddColumnClick(column, AGG_TYPES[aggType].sqlFn)
                    }}
                  >
                    <div className='react-autoql-add-column-menu-item'>
                      <span className='agg-select-list-symbol'>{icon}</span>
                      <span>{AGG_TYPES[aggType].displayName}</span>
                    </div>
                  </li>
                )
              })}
          </ul>
        </div>
      </CustomScrollbars>
    )
  }

  renderAddColumnMenu = (availableSelectColumns, availableHiddenColumns) => {
    if (!availableHiddenColumns && !availableHiddenColumns) {
      return null
    }

    return (
      <CustomScrollbars autoHide={false}>
        <div className='more-options-menu react-autoql-add-column-menu'>
          <ul className='context-menu-list'>
            <div className='react-autoql-input-label'>Add a Column</div>
            {availableSelectColumns?.map((column, i) => {
              const columnIsNumerical = [
                ColumnTypes.DOLLAR_AMT,
                ColumnTypes.QUANTITY,
                ColumnTypes.RATIO,
                ColumnTypes.PERCENT,
              ].includes(column.column_type)

              return (
                <Popover
                  key={`agg-select-menu-${i}`}
                  isOpen={this.state.aggPopoverActiveID === `column-select-menu-item-${i}`}
                  onClickOutside={() => this.setState({ aggPopoverActiveID: undefined })}
                  content={() => this.renderAggMenu(column)}
                  parentElement={this.props.popoverParentElement}
                  boundaryElement={this.props.popoverParentElement}
                  positions={this.props.popoverPositions ?? ['right', 'left']}
                  align='start'
                  padding={0}
                >
                  <li
                    key={`column-select-menu-item-${i}`}
                    onClick={() => (columnIsNumerical ? undefined : this.onAddColumnClick(column))}
                    onMouseOver={(e) => {
                      this.setState({
                        aggPopoverActiveID: columnIsNumerical ? `column-select-menu-item-${i}` : undefined,
                      })
                    }}
                  >
                    <div className='react-autoql-add-column-menu-item'>
                      <Icon type='plus' />
                      <span>{column.display_name}</span>
                    </div>
                    <div className='react-autoql-menu-expand-arrow'>
                      {columnIsNumerical ? <Icon type='caret-right' /> : null}
                    </div>
                  </li>
                </Popover>
              )
            })}
            {availableHiddenColumns?.map((column, i) => {
              const isHiddenColumn = true
              return (
                <li
                  key={`column-select-menu-item-hidden-column-${i}`}
                  onClick={() => this.onAddColumnClick(column, undefined, isHiddenColumn)}
                >
                  <div className='react-autoql-add-column-menu-item'>
                    <Icon type='plus' />
                    <span>{column.display_name}</span>
                  </div>
                </li>
              )
            })}
            {this.enableCustomOption() && (
              <>
                <hr />
                <li onClick={this.onCustomClick}>Custom...</li>
              </>
            )}
          </ul>
        </div>
      </CustomScrollbars>
    )
  }

  enableCustomOption = () => {
    if (this.props.disableAddCustomColumnOption) {
      return false
    }

    let selectableColumnsForCustom
    try {
      selectableColumnsForCustom = getSelectableColumns(this.props.queryResponse?.data?.data?.columns)
    } catch {
      selectableColumnsForCustom = []
    }

    return this.props.allowCustom && !!selectableColumnsForCustom?.length
  }

  render = () => {
    const availableSelectColumns = this.props.queryResponse?.data?.data?.available_selects
    const availableHiddenColumns = getHiddenColumns(this.props.queryResponse?.data?.data?.columns)

    if (!availableSelectColumns?.length && !availableHiddenColumns?.length && !this.enableCustomOption()) {
      return null
    }

    return (
      <ErrorBoundary>
        <Popover
          key={`add-column-button-${this.COMPONENT_KEY}`}
          isOpen={this.state.isAddColumnMenuOpen}
          onClickOutside={(e) => {
            if (!this.state.aggPopoverActiveID) {
              this.setState({ isAddColumnMenuOpen: false })
            }
          }}
          content={() => this.renderAddColumnMenu(availableSelectColumns, availableHiddenColumns)}
          parentElement={this.props.popoverParentElement}
          boundaryElement={this.props.popoverParentElement}
          positions={this.props.popoverPositions ?? ['bottom', 'left', 'right', 'top']}
          stopClickPropagation={false}
          align='end'
        >
          <div
            onClick={() => this.setState({ isAddColumnMenuOpen: true })}
            className={`react-autoql-table-add-column-btn${this.state.isAddColumnMenuOpen ? ' active' : ''}`}
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
