import React from 'react'
import PropTypes from 'prop-types'

import './TablePlaceholder.scss'

export default class TablePlaceholder extends React.Component {
  constructor(props) {
    super(props)
  }

  static propTypes = {
    className: PropTypes.string,
    rows: PropTypes.number,
    columns: PropTypes.number,
  }

  static defaultProps = {
    className: undefined,
    rows: 3,
    columns: 3,
  }

  renderPlaceholderCell = () => {
    return <div className='react-autoql-placeholder-loader' style={{}} />
  }

  renderPlaceholderRow = () => {
    const placeholderCells = new Array(this.props.columns)
    placeholderCells.fill(this.renderPlaceholderCell())

    return <div className='react-autoql-table-placeholder-row'>{placeholderCells}</div>
  }

  renderPlaceholderRows = () => {
    const placeholderRows = new Array(this.props.rows)
    placeholderRows.fill(this.renderPlaceholderRow())
    return placeholderRows
  }

  render = () => {
    return (
      <div className={`react-autoql-placeholder-table-container ${this.props.className ?? ''}`}>
        <div className='react-autoql-table-placeholder-row react-autoql-table-placeholder-header'>
          <div className='react-autoql-placeholder-loader' style={{}} />
          <div className='react-autoql-placeholder-loader' style={{}} />
          <div className='react-autoql-placeholder-loader' style={{}} />
        </div>
        {this.renderPlaceholderRows()}
      </div>
    )
  }
}
