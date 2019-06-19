import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import { ReactTabulator, reactFormatter } from 'react-tabulator'

// import DateEditor from 'react-tabulator/lib/editors/DateEditor'
// import MultiValueFormatter from 'react-tabulator/lib/formatters/MultiValueFormatter'
// import MultiSelectEditor from 'react-tabulator/lib/editors/MultiSelectEditor'

import 'react-tabulator/lib/styles.css' // default theme
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css' // use Theme(s)

function SimpleButton(props: any) {
  const cellData = props.cell._cell.row.data
  return <button onClick={() => alert(cellData.name)}>Show</button>
}

const columns = [
  { title: 'Name', field: 'name', width: 150 },
  { title: 'Age', field: 'age', align: 'left', formatter: 'progress' },
  { title: 'Favourite Color', field: 'color' },
  { title: 'Date Of Birth', field: 'dob' },
  { title: 'Rating', field: 'rating', align: 'center', formatter: 'star' },
  {
    title: 'Passed?',
    field: 'passed',
    align: 'center',
    formatter: 'tickCross'
  },
  {
    title: 'Custom',
    field: 'custom',
    align: 'center',
    formatter: reactFormatter(<SimpleButton />)
  }
]

const data = [
  {
    id: 1,
    name: 'Oli Bob',
    age: '12',
    color: 'red',
    dob: '01/01/1980',
    rating: 5,
    passed: true,
    pets: ['cat', 'dog']
  },
  {
    id: 2,
    name: 'Mary May',
    age: '1',
    color: 'green',
    dob: '12/05/1989',
    rating: 4,
    passed: true,
    pets: ['cat']
  },
  {
    id: 3,
    name: 'Christine Lobowski',
    age: '42',
    color: 'green',
    dob: '10/05/1985',
    rating: 4,
    passed: false
  },
  {
    id: 4,
    name: 'Brendon Philips',
    age: '125',
    color: 'red',
    dob: '01/08/1980',
    rating: 4.5,
    passed: true
  },
  {
    id: 5,
    name: 'Margret Marmajuke',
    age: '16',
    color: 'yellow',
    dob: '07/01/1999',
    rating: 4,
    passed: false
  },
  {
    id: 6,
    name: 'Van Ng',
    age: '37',
    color: 'green',
    dob: '06/10/1982',
    rating: 4,
    passed: true,
    pets: ['dog', 'fish']
  },
  {
    id: 7,
    name: 'Duc Ng',
    age: '37',
    color: 'yellow',
    dob: '10/10/1982',
    rating: 4,
    passed: true,
    pets: ['dog']
  }
]

export default class ChataTable extends React.Component {
  ref = null

  static propTypes = {
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    onRowDblClick: PropTypes.func,
    data: PropTypes.arrayOf(PropTypes.array).isRequired
  }

  static defaultProps = {
    onRowDblClick: () => {}
  }

  state = {}

  rowClick = (e, row) => {
    e.preventDefault()
    e.stopPropagation()
    this.props.onRowDblClick(row, this.props.columns)
  }

  render = () => {
    const options = {
      layout: 'fitDataFill',
      textSize: '9px'
    }
    return (
      <div className="chata-table-container">
        <ReactTabulator
          ref={ref => (this.ref = ref)}
          columns={this.props.columns}
          data={this.props.data}
          // rowClick={this.rowClick}
          rowDblClick={this.rowClick}
          options={options}
          data-custom-attr="test-custom-attribute"
          className="chata-table"
          progressiveRender={true}
          progressiveRenderSize={5}
          progressiveRenderMargin={100}
          height="100%"
        />
      </div>
    )
  }
}
