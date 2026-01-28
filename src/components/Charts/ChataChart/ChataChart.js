import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'

import {
  svgToPng,
  deepEqual,
  onlyUnique,
  DisplayTypes,
  getThemeValue,
  aggregateData,
  getBBoxFromRef,
  sortDataByDate,
  getColorScales,
  isColumnDateType,
  sortDataByColumn,
  getLegendLocation,
  getDateColumnIndex,
  isColumnNumberType,
  MAX_CHART_ELEMENTS,
  MAX_DATA_PAGE_SIZE,
  getDataFormatting,
  dataStructureChanged,
  DATE_ONLY_CHART_TYPES,
  aggregateOtherCategory,
  DOUBLE_AXIS_CHART_TYPES,
  mergeBoundingClientRects,
  getLegendLabelsForMultiSeries,
  CHARTS_WITHOUT_AGGREGATED_DATA,
  getAutoQLConfig,
  CustomColumnTypes,
} from 'autoql-fe-utils'

import { Spinner } from '../../Spinner'
import { Icon } from '../../Icon'
import { ChataPieChart } from '../ChataPieChart'
import { ChataBarChart } from '../ChataBarChart'
import { ChataLineChart } from '../ChataLineChart'
import { CSS_PREFIX } from '../../../js/Constants'
import { ChataHistogram } from '../ChataHistogram'
import { ChataColumnChart } from '../ChataColumnChart'
import { ChataBubbleChart } from '../ChataBubbleChart'
import { ChataHeatmapChart } from '../ChataHeatmapChart'
import { ChataColumnLineChart } from '../ChataColumnLine'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ChataStackedBarChart } from '../ChataStackedBarChart'
import { ChataScatterplotChart } from '../ChataScatterplotChart'
import { ChataStackedLineChart } from '../ChataStackedLineChart'
import { ChataStackedColumnChart } from '../ChataStackedColumnChart'
import ChataNetworkGraph from '../ChataNetworkGraph'
import { AverageLine } from '../AverageLine'
import { AverageLineToggle } from '../AverageLineToggle'
import { RegressionLine } from '../RegressionLine'
import { RegressionLineToggle } from '../RegressionLineToggle'

import { chartContainerDefaultProps, chartContainerPropTypes } from '../chartPropHelpers.js'

import './ChataChart.scss'

export default class ChataChart extends React.Component {
  constructor(props) {
    super(props)
    this.sortedNumberColumnIndicesForStacked = null // Initialize sorted column indices
    const data = this.getData(props)

    this.PADDING = 0

    this.firstRender = true
    this.bucketSize = props.bucketSize
    this.shouldRecalculateDimensions = false
    this.disableTimeScale = true
    this.sortedColumnsForHeatmap = null // Initialize sorted columns tracking

    // Vars for handling refresh layout throttle during resize
    this.throttleDelay = 100 // Default at 200 but adjust on the fly for data size
    this.lastCall = 0
    this.throttleTimeout = null

    this.state = {
      ...data,
      deltaX: 0,
      deltaY: 0,
      chartID: uuid(),
      isLoading: true,
      showAverageLine: props.initialChartControls?.showAverageLine || false,
      showRegressionLine: props.initialChartControls?.showRegressionLine || false,
      scaleVersion: 0, // Track scale changes to force line re-render
      visibleLegendLabels: null, // null means all labels are visible (set only from popover filter)
    }
  }

  static propTypes = {
    ...chartContainerPropTypes,

    type: PropTypes.string.isRequired,
    onBucketSizeChange: PropTypes.func,
    enableChartControls: PropTypes.bool,
    initialChartControls: PropTypes.shape({
      showAverageLine: PropTypes.bool,
      showRegressionLine: PropTypes.bool,
    }),
    onChartControlsChange: PropTypes.func,
    legendFilterConfig: PropTypes.shape({
      filteredOutLabels: PropTypes.arrayOf(PropTypes.string),
    }),
    onLegendFilterChange: PropTypes.func,
    onAxisSortChange: PropTypes.func,
    axisSorts: PropTypes.object,
  }

  static defaultProps = {
    ...chartContainerDefaultProps,
    onBucketSizeChange: () => {},
    enableChartControls: true,
    initialChartControls: {
      showAverageLine: false,
      showRegressionLine: false,
      showAverageLine: false,
      showRegressionLine: false,
    },
    onChartControlsChange: () => {},
    onAxisSortChange: () => {},
    axisSorts: {},
  }

