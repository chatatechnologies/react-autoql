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

  renderPlaceholderCell = (key) => {
    return <div key={key} className='react-autoql-placeholder-loader' />
  }

  renderPlaceholderRow = (key) => {
    const placeholderCells = new Array(this.props.columns).fill(0).map((cell, i) => this.renderPlaceholderCell(i))

    return (
      <div key={key} className='react-autoql-table-placeholder-row'>
        {placeholderCells}
      </div>
    )
  }

  renderPlaceholderRows = () => {
    const placeholderRows = new Array(this.props.rows).fill(0).map((row, i) => this.renderPlaceholderRow(i))

    return placeholderRows
  }

  render = () => {
    return (
      <div className={`react-autoql-placeholder-table-container ${this.props.className ?? ''}`}>
        <div className='react-autoql-table-placeholder-row react-autoql-table-placeholder-header'>
          <div className='react-autoql-placeholder-loader' />
          <div className='react-autoql-placeholder-loader' />
          <div className='react-autoql-placeholder-loader' />
        </div>
        {this.renderPlaceholderRows()}
      </div>
    )
  }
}
