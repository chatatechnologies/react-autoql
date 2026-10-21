import React from 'react'
import { deepEqual, getAutoQLConfig } from 'autoql-fe-utils'
import { QueryOutput } from '../../QueryOutput'
import { getTileQueryOutputProps, getTileScopedAutoQLConfig } from '../../Dashboard/tileQueryConfig'
import { RB } from '../constants'
import { CHART_BOX_ATTRIBUTE } from '../print/waitForCharts'

// A chart on paper: the tile's own QueryOutput, fed the report's response, in a box of fixed height, with
// everything that would change it turned off — but for its axis selectors in the editor (see ReportChart).
// ChataChart measures the box it's in, so the box is sized here rather than scaled with CSS.

export const READ_ONLY_QUERY_OUTPUT_PROPS = {
  allowDisplayTypeChange: false,
  enableDynamicCharting: false,
  enableChartControls: false,
  enableTableSorting: false,
  enableTableContextMenu: false,
  enableCustomColumns: false,
  allowColumnAddition: false,
  useInfiniteScroll: false,
  showQueryInterpretation: false,
  autoSelectQueryValidationSuggestion: false,
  showSuggestionPrefix: false,
  mutable: false,
  isResizing: false,
  autoHeight: false,
  height: '100%',
  width: '100%',
}

// QueryOutput reads its initial* props once, on mount, so each response gets a QueryOutput of its own.
const responseIds = new WeakMap()
let nextResponseId = 0
// A pivot config with no columns reads, when a tile's config is loaded, as one saved before its data was
// ready, and takes the axes (tableConfig) away with it — so an empty one isn't kept.
const keptDataConfig = ({ pivotTableConfig, ...rest }) =>
  pivotTableConfig?.numberColumnIndices?.length || pivotTableConfig?.stringColumnIndices?.length
    ? { ...rest, pivotTableConfig }
    : rest

const responseKey = (response) => {
  if (!response || typeof response !== 'object') return 'none'
  if (!responseIds.has(response)) {
    nextResponseId += 1
    responseIds.set(response, nextResponseId)
  }
  return String(responseIds.get(response))
}

// In the editor (`onConfigChange`) a chart's axes can be changed with its own axis selectors, as in the Query
// view, and what it then reports (the axes as `dataConfig`, the aggregation as `aggConfig`) is handed up to be
// kept on the block. QueryOutput also reports on its own while it works out its first layout, so only what it
// reports after someone has used the chart counts, and only when it differs from what the block has.
export class ReportChart extends React.Component {
  used = false
  reported = {}

  shouldComponentUpdate(nextProps) {
    const { view, dataFormatting, autoQLConfig } = this.props
    return (
      nextProps.view.response !== view.response ||
      nextProps.view.displayType !== view.displayType ||
      nextProps.view.height !== view.height ||
      nextProps.view.tile !== view.tile ||
      !nextProps.onConfigChange !== !this.props.onConfigChange ||
      !deepEqual(nextProps.dataFormatting, dataFormatting) ||
      !deepEqual(nextProps.autoQLConfig, autoQLConfig)
    )
  }

  onUse = () => {
    this.used = true
  }

  report = (key, value) => {
    const last = this.reported[key]
    this.reported[key] = value
    if (!this.used || !this.props.onConfigChange || !value) return
    if (deepEqual(value, last) || deepEqual(value, this.props.view.tile?.[key])) return
    this.props.onConfigChange({ [key]: JSON.parse(JSON.stringify(value)) })
  }

  onTableConfigChange = (dataConfig) => this.report('dataConfig', dataConfig && keptDataConfig(dataConfig))

  onAggConfigChange = (aggConfig) => this.report('aggConfig', aggConfig)

  render() {
    const { view, authentication, autoQLConfig, dataFormatting, onConfigChange } = this.props
    const { tile, response, displayType, height } = view
    const fromTile = tile ? getTileQueryOutputProps(tile, { queryResponse: response }) : { queryResponse: response }
    const config = tile ? getTileScopedAutoQLConfig(autoQLConfig, tile) : getAutoQLConfig(autoQLConfig)
    const editable = typeof onConfigChange === 'function'

    return (
      <div
        className={`${RB}-chart`}
        {...{ [CHART_BOX_ATTRIBUTE]: '' }}
        style={{ height }}
        data-editable={editable || undefined}
        // The axis selectors' popovers are portals, and their events still pass through here.
        onMouseDownCapture={editable ? this.onUse : undefined}
        onKeyDownCapture={editable ? this.onUse : undefined}
      >
        <QueryOutput
          key={`${responseKey(response)}:${displayType}`}
          {...fromTile}
          {...READ_ONLY_QUERY_OUTPUT_PROPS}
          {...(editable
            ? {
                enableDynamicCharting: true,
                onTableConfigChange: this.onTableConfigChange,
                onAggConfigChange: this.onAggConfigChange,
              }
            : {})}
          initialDisplayType={displayType}
          authentication={authentication}
          autoQLConfig={{ ...config, enableDrilldowns: false }}
          dataFormatting={dataFormatting}
        />
      </div>
    )
  }
}