  componentDidMount = () => {
    this._isMounted = true
    if (!this.props.isResizing && !this.props.hidden) {
      // The first render is to determine the chart size based on its parent container
      this.firstRender = false
      this.forceUpdate()
    }
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (nextProps.hidden && this.props.hidden) {
      return false
    }

    if (this.props.isResizing && !nextProps.isResizing) {
      this.shouldRecalculateDimensions = true
      return true
    }

    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentDidUpdate = (prevProps) => {
    if (!this._isMounted) {
      return
    }

    if (this.firstRender === true && !this.props.hidden) {
      this.firstRender = false
    }

    if (this.props.hidden && !prevProps.hidden) {
      this.firstRender = true
    }

    if (this.props.isResizing && !prevProps.isResizing && !this.props.hidden) {
      // Start throttling loop
      this.startThrottledRefresh()
    }

    if (!this.props.isResizing && prevProps.isResizing && !this.props.hidden) {
      // Stop throttling loop
      this.stopThrottledRefresh()
    }

    // Re-process data if axis sorts changed
    // Use deepEqual to properly compare objects
    const axisSortsChanged = !deepEqual(this.props.axisSorts, prevProps.axisSorts)
    if (axisSortsChanged) {
      // Clear sorted columns before re-processing (getData will set it if needed)
      this.sortedColumnsForHeatmap = null
      const newData = this.getData(this.props)
      if (newData) {
        // Force chart re-render with new sorted data and new chartID
        // The new chart render will naturally position everything correctly
        // Note: sortedColumnsForHeatmap is set in getData for Y-axis sorting
        this.setState({ ...newData, chartID: uuid() })
      }
    }

    // Also check if columns changed (which would affect sorted columns)
    if (!deepEqual(this.props.columns, prevProps.columns)) {
      this.sortedColumnsForHeatmap = null
    }

    if (
      this.props.type !== prevProps.type &&
      DATE_ONLY_CHART_TYPES.includes(this.props.type) &&
      !isColumnDateType(this.props.columns[this.props.stringColumnIndex])
    ) {
      const dateColumnIndex = getDateColumnIndex(this.props.originalColumns)
      this.props.changeStringColumnIndex(dateColumnIndex)
    } else if (this.props.type !== prevProps.type && DOUBLE_AXIS_CHART_TYPES.includes(this.props.type)) {
      const indicesIntersection = this.props.numberColumnIndices.filter((index) =>
        this.props.numberColumnIndices2.includes(index),
      )
      const indicesIntersect = !!indicesIntersection?.length
      if (indicesIntersect) {
        console.debug('Selected columns already exist on the other axis. Exiting')
        const newNumberColumnIndices = this.props.numberColumnIndices.filter(
          (index) => !this.props.numberColumnIndices2.includes(index),
        )
        this.props.changeNumberColumnIndices(newNumberColumnIndices, this.props.numberColumnIndices2)
      }
    }

    if (
      this._isMounted &&
      ((!this.props.isDrilldownChartHidden && prevProps.isDrilldownChartHidden) ||
        (prevProps.type && this.props.type !== prevProps.type))
    ) {
      this.setState({ chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
    }

    if (this.props.queryID !== prevProps.queryID || dataStructureChanged(this.props, prevProps)) {
      // Clear sorted columns when data structure changes
      this.sortedColumnsForHeatmap = null
      const data = this.getData(this.props)
      this.setState({ ...data, chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
    }

    // Check if props.data changed (which might reset our sorted data)
    // But only if axisSorts haven't changed (we already handled that case above)
    // and only if axis sorts exist (otherwise no need to reprocess)
    const dataChanged = !deepEqual(this.props.data, prevProps.data)
    const hasAxisSorts = this.props.axisSorts && Object.keys(this.props.axisSorts).length > 0
    if (dataChanged && !axisSortsChanged && hasAxisSorts) {
      // Re-apply sorting if data changed but sorts are still active
      this.sortedColumnsForHeatmap = null
      const newData = this.getData(this.props)
      if (newData) {
        // Force chart re-render with new sorted data and new chartID
        // The new chart render will naturally position everything correctly
        this.setState({ ...newData, chartID: uuid() })
      }
    }

    // Clear visibleLegendLabels state when table config changes (for color regeneration)
    // But don't clear the stored filters - they're stored per legend column and will be restored automatically
    const tableConfigChanged =
      this.props.stringColumnIndex !== prevProps.stringColumnIndex ||
      this.props.legendColumnIndex !== prevProps.legendColumnIndex ||
      !deepEqual(this.props.numberColumnIndices, prevProps.numberColumnIndices) ||
      !deepEqual(this.props.numberColumnIndices2, prevProps.numberColumnIndices2)

    if (tableConfigChanged) {
      // Reset visibleLegendLabels state to clear color regeneration
      if (this.state.visibleLegendLabels !== null) {
        this.setState({ visibleLegendLabels: null })
      }

      // Note: We don't clear legendFilterConfig anymore - filters are stored per legend column
      // The Legend component will automatically load the appropriate filter when the legend column changes
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.adjustVerticalPositionTimeout)
    this.stopThrottledRefresh()
  }

  startThrottledRefresh = () => {
    const aggregated = !CHARTS_WITHOUT_AGGREGATED_DATA.includes(this.props.type)
    const dataReduced = this.state.dataReduced ?? this.state.data
    const stateData = this.props.type == DisplayTypes.PIE ? dataReduced : this.state.data
    const data = (aggregated ? stateData : null) || this.props.data

    this.throttleDelay = (data?.length ?? 100) * 2
    if (this.throttleDelay < 50) {
      this.throttleDelay = 50
    } else if (this.throttleDelay > 1000) {
      this.throttleDelay = 1000
    }

    const loop = () => {
      const now = Date.now()

      if (now - this.lastCall >= this.throttleDelay) {
        this.lastCall = now
        this.adjustChartPosition()
      }

      this.throttleTimeout = setTimeout(loop, this.throttleDelay)
    }

    loop() // start the loop
  }

  stopThrottledRefresh = () => {
    clearTimeout(this.throttleTimeout)
    this.throttleTimeout = null
    this.lastCall = 0
  }

  getColorScales = () => {
    let { numberColumnIndices, numberColumnIndices2 } = this.props

    // For stacked charts, use sorted column indices for color scale calculation
    // This ensures colors are assigned sequentially to segments (biggest to smallest)
    const isStackedChart =
      this.props.type === DisplayTypes.STACKED_COLUMN || this.props.type === DisplayTypes.STACKED_BAR
    if (isStackedChart && this.sortedNumberColumnIndicesForStacked) {
      // Filter sorted indices to only include those that exist in the current columns array
      // This prevents errors when columns change (e.g., when legend column changes in pivot tables)
      const columns = this.sortedColumnsForHeatmap || this.props.columns
      const filteredIndices = this.sortedNumberColumnIndicesForStacked.filter(
        (colIndex) => columns?.[colIndex] !== undefined
      )
      // Only use filtered indices if we have valid ones, otherwise fall back to props
      if (filteredIndices.length > 0) {
        numberColumnIndices = filteredIndices
      }
    }

    // Use all column indices (including hidden ones via isSeriesHidden) for the base color scale
    // This ensures hidden series keep their original colors when clicked directly
    const scales = getColorScales({
      numberColumnIndices,
      numberColumnIndices2,
      data: this.props.data,
      type: this.props.type,
    })

    // Only filter colors if popover filter was applied (visibleLegendLabels is set)
    // This filters out items filtered via popover, but keeps hidden items (from direct clicks)
    if (
      this.state.visibleLegendLabels !== null &&
      this.state.visibleLegendLabels !== undefined &&
      this.state.visibleLegendLabels.length > 0 &&
      scales.colorScale
    ) {
      // Get column indices for the visible labels from popover filter
      // Need to get legend labels to map label strings to column indices
      const columns = this.sortedColumnsForHeatmap || this.props.columns
      const allLegendLabels = getLegendLabelsForMultiSeries(
        columns,
        scales.colorScale, // Use the base scale we just created
        numberColumnIndices,
      )

      const visibleColumnIndices = this.state.visibleLegendLabels
        .map((labelString) => {
          const labelObj = allLegendLabels.find((l) => l.label === labelString)
          return labelObj?.columnIndex
        })
        .filter((idx) => idx !== undefined && idx !== null)

      if (visibleColumnIndices.length > 0) {
        const originalRange = scales.colorScale.range()

        // Create a new color scale with only popover-filtered visible column indices
        // This excludes popover-filtered items but includes hidden items (from direct clicks)
        const newColorScale = scales.colorScale.copy()
        newColorScale.domain(visibleColumnIndices)
        // Reset the range to start from the beginning of the color palette
        const colorsForVisibleLabels = originalRange.slice(0, visibleColumnIndices.length)
        newColorScale.range(colorsForVisibleLabels)

        scales.colorScale = newColorScale
      }
    }

    return scales
  }

  dataIsBinned = () => {
    return this.props.type === DisplayTypes.HISTOGRAM
  }

  getData = (props) => {
    try {
      if (!props.data?.length || !props.columns?.length) {
        // Clear sorted indices if no data
        this.sortedNumberColumnIndicesForStacked = null
        return
      }

      const { stringColumnIndex, numberColumnIndex, legendColumnIndex } = props
      // For aggregated data, legendColumnIndex might be in tableConfig
      const actualLegendColumnIndex =
        legendColumnIndex !== undefined ? legendColumnIndex : props.tableConfig?.legendColumnIndex

      const maxElements = 10

      let isDataTruncated = false

      // Determine sort configuration first (before processing data)
      const hasAxisSort = props.axisSorts && Object.keys(props.axisSorts).length > 0
      const isHeatmapOrBubble = props.type === DisplayTypes.HEATMAP || props.type === DisplayTypes.BUBBLE
      let sortColumnIndex = null
      let sortDirection = null
      let primaryAxisSort = null
      let isYAxis = false

      if (hasAxisSort) {
        // Process axis sorts - determine which axis sort to apply
        const axisKeys = Object.keys(props.axisSorts)
        const xAxisKey = axisKeys.find((key) => key.startsWith('x-'))
        const yAxisKey = axisKeys.find((key) => key.startsWith('y-'))

        // Use whichever axis sort exists
        // If both exist, prefer the most recent one (last in the object)
        // Since JavaScript objects maintain insertion order, the last key is the most recent
        let primaryAxisKey = axisKeys[axisKeys.length - 1]

        primaryAxisSort = props.axisSorts[primaryAxisKey]

        if (primaryAxisSort && primaryAxisKey) {
          isYAxis = primaryAxisKey.startsWith('y-')

          const numberColumnIndices = props.numberColumnIndices || []
          const primaryNumberColumnIndex = numberColumnIndices[0]

          if (primaryAxisSort.startsWith('alpha-')) {
            // For heatmaps/bubble charts, Y axis uses legendColumnIndex, X axis uses stringColumnIndex
            // For other charts, use the column index from the axis key or stringColumnIndex
            if (isHeatmapOrBubble && isYAxis && props.isDataAggregated) {
              // For Y-axis sorting on aggregated heatmap/bubble, we'll handle column reordering in the sorting section
              // Set a flag so we know to do column sorting instead of row sorting
              sortColumnIndex = 'y-axis-column-sort'
            } else {
              // For pivot data (aggregated data), always sort by column 0 (the first column)
              // This is the string column that was used for grouping
              if (props.isDataAggregated) {
                sortColumnIndex = 0 // Always column 0 for pivot data
              } else {
                // For non-aggregated data, extract the column index from the axis key (e.g., 'x-1' -> 1, 'y-2' -> 2)
                const axisColumnIndexMatch = primaryAxisKey.match(/^[xy]-(\d+)$/)
                const axisColumnIndex = axisColumnIndexMatch ? parseInt(axisColumnIndexMatch[1], 10) : null
                sortColumnIndex = axisColumnIndex !== null ? axisColumnIndex : stringColumnIndex
              }
            }
            sortDirection = primaryAxisSort === 'alpha-asc' ? 'asc' : 'desc'
          } else if (primaryAxisSort.startsWith('value-')) {
            // Sort by the current primary number column
            sortColumnIndex = primaryNumberColumnIndex
            if (primaryAxisSort === 'value-asc') {
              sortDirection = 'asc'
            } else if (primaryAxisSort === 'value-desc') {
              sortDirection = 'desc'
            }
          }
        }
      }

      if (props.isDataAggregated) {
        // Data is already aggregated - sort the aggregated data using the original column indices
        let data = props.data

        if (
          hasAxisSort &&
          sortColumnIndex !== undefined &&
          sortColumnIndex !== null &&
          (sortDirection === 'asc' || sortDirection === 'desc')
        ) {
          // For Y-axis sorting on heatmaps/bubbles, we need to sort columns (legend categories), not rows
          if (isHeatmapOrBubble && isYAxis && sortColumnIndex === 'y-axis-column-sort') {
            // Sort the columns (legend categories) by their display names
            // Column 0 is the string column (row header), columns 1+ are the pivoted legend columns
            const stringColumn = props.columns[0]
            const legendColumns = props.columns.slice(1)

            // Create indices array for sorting
            // Map each column with its actual index (index + 1 because column 0 is the string column)
            const columnsWithIndices = legendColumns.map((col, arrayIndex) => ({
              columnIndex: arrayIndex + 1, // Actual column index in props.columns
              name: col.display_name || col.name || '',
            }))

            // Sort by name
            const sorted = [...columnsWithIndices].sort((a, b) => {
              const comparison = (a.name || '').localeCompare(b.name || '', undefined, {
                numeric: true,
                sensitivity: 'base',
              })
              return sortDirection === 'asc' ? comparison : -comparison
            })

            // Extract the sorted column indices
            const sortedIndices = sorted.map((item) => item.columnIndex)

            // Reorder data: for each row, keep column 0 (string value) and reorder columns 1+
            data = data.map((row) => {
              const newRow = [row[0]] // Keep the string column value
              sortedIndices.forEach((colIndex) => {
                newRow.push(row[colIndex])
              })
              return newRow
            })

            // Also reorder the columns array to match the data
            // Store in instance variable so getCommonChartProps can use it
            const sortedColumns = [
              props.columns[0], // Keep string column
              ...sortedIndices.map((colIndex) => props.columns[colIndex]),
            ]
            this.sortedColumnsForHeatmap = sortedColumns
          } else {
            // Normal row sorting for X-axis or other charts
            this.sortedColumnsForHeatmap = null
            data = sortDataByColumn(data, props.columns, sortColumnIndex, sortDirection)
          }
        } else if (!hasAxisSort) {
          // Only apply default sorting if no axis sort is specified
          // Clear sorted columns when no sort is applied
          this.sortedColumnsForHeatmap = null
          if (isColumnDateType(props.columns[stringColumnIndex])) {
            data = sortDataByDate(data, props.columns, 'asc')
          } else if (isColumnNumberType(props.columns[stringColumnIndex])) {
            data = sortDataByColumn(data, props.columns, stringColumnIndex, 'asc')
          }
        }

        if (data?.length > MAX_CHART_ELEMENTS && !this.dataIsBinned() && props.type !== DisplayTypes.NETWORK_GRAPH) {
          data = data.slice(0, MAX_CHART_ELEMENTS)
          isDataTruncated = true
        }

        // For stacked charts, calculate sorted column indices based on total aggregates
        const isStackedChart = props.type === DisplayTypes.STACKED_COLUMN || props.type === DisplayTypes.STACKED_BAR
        if (isStackedChart) {
          const numberIndices = props.numberColumnIndices || []
          // Calculate total aggregate for each column index across all rows
          const columnTotals = numberIndices.map((colIndex) => {
            const total = data.reduce((sum, row) => {
              const value = row[colIndex]
              const numValue = Number(value)
              return sum + (isNaN(numValue) ? 0 : numValue)
            }, 0)
            return { colIndex, total }
          })

          // Sort by total descending (biggest to smallest)
          columnTotals.sort((a, b) => b.total - a.total)

          // Store sorted column indices
          this.sortedNumberColumnIndicesForStacked = columnTotals.map((item) => item.colIndex)
        } else {
          this.sortedNumberColumnIndicesForStacked = null
        }

        return {
          data,
          dataReduced: aggregateOtherCategory(props.data, { stringColumnIndex, numberColumnIndex }, maxElements),
          isDataTruncated,
        }
      } else {
        // Data needs to be aggregated - aggregate first, then sort
        const indices1 = props.numberColumnIndices ?? []
        const indices2 = props.numberColumnIndices2 ?? []
        const numberIndices = [...indices1, ...indices2].filter(onlyUnique)

        if (!numberIndices.length) {
          return
        }

        const aggregatedWithOtherCategory = aggregateData({
          data: props.data,
          aggColIndex: stringColumnIndex,
          columns: props.columns,
          numberIndices,
          dataFormatting: props.dataFormatting,
          columnIndexConfig: { stringColumnIndex, numberColumnIndex },
          maxElements,
        })

        let aggregated = aggregateData({
          data: props.data,
          aggColIndex: props.stringColumnIndex,
          columns: props.columns,
          numberIndices,
          dataFormatting: props.dataFormatting,
        })

        // Apply axis sorting to aggregated data using the original column indices
        if (
          hasAxisSort &&
          sortColumnIndex !== undefined &&
          sortColumnIndex !== null &&
          (sortDirection === 'asc' || sortDirection === 'desc')
        ) {
          aggregated = sortDataByColumn(aggregated, props.columns, sortColumnIndex, sortDirection)
        }

        if (
          aggregated?.length > MAX_CHART_ELEMENTS &&
          !this.dataIsBinned() &&
          props.type !== DisplayTypes.NETWORK_GRAPH
        ) {
          aggregated = aggregated.slice(0, MAX_CHART_ELEMENTS)
          isDataTruncated = true
        }

        // For stacked charts, calculate sorted column indices based on total aggregates
        const isStackedChart = props.type === DisplayTypes.STACKED_COLUMN || props.type === DisplayTypes.STACKED_BAR
        if (isStackedChart) {
          // Calculate total aggregate for each column index across all rows
          const columnTotals = numberIndices.map((colIndex) => {
            const total = aggregated.reduce((sum, row) => {
              const value = row[colIndex]
              const numValue = Number(value)
              return sum + (isNaN(numValue) ? 0 : numValue)
            }, 0)
            return { colIndex, total }
          })

          // Sort by total descending (biggest to smallest)
          columnTotals.sort((a, b) => b.total - a.total)

          // Store sorted column indices
          this.sortedNumberColumnIndicesForStacked = columnTotals.map((item) => item.colIndex)
        } else {
          this.sortedNumberColumnIndicesForStacked = null
        }

        return { data: aggregated, dataReduced: aggregatedWithOtherCategory, isDataTruncated }
      }
    } catch (error) {
      console.error(error)
      return { data: props.data, dataReduced: props.data, isDataTruncated: false }
    }
  }

  setFinishedLoading = () => {
    clearTimeout(this.loadingTimeout)
    this.loadingTimeout = setTimeout(() => {
      if (this._isMounted) {
        this.setState({ isLoading: false })
      }
    }, 0)
  }

  adjustVerticalPosition = () => {
    // Adjust bottom and top axes second time to account for label rotation
    // Debounce in case multiple axes have rotated labels, we only want to
    // do the adjustment once
    if (!this.props.hidden) {
      clearTimeout(this.adjustVerticalPositionTimeout)
      this.adjustVerticalPositionTimeout = setTimeout(() => {
        if (this._isMounted) {
          const { deltaY } = this.getDeltas()
          const { innerHeight } = this.getInnerDimensions()
          this.setState({ deltaY, innerHeight }, () => {
            this.setFinishedLoading()
          })
        }
      }, 0)
    }
  }

  adjustChartPosition = () => {
    if (this.props.type === DisplayTypes.NETWORK_GRAPH) {
      return
    }

    if (!this.props.hidden) {
      clearTimeout(this.adjustPositionTimeout)
      this.adjustPositionTimeout = setTimeout(() => {
        if (this._isMounted) {
          const { deltaX, deltaY } = this.getDeltas()
          const { innerHeight, innerWidth } = this.getInnerDimensions()
          this.setState({ deltaX, deltaY, innerHeight, innerWidth }, () => {
            this.adjustVerticalPosition()
          })
        }
      }, 0)
    }
  }

  getDeltas = () => {
    if (this.props.type == DisplayTypes.PIE) {
      return { deltaX: 0, deltaY: 0 }
    }

    const axesBBox = getBBoxFromRef(this.innerChartRef?.chartRef)

    // Get distance in px to shift to the right
    const axesBBoxX = Math.ceil(axesBBox?.x ?? 0)
    const deltaX = -1 * axesBBoxX + this.PADDING

    // Get distance in px to shift down
    const axesBBoxY = Math.ceil(axesBBox?.y ?? 0)
    const deltaY = -1 * axesBBoxY + this.PADDING

    return { deltaX, deltaY }
  }

  getRenderedChartDimensions = () => {
    const leftAxisBBox = this.innerChartRef?.axesRef?.leftAxis?.ref?.getBoundingClientRect()
    const topAxisBBox = this.innerChartRef?.axesRef?.topAxis?.ref?.getBoundingClientRect()
    const bottomAxisBBox = this.innerChartRef?.axesRef?.bottomAxis?.getBoundingClientRect()
    const rightAxisBBox = this.innerChartRef?.axesRef?.rightAxis?.getBoundingClientRect()
    const clippedLegendBBox = this.innerChartRef?.axesRef?.legendRef?.legendClippingContainer?.getBoundingClientRect()
    const axesBBox = mergeBoundingClientRects([
      leftAxisBBox,
      bottomAxisBBox,
      rightAxisBBox,
      topAxisBBox,
      clippedLegendBBox,
    ])

    const axesWidth = axesBBox?.width ?? 0
    const axesHeight = axesBBox?.height ?? 0
    const axesX = axesBBox?.x ?? 0
    const axesY = axesBBox?.y ?? 0

    return {
      chartHeight: axesHeight,
      chartWidth: axesWidth,
      chartX: axesX,
      chartY: axesY,
    }
  }

  getInnerDimensions = () => {
    const { chartWidth, chartHeight } = this.getRenderedChartDimensions()

    const propsWidth = typeof this.props.width === CustomColumnTypes.NUMBER ? this.props.width : undefined
    const propsHeight = typeof this.props.height === CustomColumnTypes.NUMBER ? this.props.height : undefined

    const containerWidth = propsWidth ?? this.chartContainerRef?.clientWidth ?? 0
    const containerHeight = propsHeight ?? this.chartContainerRef?.clientHeight ?? 0

    let innerWidth = containerWidth - 2 * this.PADDING
    if (this.innerChartRef?.xScale && chartWidth) {
      const rangeInPx = this.innerChartRef.xScale.range()[1] - this.innerChartRef.xScale.range()[0]
      const totalHorizontalMargins = chartWidth - rangeInPx

      // Add extra margin for right axis dropdown if second axis exists
      const hasRightAxis = this.innerChartRef?.axesRef?.rightAxis
      const rightAxisDropdownMargin = hasRightAxis ? 10 : 0 // Extra space for axis dropdown

      innerWidth = containerWidth - totalHorizontalMargins - 2 * this.PADDING - rightAxisDropdownMargin
    }

    let innerHeight = containerHeight - 2 * this.PADDING
    if (this.innerChartRef?.yScale && chartHeight) {
      const rangeInPx = this.innerChartRef.yScale.range()[0] - this.innerChartRef.yScale.range()[1]
      const totalVerticalMargins = chartHeight - rangeInPx
      innerHeight = containerHeight - totalVerticalMargins - 2 * this.PADDING
    }

    if (innerWidth < 1) {
      innerWidth = 1
    }

    if (innerHeight < 1) {
      innerHeight = 1
    }

    return { innerWidth, innerHeight }
  }

  getOuterDimensions = () => {
    const defaultDimensions = {
      outerHeight: this.outerHeight,
      outerWidth: this.outerWidth,
    }

    if (this.props.hidden || this.props.isAnimating || this.firstRender) {
      return defaultDimensions
    }

    if (!this.outerWidth || !this.outerHeight || this.shouldRecalculateDimensions) {
      this.shouldRecalculateDimensions = false

      const containerBBox = this.chartContainerRef?.getBoundingClientRect()
      const containerWidth = containerBBox?.width ?? 0
      const containerHeight = containerBBox?.height ?? 0

      const outerWidth = Math.ceil(containerWidth)
      const outerHeight = Math.ceil(containerHeight)

      this.outerWidth = outerWidth
      this.outerHeight = outerHeight

      return { outerHeight, outerWidth }
    }

    return defaultDimensions
  }

  getLegendLabels = () => {
    // Use sorted columns if available (for Y-axis sorting on heatmaps)
    // This must use the same columns as getCommonChartProps to ensure consistency
    const columns = this.sortedColumnsForHeatmap || this.props.columns

    // For stacked charts, use sorted column indices based on total aggregates
    // This ensures legend labels match the sorted order of segments
    const isStackedChart =
      this.props.type === DisplayTypes.STACKED_COLUMN || this.props.type === DisplayTypes.STACKED_BAR
    let numberColumnIndices = this.props.numberColumnIndices
    
    if (isStackedChart && this.sortedNumberColumnIndicesForStacked) {
      // Filter sorted indices to only include those that exist in the current columns array
      // This prevents errors when columns change (e.g., when legend column changes in pivot tables)
      numberColumnIndices = this.sortedNumberColumnIndicesForStacked.filter(
        (colIndex) => columns?.[colIndex] !== undefined
      )
      // Fall back to props if all sorted indices are invalid
      if (numberColumnIndices.length === 0) {
        numberColumnIndices = this.props.numberColumnIndices
      }
    }

    return getLegendLabelsForMultiSeries(columns, this.getColorScales()?.colorScale, numberColumnIndices)
  }

  getBase64Data = (scale) => {
    if (!this.chartRef) {
      return Promise.reject()
    }

    return svgToPng(this.chartRef, scale, CSS_PREFIX)
  }

  saveAsPNG = (scale) => {
    try {
      this.getBase64Data(scale).then((data) => {
        const a = document.createElement('a')
        a.download = 'Chart.png'
        a.href = data
        a.click()
      })
    } catch (error) {
      console.error(error)
      return
    }
  }

  onBucketSizeChange = (bucketSize) => {
    this.props.onBucketSizeChange(bucketSize)
    this.bucketSize = bucketSize
  }

  renderChartHeader = () => {
    let paddingLeft = this.state.deltaX - 10
    if (isMobile || paddingLeft < 0 || this.outerWidth < 300) {
      paddingLeft = 25
    }

    return (
      <div
        ref={(r) => (this.sliderRef = r)}
        style={{ paddingLeft }}
        className={`react-autoql-chart-header-container ${
          (this.state.isLoading || this.props.isResizing) && this.props.type !== DisplayTypes.NETWORK_GRAPH
            ? 'loading'
            : ''
        }`}
      >
        {/* Chart Control Buttons and Data Limit Warning */}
        {((this.props.enableChartControls && this.shouldShowAverageLine()) || this.shouldShowDataLimitWarning()) &&
          !this.props.hidden && (
            <div className='chart-control-buttons'>
              {this.props.enableChartControls && this.shouldShowAverageLine() && (
                <div className='chart-control-buttons-left'>
                  <AverageLineToggle
                    isEnabled={this.state.showAverageLine}
                    onToggle={this.toggleAverageLine}
                    columns={this.props.columns}
                    visibleSeriesIndices={this.props.numberColumnIndices?.filter(
                      (colIndex) => this.props.columns?.[colIndex] && !this.props.columns[colIndex].isSeriesHidden,
                    )}
                    chartTooltipID={this.props.chartTooltipID}
                  />
                  {this.shouldShowRegressionLine() && (
                    <RegressionLineToggle
                      isEnabled={this.state.showRegressionLine}
                      onToggle={this.toggleRegressionLine}
                      columns={this.props.columns}
                      visibleSeriesIndices={this.props.numberColumnIndices?.filter(
                        (colIndex) => this.props.columns?.[colIndex] && !this.props.columns[colIndex].isSeriesHidden,
                      )}
                      chartTooltipID={this.props.chartTooltipID}
                    />
                  )}
                </div>
              )}
              {this.shouldShowDataLimitWarning() && (
                <div className='chart-control-buttons-right'>{this.renderDataLimitWarning()}</div>
              )}
            </div>
          )}
      </div>
    )
  }

  getCommonChartProps = () => {
    const { deltaX, deltaY } = this.state
    const { numberColumnIndices, columns: propsColumns, enableDynamicCharting, legendColumn } = this.props

    // Use sorted columns for heatmap Y-axis sorting, otherwise use props columns
    const columns = this.sortedColumnsForHeatmap || propsColumns

    // If we have sorted columns and a legendColumn, find the matching column in the sorted array
    let updatedLegendColumn = legendColumn
    if (this.sortedColumnsForHeatmap && legendColumn && this.props.legendColumnIndex !== undefined) {
      // Find the column at the same index in the sorted array
      // For heatmaps, legendColumn is typically at index 1 (first legend column after string column)
      const legendColumnIndex = this.props.legendColumnIndex
      if (legendColumnIndex < columns.length) {
        updatedLegendColumn = columns[legendColumnIndex]
      }
    }

    // For stacked charts, use sorted column indices based on total aggregates
    // This ensures all stacks and the legend use the same order (biggest to smallest)
    let finalNumberColumnIndices = numberColumnIndices
    const isStackedChart =
      this.props.type === DisplayTypes.STACKED_COLUMN || this.props.type === DisplayTypes.STACKED_BAR
    if (isStackedChart && this.sortedNumberColumnIndicesForStacked) {
      // Filter sorted indices to only include those that exist in the current columns array
      // This prevents errors when columns change (e.g., when legend column changes in pivot tables)
      const filteredIndices = this.sortedNumberColumnIndicesForStacked.filter(
        (colIndex) => columns?.[colIndex] !== undefined
      )
      // Only use filtered indices if we have valid ones, otherwise fall back to props
      if (filteredIndices.length > 0) {
        finalNumberColumnIndices = filteredIndices
      }
    }

    const visibleSeriesIndices = finalNumberColumnIndices.filter(
      (colIndex) => columns?.[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    const { innerHeight, innerWidth } = this.getInnerDimensions()
    const { outerHeight, outerWidth } = this.getOuterDimensions()
    const { colorScale, colorScale2 } = this.getColorScales()

    const aggregated = !CHARTS_WITHOUT_AGGREGATED_DATA.includes(this.props.type)

    const dataReduced = this.state.dataReduced ?? this.state.data
    const stateData = this.props.type == DisplayTypes.PIE ? dataReduced : this.state.data
    const data = (aggregated ? stateData : null) || this.props.data

    return {
      ...this.props,
      columns,
      legendColumn: updatedLegendColumn,
      numberColumnIndices: finalNumberColumnIndices, // Use sorted indices for stacked charts
      ref: (r) => (this.innerChartRef = r),
      innerChartRef: this.innerChartRef?.chartRef,
      key: undefined,
      data,
      aggregated,
      disableTimeScale: this.disableTimeScale,
      colorScale,
      colorScale2,
      height: innerHeight,
      width: innerWidth,
      outerHeight,
      outerWidth,
      deltaX,
      deltaY,
      chartPadding: this.PADDING,
      onLegendClick: this.handleLegendClick,
      enableAxisDropdown: enableDynamicCharting && !this.props.isAggregated,
      legendLocation: getLegendLocation(numberColumnIndices, this.props.type, this.props.legendLocation),
      onLabelRotation: this.adjustVerticalPosition,
      visibleSeriesIndices,
      tooltipID: this.props.tooltipID,
      chartTooltipID: this.props.chartTooltipID,
      chartContainerRef: this.chartContainerRef,
      popoverParentElement: this.props.popoverParentElement,
      totalRowCount: this.props.totalRowCount,
      chartID: this.state.chartID,
      isLoading: this.state.isLoading,
      changeNumberColumnIndices: this.props.changeNumberColumnIndices,
      onAxesRenderComplete: this.adjustChartPosition,
      showAverageLine: this.state.showAverageLine,
      toggleAverageLine: this.toggleAverageLine,
      showRegressionLine: this.state.showRegressionLine,
      toggleRegressionLine: this.toggleRegressionLine,
      incrementScaleVersion: this.incrementScaleVersion,
    }
  }

  renderChartLoader = () => {
    return (
      <div className='table-loader table-page-loader'>
        <div className='page-loader-spinner'>
          <Spinner />
        </div>
      </div>
    )
  }

  shouldShowDataLimitWarning = () => {
    if (this.props.hidden) {
      return false
    }

    const isTruncated =
      this.state.isDataTruncated &&
      this.props.type !== DisplayTypes.PIE &&
      this.props.type !== DisplayTypes.NETWORK_GRAPH

    const isDataLimited = this.props.isDataLimited

    return isDataLimited || isTruncated
  }

  renderDataLimitWarning = () => {
    if (!this.shouldShowDataLimitWarning()) {
      return null
    }

    const isTruncated =
      this.state.isDataTruncated &&
      this.props.type !== DisplayTypes.PIE &&
      this.props.type !== DisplayTypes.NETWORK_GRAPH

    const isDataLimited = this.props.isDataLimited

    const languageCode = getDataFormatting(this.props.dataFormatting).languageCode
    const rowLimit = this.props.rowLimit ?? MAX_DATA_PAGE_SIZE
    const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(rowLimit)
    const chartElementLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(MAX_CHART_ELEMENTS)

    let tooltipContent

    if (isDataLimited && isTruncated) {
      // Both limits exceeded - use general message
      tooltipContent = `To optimize performance, the visualization is limited to the initial <em>${rowLimitFormatted}</em> rows of data or <em>${chartElementLimitFormatted}</em> chart elements - whichever occurs first.`
    } else if (isDataLimited) {
      // Only MAX_DATA_PAGE_SIZE exceeded
      tooltipContent = `To optimize performance, this chart is limited to the initial <em>${rowLimitFormatted}</em> rows.`
    } else {
      // Only MAX_CHART_ELEMENTS exceeded
      tooltipContent = `To optimize performance, this chart is limited to <em>${chartElementLimitFormatted}</em> chart elements. Try switching the axis to reduce the number of elements.`
    }

    return (
      <div
        className='react-autoql-chart-data-limit-icon'
        data-tooltip-html={tooltipContent}
        data-tooltip-id={this.props.tooltipID}
      >
        <Icon type='warning' />
      </div>
    )
  }

  handleLegendVisibilityChange = (hiddenLabels) => this.props.onLegendVisibilityChange?.(hiddenLabels)

  handleVisibleLabelsChange = (visibleLabels) => {
    // This is only called from the popover filter - set the visible labels
    // which will be used to filter the color scale in getColorScales
    this.setState({ visibleLegendLabels: visibleLabels })
  }

  handleLegendClick = (label) => {
    // Just pass through to the original handler - colors won't change because
    // color scale includes all columns (even hidden ones) unless popover filter is active
    this.props.onLegendClick?.(label)
  }

  toggleAverageLine = () => {
    const newShowAverageLine = !this.state.showAverageLine
    // When turning on average line, turn off regression line (radio button behavior)
    const newShowRegressionLine = newShowAverageLine ? false : this.state.showRegressionLine

    this.setState({
      showAverageLine: newShowAverageLine,
      showRegressionLine: newShowRegressionLine,
    })
    this.props.onChartControlsChange({
      showAverageLine: newShowAverageLine,
      showRegressionLine: newShowRegressionLine,
    })
  }

  toggleRegressionLine = () => {
    const newShowRegressionLine = !this.state.showRegressionLine
    // When turning on regression line, turn off average line (radio button behavior)
    const newShowAverageLine = newShowRegressionLine ? false : this.state.showAverageLine

    this.setState({
      showAverageLine: newShowAverageLine,
      showRegressionLine: newShowRegressionLine,
    })
    this.props.onChartControlsChange({
      showAverageLine: newShowAverageLine,
      showRegressionLine: newShowRegressionLine,
    })
  }
  incrementScaleVersion = () => {
    this.setState((prevState) => ({ scaleVersion: prevState.scaleVersion + 1 }))
  }
  shouldShowAverageLine = () => {
    // Average lines are supported for all chart types
    const supportedCharts = [
      DisplayTypes.COLUMN,
      DisplayTypes.STACKED_COLUMN,
      DisplayTypes.BAR,
      DisplayTypes.STACKED_BAR,
      DisplayTypes.LINE,
      DisplayTypes.STACKED_LINE,
      DisplayTypes.SCATTERPLOT,
    ]
    return supportedCharts.includes(this.props.type)
  }

  shouldShowRegressionLine = () => {
    const supportedCharts = [
      DisplayTypes.COLUMN,
      DisplayTypes.STACKED_COLUMN,
      DisplayTypes.LINE,
      DisplayTypes.STACKED_LINE,
      DisplayTypes.SCATTERPLOT,
    ]

    // Exclude BAR and STACKED_BAR - line is vertical
    return supportedCharts.includes(this.props.type)
  }

  getChartTypeString = () => {
    // Convert DisplayTypes enum to string format expected by AverageLine component
    switch (this.props.type) {
      case DisplayTypes.COLUMN:
        return 'column'
      case DisplayTypes.STACKED_COLUMN:
        return 'stacked_column'
      case DisplayTypes.BAR:
        return 'bar'
      case DisplayTypes.STACKED_BAR:
        return 'stacked_bar'
      case DisplayTypes.LINE:
        return 'line'
      case DisplayTypes.STACKED_LINE:
        return 'stacked_line'
      case DisplayTypes.SCATTERPLOT:
        return 'scatterplot'
      default:
        return 'column'
    }
  }

  renderChart = () => {
    const commonChartProps = this.getCommonChartProps()
    const commonLegendProps = {
      legendLabels: this.getLegendLabels(),
      isEditing: this.props.isEditing,
      hiddenLegendLabels: this.props.hiddenLegendLabels,
      onLegendVisibilityChange: this.handleLegendVisibilityChange,
      onVisibleLabelsChange: this.handleVisibleLabelsChange,
      legendFilterConfig: this.props.legendFilterConfig,
      onLegendFilterChange: this.props.onLegendFilterChange,
    }

    switch (this.props.type) {
      case DisplayTypes.COLUMN: {
        return <ChataColumnChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.BAR: {
        return <ChataBarChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.LINE: {
        return <ChataLineChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.PIE: {
        return <ChataPieChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.BUBBLE: {
        return <ChataBubbleChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.HEATMAP: {
        return <ChataHeatmapChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.STACKED_COLUMN: {
        return <ChataStackedColumnChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.STACKED_BAR: {
        return <ChataStackedBarChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.STACKED_LINE: {
        return <ChataStackedLineChart {...commonChartProps} {...commonLegendProps} />
      }
      case DisplayTypes.COLUMN_LINE: {
        const visibleSeriesIndices2 = this.props.numberColumnIndices2?.filter(
          (i) => this.props.columns?.[i] && !this.props.columns[i].isSeriesHidden,
        )

        return (
          <ChataColumnLineChart
            {...commonChartProps}
            visibleSeriesIndices2={visibleSeriesIndices2}
            legendLabels={this.getLegendLabels()}
          />
        )
      }
      case DisplayTypes.HISTOGRAM: {
        return (
          <ChataHistogram
            {...commonChartProps}
            initialBucketSize={this.bucketSize}
            onBucketSizeChange={this.onBucketSizeChange}
            portalRef={this.sliderRef}
          />
        )
      }
      case DisplayTypes.SCATTERPLOT: {
        return <ChataScatterplotChart {...commonChartProps} />
      }
      case DisplayTypes.NETWORK_GRAPH: {
        return <ChataNetworkGraph {...commonChartProps} />
      }
      default: {
        return 'Unknown Display Type'
      }
    }
  }

  render = () => {
    if (!this.state.data?.length) {
      console.error('Unable to render chart - There was no data provided to the chart component.')
      return null
    }

    // We need to set these inline in order for them to be applied in the exported PNG
    const chartFontFamily = getThemeValue('font-family')
    const chartTextColor = getThemeValue('text-color-primary')
    const chartBackgroundColor = getThemeValue('background-color-secondary')

    return (
      <ErrorBoundary>
        <>
          {this.renderChartHeader()}
          <div
            id={`react-autoql-chart-${this.state.chartID}`}
            key={`react-autoql-chart-${this.state.chartID}`}
            ref={(r) => (this.chartContainerRef = r)}
            data-test='react-autoql-chart'
            className={`react-autoql-chart-container
            ${this.state.isLoading && this.props.type !== DisplayTypes.NETWORK_GRAPH ? 'loading' : ''}
            ${this.props.hidden ? 'hidden' : ''}
            ${getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns ? 'enable-drilldown' : 'disable-drilldown'}`}
          >
            {!this.firstRender && !this.props.isAnimating && (
              <svg
                ref={(r) => (this.chartRef = r)}
                xmlns='http://www.w3.org/2000/svg'
                width='100%'
                height='100%'
                style={{
                  fontSize: '12px',
                  fontFamily: chartFontFamily,
                  color: chartTextColor,
                  background: chartBackgroundColor,
                }}
              >
                <g
                  transform={`translate(${this.state.deltaX}, ${this.state.deltaY})`}
                  className='react-autoql-chart-content-container'
                >
                  {this.renderChart()}
                </g>

                {/* Average Line - only when enabled */}
                {this.shouldShowAverageLine() &&
                  this.state.showAverageLine &&
                  !this.props.hidden &&
                  this.innerChartRef?.xScale &&
                  this.innerChartRef?.yScale && (
                    <g transform={`translate(${this.state.deltaX}, ${this.state.deltaY})`}>
                      <AverageLine
                        key={`average-line-${this.state.scaleVersion}-${this.state.chartID}`}
                        data={this.getCommonChartProps().data}
                        columns={this.props.columns}
                        numberColumnIndex={this.props.numberColumnIndex}
                        numberColumnIndex2={this.props.numberColumnIndex2}
                        visibleSeriesIndices={this.props.numberColumnIndices?.filter(
                          (colIndex) => this.props.columns?.[colIndex] && !this.props.columns[colIndex].isSeriesHidden,
                        )}
                        xScale={this.innerChartRef.xScale}
                        yScale={this.innerChartRef.yScale}
                        width={this.getInnerDimensions().innerWidth}
                        height={this.getInnerDimensions().innerHeight}
                        isVisible={this.state.showAverageLine}
                        dataFormatting={this.props.dataFormatting}
                        chartTooltipID={this.props.chartTooltipID}
                        chartType={this.getChartTypeString()}
                      />
                    </g>
                  )}

                {/* Regression Line - only when enabled */}
                {this.shouldShowRegressionLine() &&
                  this.state.showRegressionLine &&
                  !this.props.hidden &&
                  this.innerChartRef?.xScale &&
                  this.innerChartRef?.yScale && (
                    <g transform={`translate(${this.state.deltaX}, ${this.state.deltaY})`}>
                      <RegressionLine
                        key={`regression-line-${this.state.scaleVersion}-${this.state.chartID}`}
                        data={this.getCommonChartProps().data}
                        columns={this.props.columns}
                        stringColumnIndex={this.props.stringColumnIndex}
                        numberColumnIndex={this.props.numberColumnIndex}
                        numberColumnIndex2={this.props.numberColumnIndex2}
                        visibleSeriesIndices={this.props.numberColumnIndices?.filter(
                          (colIndex) => this.props.columns?.[colIndex] && !this.props.columns[colIndex].isSeriesHidden,
                        )}
                        xScale={this.innerChartRef.xScale}
                        yScale={this.innerChartRef.yScale}
                        width={this.getInnerDimensions().innerWidth}
                        height={this.getInnerDimensions().innerHeight}
                        isVisible={this.state.showRegressionLine}
                        dataFormatting={this.props.dataFormatting}
                        chartTooltipID={this.props.chartTooltipID}
                        chartType={this.getChartTypeString()}
                        colorScale={this.getColorScales()?.colorScale}
                      />
                    </g>
                  )}
              </svg>
            )}
          </div>
        </>
      </ErrorBoundary>
    )
  }
}
