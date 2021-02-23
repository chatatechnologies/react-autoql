// import Numbro from 'node_modules/numbro'
// import _get from 'lodash.get'
// import { formatElement } from '../../js/Util.js'

export default () => {
  self.getNumberOfGroupables = (columns) => {
    let numberOfGroupables = 0
    if (columns) {
      columns.forEach((col) => {
        if (col.groupable) {
          numberOfGroupables += 1
        }
      })
    }
    return numberOfGroupables
  }
  self.isColumnDateType = (col) => {
    try {
      const isDateType = col.type === 'DATE' || col.type === 'DATE_STRING'
      return isDateType
    } catch (error) {
      return false
    }
  }
  self.getTooltipDataForCell = (
    row,
    columnIndex,
    numberValue,
    dataFormatting,
    pivotTableColumns,
    dataConfig,
    tableColumns,
    supportsPivot
  ) => {
    let tooltipElement = null
    return tooltipElement
    try {
      if (supportsPivot) {
        const stringColumn = tableColumns[dataConfig.stringColumnIndex]
        const numberColumn = tableColumns[dataConfig.numberColumnIndex]

        tooltipElement = `<div>
            <div>
              <strong>${pivotTableColumns[0].title}:</strong> ${formatElement({
          element: row[0],
          column: pivotTableColumns[0],
          config: dataFormatting,
        })}
            </div>
            <div><strong>${
              tableColumns[dataConfig.legendColumnIndex].title
            }:</strong> ${pivotTableColumns[columnIndex].title}
            </div>
            <div>
            <div><strong>${numberColumn.title}:</strong> ${formatElement({
          element: row[columnIndex] || 0,
          column: numberColumn,
          config: dataFormatting,
        })}
            </div>
          </div>`
      } else {
        const stringColumn = this.chartTableColumns[
          dataConfig.stringColumnIndex
        ]
        const numberColumn = this.chartTableColumns[columnIndex]

        tooltipElement = `<div>
            <div>
              <strong>${stringColumn.title}:</strong> ${formatElement({
          element: row[dataConfig.stringColumnIndex],
          column: stringColumn,
          config: dataFormatting,
        })}
            </div>
            <div>
            <div><strong>${numberColumn.title}:</strong> ${formatElement({
          element: numberValue || row[columnIndex] || 0,
          column: numberColumn,
          config: dataFormatting,
        })}
            </div>
          </div>`
      }
      return tooltipElement
    } catch (error) {
      console.error(error)
      return null
    }
  }
  self.getDrilldownDataForCell = (
    row,
    columnIndex,
    tableColumns,
    supportsPivot,
    chartTableColumns,
    dataConfig
  ) => {
    const supportedByAPI = self.getNumberOfGroupables(tableColumns) > 0

    try {
      if (supportsPivot) {
        return {
          supportedByAPI,
          data: [
            {
              name: pivotTableColumns[0].name,
              value: `${row[0]}`,
            },
            {
              name: tableColumns[dataConfig.legendColumnIndex].name,
              value: `${pivotTableColumns[columnIndex].name}`,
            },
          ],
        }
      } else {
        return {
          supportedByAPI,
          data: [
            {
              name: chartTableColumns[dataConfig.stringColumnIndex].name,
              value: `${row[dataConfig.stringColumnIndex]}`,
            },
          ],
        }
      }
    } catch (error) {
      console.error(error)
      return { supportedByAPI, data: [] }
    }
  }
  self.generateChartData = ({
    dataConfig,
    dataFormatting,
    supportsPivot,
    tableColumns,
    pivotTableColumns,
    chartTableColumns,
    stringIndex,
    colorScale,
    tableData,
    columns,
  }) => {
    let chartData

    if (self.isColumnDateType(tableColumns[dataConfig.stringColumnIndex])) {
      tableData.reverse()
    }

    chartData = Object.values(
      tableData.reduce((chartDataObject, row, rowIndex) => {
        // Loop through columns and create a series for each
        const cells = []

        dataConfig.numberColumnIndices.forEach((columnIndex, i) => {
          const value = row[columnIndex]
          const colorScaleValue = supportsPivot ? columnIndex : i
          const drilldownData = self.getDrilldownDataForCell(
            row,
            columnIndex,
            tableColumns,
            supportsPivot,
            chartTableColumns,
            dataConfig,
            columns
          )
          const tooltipData = self.getTooltipDataForCell(
            row,
            columnIndex,
            value,
            dataFormatting,
            pivotTableColumns,
            dataConfig,
            tableColumns,
            supportsPivot
          )

          cells.push({
            value: !Number.isNaN(Number(value)) ? Number(value) : value, // this should always be able to convert to a number
            label: columns[columnIndex].title,
            // color: colorScale(colorScaleValue),
            hidden: false,
            drilldownData,
            tooltipData,
          })
        })

        // Make sure the row label doesn't exist already
        if (!chartDataObject[row[stringIndex]]) {
          chartDataObject[row[stringIndex]] = {
            origRow: row,
            label: row[stringIndex],
            cells,
            // formatter: (value, column) => {
            //   return formatElement({
            //     element: value,
            //     column,
            //     config: dataFormatting,
            //   })
            // },
          }
        } else {
          // If this label already exists, just add the values together
          // The BE should prevent this from happening though
          chartDataObject[row[stringIndex]].cells = chartDataObject[
            row[stringIndex]
          ].cells.map((cell, index) => {
            const newValue = cell.value + Number(cells[index].value)
            return {
              ...cell,
              value: newValue,
              tooltipData: self.getTooltipDataForCell(
                row,
                dataConfig.numberColumnIndices[index],
                newValue,
                dataFormatting,
                pivotTableColumns,
                dataConfig,
                tableColumns,
                supportsPivot
              ),
            }
          })
        }
        return chartDataObject
      }, {})
    )

    return chartData
  }
  self.addEventListener('message', (e) => {
    if (!e) return
    const payload = e.data
    const chartData = self.generateChartData(JSON.parse(payload.data))
    postMessage(JSON.stringify({ chartData }))
  })
}
