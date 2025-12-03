import axios from 'axios'

const client = axios.create()

const getValueByKey = (objectItem, field) => {
  const fieldSegments = field.split('.')
  return fieldSegments.reduce((previousValue, currentFieldSegment) => previousValue?.[currentFieldSegment], objectItem)
}

class CellComponent {
  constructor(data, element, row, column) {
    this.data = data
    this.element = element
    this.row = row
    this.column = column
  }

  getData() {
    return this.data
  }

  setData(data) {
    this.data = data
  }

  getValue() {
    return getValueByKey(this.data, this.column.getField())
  }

  getElement() {
    return this.element
  }

  getRow() {
    return this.row
  }

  getColumn() {
    return this.column
  }

  addClickEventListener(callback) {
    this.element.addEventListener('click', (e) => {
      callback(e, this)
    })
  }
}

class ColumnComponent {
  constructor(definition) {
    this.definition = definition
  }

  getField() {
    return this.definition.field
  }

  getTitle() {
    return this.definition.title
  }

  getFormatter() {
    return this.definition.formatter
  }

  getElement() {
    // Provide a minimal DOM-like object with offsetWidth for table layout code
    if (!this._element) {
      this._element = { offsetWidth: Number(this.definition?.width) || 100 }
    }
    return this._element
  }

  getDefinition() {
    return this.definition
  }
}

class RowComponent {
  constructor(data, element, tabulator) {
    this.data = data
    this.element = element
    this.tabulator = tabulator
    this.cells = []
  }

  getData() {
    return this.data
  }

  setData(data) {
    this.data = data
  }

  getCells() {
    return this.cells
  }

  update(newPartialData) {
    const newData = { ...this.data, ...newPartialData }
    this.setData(newData)
    const cells = this.getCells()
    cells.forEach((cell) => {
      cell.setData(newData)
      this.tabulator._buildTableCell(newData, cell.column, cell)
    })
  }
}

class Tabulator {
  constructor(element, options) {
    this.options = options
    this.element = null
    this.data = []
    this.rows = []
    this.columns = this._prepareColumns(options.columns)
    this.eventSubscription = {
      cellClick: null,
      tableBuilt: null,
    }

    if (this.initializeElement(element)) {
      setTimeout(() => {
        this._create()
      })
    }
  }

  initializeElement(element) {
    if (typeof HTMLElement !== 'undefined' && element instanceof HTMLElement) {
      this.element = element
      return true
    } else if (typeof element === 'string') {
      this.element = document.querySelector(element)

      if (this.element) {
        return true
      } else {
        // eslint-disable-next-line no-console
        console.error('Tabulator Creation Error - no element found matching selector: ', element)
        return false
      }
    } else {
      // eslint-disable-next-line no-console
      console.error('Tabulator Creation Error - Invalid element provided:', element)
      return false
    }
  }

  // eslint-disable-next-line no-unused-vars
  on(eventName, callback) {
    if (Object.keys(this.eventSubscription).includes(eventName)) {
      this.eventSubscription[eventName] = callback
    }
  }

  // eslint-disable-next-line no-unused-vars
  off(eventName, callback) {}

  getRow(rowId) {
    return this.rows.find((row) => row.getData()[this.options.index] === rowId)
  }

  updateRow(rowId, newData) {
    const row = this.rows.find((row) => row.getData()[this.options.index] === rowId)
    if (row) {
      row.setData(newData)
      const cells = row.getCells()
      let cellIndex = 0
      this.columns.forEach((column) => {
        if (column.definition.visible === undefined || column.definition.visible === true) {
          cells[cellIndex].setData(newData)
          this._buildTableCell(newData, column, cells[cellIndex])
          cellIndex++
        }
      })
    }
  }

  setData(param = null) {
    if (param === null || typeof param === 'string') {
      this._create(param)
    }
  }

  replaceData(newData) {
    this.data = newData
    this._buildElement()
  }

  redraw() {}

  setColumns(newColumns) {
    this.columns = this._prepareColumns(newColumns)
    this._buildElement()
  }

  _prepareColumns(columns) {
    return columns.map((c) => new ColumnComponent(c))
  }

  _fetchData(url) {
    return client.get(url)
  }

  //create table
  _create(ajaxURL = null) {
    this.data = []
    this._buildElement()
    if (this.options.ajaxURL || ajaxURL) {
      const url = ajaxURL ? ajaxURL : this.options.ajaxURL
      this._fetchData(url).then(({ data }) => {
        this.data = data
        this._buildElement()
      })
    }
  }

  _buildElement() {
    this.element.innerHTML = ''
    this.rows = []
    if (!document) {
      return
    }
    const table = document.createElement('table')
    const thead = document.createElement('thead')
    const tbody = document.createElement('tbody')

    thead.setAttribute('role', 'row')

    this.columns.forEach((column) => {
      if (column.definition.visible === false) {
        return
      }
      const th = document.createElement('th')
      th.innerHTML = column.getTitle()
      thead.appendChild(th)
    })

    if (this.data.length) {
      this.rows = this.data.map((dataItem) => {
        const tr = document.createElement('tr')
        tr.setAttribute('role', 'row')
        const rowComponent = new RowComponent(dataItem, tr, this)

        this.columns.forEach((column) => {
          if (column.definition.visible === false) {
            return
          }
          const td = document.createElement('td')
          td.setAttribute('role', 'gridcell')
          const cellComponent = new CellComponent(dataItem, td, rowComponent, column)

          tr.appendChild(td)
          rowComponent.cells.push(cellComponent)
          if (this.eventSubscription.cellClick) {
            cellComponent.addClickEventListener(this.eventSubscription.cellClick)
          }
          if (column.definition.cellClick) {
            cellComponent.addClickEventListener(column.definition.cellClick)
          }

          this._buildTableCell(dataItem, column, cellComponent)
        })
        tbody.appendChild(tr)
        return rowComponent
      })
    } else {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.innerHTML = 'Loading'
      td.setAttribute(
        'colspan',
        this.columns.filter((c) => c.definition.visible === undefined || c.definition.visible === true).length,
      )
      tr.appendChild(td)
      tbody.appendChild(tr)
    }

    table.appendChild(thead)
    table.appendChild(tbody)

    this.element.appendChild(table)

    this.eventSubscription.tableBuilt?.()
  }

  // Test shim - expose a Tabulator-style API for getting column components
  getColumns() {
    return this.columns
  }

  _buildTableCell(dataItem, columnComponent, cellComponent) {
    const formatterParams = {}
    let onRenderedCallback = null
    const onRendered = (callback) => {
      onRenderedCallback = callback
    }
    const colFormatter = columnComponent.getFormatter()
    if (colFormatter) {
      cellComponent.getElement().innerHTML = colFormatter(cellComponent, formatterParams, onRendered)
    } else {
      const cellValue = getValueByKey(dataItem, columnComponent.getField())
      cellComponent.getElement().innerHTML = cellValue ? cellValue : ''
    }
    onRenderedCallback?.()
  }
}

export default Tabulator
