import { scaleLinear, scaleBand, scaleOrdinal } from 'd3-scale'

const listColumns = [
  {
    display_name: 'Trade Date',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'v_volume.trade_date',
    type: 'DATE',
  },
  {
    display_name: 'Contract Name',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'v_volume.contract_name',
    type: 'STRING',
  },
  {
    display_name: 'Alternate Contract Name',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'v_volume.alternate_contract_name',
    type: 'STRING',
  },
  {
    display_name: 'Symbol',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'company.symbol',
    type: 'STRING',
  },
  {
    display_name: 'Expiry Date',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'contract.expiry_date',
    type: 'DATE',
  },
  {
    display_name: 'Put/Call',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'contract.put_call',
    type: 'STRING',
  },
  {
    display_name: 'Strike',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'contract.strike',
    type: 'QUANTITY',
  },
  {
    display_name: 'Daily Volume',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'v_volume.volume',
    type: 'QUANTITY',
  },
  {
    display_name: 'DTX',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'contract.dtx',
    type: 'QUANTITY',
  },
]

const pivotColumns = [
  {
    display_name: 'Put/Call',
    groupable: true,
    is_visible: true,
    multi_series: false,
    name: 'contract.put_call',
    type: 'STRING',
  },
  {
    display_name: 'Sector',
    groupable: true,
    is_visible: true,
    multi_series: false,
    name: 'company.sector',
    type: 'STRING',
  },
  {
    display_name: 'Total Volume',
    groupable: false,
    is_visible: true,
    multi_series: false,
    name: 'sum(v_volume.volume)',
    type: 'QUANTITY',
  },
]

const datePivotColumns = [
  {
    type: 'DATE',
    groupable: true,
    active: false,
    name: 'sale__transaction_date__month',
  },
  {
    active: false,
    groupable: false,
    name: 'sale__line_item___sum',
    type: 'DOLLAR_AMT',
  },
]

const listData = [
  [1648684800, 'ZS230721P00195000', 'ZS 07/21/23 195P', 'ZS', 1689897600, 'PUTS', 195, 100, 431],
  [1648684800, 'WFC240119P00047500', 'WFC 01/19/24 47.5P', 'WFC', 1705622400, 'PUTS', 47.5, 650, 613],
  [1648684800, 'TSLA220520C00840000', 'TSLA 05/20/22 840C', 'TSLA', 1653004800, 'CALLS', 840, 50, 4],
  [1648684800, 'CF221118P00095000', 'CF 11/18/22 95P', 'CF', 1668729600, 'PUTS', 95, 88, 186],
]

const pivotData = [
  ['CALLS', 'Technology', 15112902],
  ['PUTS', 'Technology', 11532122],
  ['CALLS', 'Energy ', 10108054],
  ['CALLS', 'Media', 9479177],
  ['CALLS', 'Automobiles', 8522149],
  ['PUTS', 'Media', 8401227],
]

const datePivotData = [
  [1483142400, 12500],
  [1488240000, 8742.68],
  [1490918400, 11723.36],
  [1493510400, 3243.12],
  [1496188800, 14642.19],
]

export default {
  list: {
    columns: listColumns,
    data: listData,
    numberColumnIndex: 7,
    numberColumnIndices: [6, 7, 8],
    visibleSeriesIndices: [6, 7],
    stringColumnIndex: 0,
    stringColumnIndices: [0, 1, 2, 3, 4, 5],
    height: 500,
    width: 500,
    stringScale: (params = {}) => {
      const scale = scaleBand()
      scale
        .domain(listData.map((d) => d[0]))
        .range([0, 500])
        .paddingInner(1)
        .paddingOuter(0)

      if (params && Object.keys(params)?.length) {
        Object.keys(params).forEach((key) => {
          scale[key] = params[key]
        })
      }

      return scale
    },
    numberScale: (params = {}) => {
      const scale = scaleLinear()
      scale.domain([5000000, 20000000]).range([0, 500]).nice()
      if (params && Object.keys(params)?.length) {
        Object.keys(params).forEach((key) => {
          scale[key] = params[key]
        })
      }
      return scale
    },
    colorScale: scaleOrdinal().range(['red', 'blue']),
    onLabelChange: () => {},
  },
  pivot: {
    columns: pivotColumns,
    data: pivotData,
    numberColumnIndex: 1,
    numberColumnIndices: [1, 2],
    visibleSeriesIndices: [1, 2],
    stringColumnIndex: 0,
    stringColumnIndices: [0],
    stringScale: (params = {}) => {
      const scale = scaleBand()
      scale
        .domain(pivotData.map((d) => d[0]))
        .range([0, 500])
        .paddingInner(1)
        .paddingOuter(0)
      if (params && Object.keys(params)?.length) {
        Object.keys(params).forEach((key) => {
          scale[key] = params[key]
        })
      }
      return scale
    },
    numberScale: (params = {}) => {
      const scale = scaleLinear()
      scale.domain([5000000, 20000000]).range([0, 500]).nice()
      if (params && Object.keys(params)?.length) {
        Object.keys(params).forEach((key) => {
          scale[key] = params[key]
        })
      }
      return scale
    },
    legendLabels: [
      {
        color: '#26A7E9',
        columnIndex: 1,
        hidden: undefined,
        label: 'PUTS',
        column: {
          display_name: 'Total Volume',
          field: '1',
          groupable: false,
          headerContext: undefined,
          id: 'f73a892b-7fb0-4801-9f94-2f3f5e7d7675',
          is_visible: true,
          multi_series: false,
          name: 'PUTS',
          origColumn: {},
          sorter: undefined,
          title: 'PUTS',
          type: 'QUANTITY',
          visible: true,
          widthGrow: 1,
          widthShrink: 1,
        },
      },
      {
        color: '#A5CD39',
        columnIndex: 2,
        hidden: undefined,
        label: 'CALLS',
        column: {
          display_name: 'Total Volume',
          field: '2',
          groupable: false,
          headerContext: undefined,
          hozAlign: 'center',
          id: 'f73a892b-7fb0-4801-9f94-2f3f5e7d7675',
          is_visible: true,
          multi_series: false,
          name: 'CALLS',
          origColumn: {},
          sorter: undefined,
          title: 'CALLS',
          type: 'QUANTITY',
          visible: true,
          widthGrow: 1,
          widthShrink: 1,
        },
      },
    ],
    colorScale: scaleOrdinal().range(['red', 'blue']),
    height: 500,
    width: 500,
    onLabelChange: () => {},
  },
  datePivot: {
    columns: datePivotColumns,
    data: datePivotData,
    numberColumnIndex: 1,
    numberColumnIndices: [1],
    visibleSeriesIndices: [1],
    stringColumnIndex: 0,
    stringColumnIndices: [0],
    height: 500,
    width: 500,
    stringScale: (params = {}) => {
      const scale = scaleBand()
      scale
        .domain(datePivotData.map((d) => d[0]))
        .range([0, 500])
        .paddingInner(1)
        .paddingOuter(0)
      if (params && Object.keys(params)?.length) {
        Object.keys(params).forEach((key) => {
          scale[key] = params[key]
        })
      }
      return scale
    },
    numberScale: (params = {}) => {
      const scale = scaleLinear()
      scale.domain([0, 1000]).range([0, 500]).nice()
      if (params && Object.keys(params)?.length) {
        Object.keys(params).forEach((key) => {
          scale[key] = params[key]
        })
      }
      return scale
    },
    colorScale: scaleOrdinal().range(['red', 'blue']),
    onLabelChange: () => {},
  },
}
