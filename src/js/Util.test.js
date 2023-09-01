import { ignoreConsoleErrors } from '../../test/testUtils'

import {
  onlyUnique,
  makeEmptyArray,
  formatEpochDate,
  formatStringDate,
  formatElement,
  getNumberOfGroupables,
  getGroupableColumns,
  isChartType,
  isTableType,
  supportsRegularPivotTable,
  supports2DCharts,
  getSupportedDisplayTypes,
  isDisplayTypeValid,
  getDefaultDisplayType,
  nameValueObject,
} from './Util'

import {
  isAggregation,
  getColumnTypeAmounts,
  isColumnStringType,
  isColumnNumberType,
} from '../components/QueryOutput/columnHelpers'

import {getMinValueFromKeyValueObj, getMaxValueFromKeyValueObj, getObjSize} from 'autoql-fe-utils'

import responseTestCases from '../../test/responseTestCases'

const sampleListResponse = {
  data: {
    data: {
      display_type: 'data',
      columns: [
        { type: 'STRING', is_visible: true },
        { type: 'STRING', is_visible: true },
        { type: 'QUANTITY', is_visible: true },
      ],
      rows: [
        ['Nikki', 'Moore', 100],
        ['John', 'Deer', 350],
      ],
    },
  },
}
const sampleSingleValueResponse = {
  data: {
    data: {
      display_type: 'data',
      columns: [{ type: 'STRING', is_visible: true }],
      rows: [['Nikki']],
    },
  },
}

const sampleSingleGroupableResponse = {
  data: {
    data: {
      display_type: 'data',
      columns: [
        { type: 'STRING', groupable: true, is_visible: true },
        { type: 'QUANTITY', is_visible: true },
      ],
      rows: [
        ['Nikki', 100],
        ['John', 350],
      ],
    },
  },
}

const sampleDoubleGroupableResponse = {
  data: {
    data: {
      display_type: 'data',
      columns: [
        { type: 'STRING', groupable: true, is_visible: true },
        { type: 'STRING', groupable: true, is_visible: true },
        { type: 'QUANTITY', is_visible: true },
      ],
      rows: [
        ['Nikki', 'Moore', 100],
        ['John', 'Deer', 350],
      ],
    },
  },
}

const sampleDoubleGroupableResponseWithDateColumn = {
  data: {
    data: {
      display_type: 'data',
      columns: [
        {
          is_visible: true,
          multi_series: false,
          dow_style: '',
          name: 'public.customer_dimension.customer_region',
          precision: '',
          type: 'STRING',
          groupable: true,
          display_name: 'Customer Region',
        },
        {
          is_visible: true,
          multi_series: false,
          dow_style: 'NUM_1_SUN',
          name: "date_trunc('month', public.date_dimension.date)",
          precision: 'MONTH',
          type: 'DATE',
          groupable: true,
          display_name: 'month',
        },
        {
          is_visible: true,
          multi_series: false,
          dow_style: '',
          name: 'sum(online_sales.online_sales_fact.sales_dollar_amount)',
          precision: '',
          type: 'DOLLAR_AMT',
          groupable: false,
          display_name: 'Total Online Sales',
        },
      ],
      rows: [
        ['West', '2022-08-01T00:00Z', '2055737.0'],
        ['West', '2022-03-01T00:00Z', '1767141.0'],
        ['West', '2023-01-01T00:00Z', '1765595.0'],
      ],
    },
  },
}

describe('onlyUnique', () => {
  test('only unique filter works', () => {
    const testArray = [1, 1, 1, 4, 8, 1, 2, 3, 3, 3, 3]
    const filteredData = testArray.filter(onlyUnique)
    expect(filteredData).toEqual([1, 4, 8, 2, 3])
  })
})

describe('makeEmptyArray', () => {
  test('2 by 2 array works', () => {
    const testArray = makeEmptyArray(2, 2)
    expect(testArray).toEqual([
      ['', ''],
      ['', ''],
    ])
  })

  test('0 by 4 array works', () => {
    const testArray = makeEmptyArray(0, 4)
    expect(testArray).toEqual([[], [], [], []])
  })

  test('0 by 0 array works', () => {
    const testArray = makeEmptyArray(0, 0)
    expect(testArray).toEqual([])
  })

  test('4 by 0 array works', () => {
    const testArray = makeEmptyArray(4, 0)
    expect(testArray).toEqual([])
  })
})

describe('formatEpochDate', () => {
  const epoch = 1517443200

  const column = {
    title: 'Date',
    groupable: false,
    name: 'generalledger.txndate',
    type: 'DATE',
  }

  const config = {
    monthYearFormat: 'MMMM, YY',
    dayMonthYearFormat: 'DD, MMMM, YYYY',
  }

  test('works with valid epoch, column, and config', () => {
    const date = formatEpochDate(epoch, column, config)
    expect(date).toEqual('01, February, 2018')
  })

  test('works with invalid epoch', () => {
    const date = formatEpochDate('some date', column, config)
    expect(date).toEqual('some date')
  })

  test('displays month only if its part of the title', () => {
    const col = {
      title: 'Month of something',
      groupable: false,
      name: 'generalledger.txndate',
      type: 'DATE',
    }

    const date = formatEpochDate(epoch, col, config)
    expect(date).toEqual('February, 18')
  })

  test('displays nothing if value is null', () => {
    const date = formatEpochDate(null, column, config)
    expect(date).toBeUndefined()
  })

  test('displays nothing if value is 0', () => {
    const date = formatEpochDate(0, column, config)
    expect(date).toBeUndefined()
  })

  test('displays year only if "year" is in title', () => {
    const col = {
      title: 'Year of something',
      groupable: false,
      name: 'generalledger.txndate',
      type: 'DATE',
    }

    const date = formatEpochDate(epoch, col, config)
    expect(date).toEqual('2018')
  })

  test('displays date correctly even if date is not an epoch', () => {
    const date = formatEpochDate('march 2, 1999', column, config)
    expect(date).toEqual('02, March, 1999')
  })

  test('fallback to default if config is not provided', () => {
    const date = formatEpochDate(epoch, column)
    expect(date).toEqual('Feb 1, 2018')
  })

  test('works without providing column', () => {
    const date = formatEpochDate(epoch, undefined, config)
    expect(date).toEqual('01, February, 2018')
  })

  test('catches error if column title is not string', () => {
    ignoreConsoleErrors(() => {
      const col = { title: {} }
      expect(formatEpochDate(epoch, col, config)).toEqual(epoch)
    })
  })
})

describe('formatStringDate', () => {
  // String should be in format YYYY-MM-DD, YYYY-MM, or just YYYY
  const config = {
    monthYearFormat: 'MMM YYYY',
    dayMonthYearFormat: 'MMMM Do, YYYY',
  }
  test('works with valid year/month/day', () => {
    const date = formatStringDate('2005-04-09', config)
    expect(date).toEqual('April 9th, 2005')
  })

  test('works with valid year/month only', () => {
    const date = formatStringDate('2005-04', config)
    expect(date).toEqual('Apr 2005')
  })

  test('works with valid year only', () => {
    const date = formatStringDate('2005', config)
    expect(date).toEqual('2005')
  })

  test('works with null value', () => {
    const date = formatStringDate(null, config)
    expect(date).toBeUndefined()
  })

  test('returns raw value if it cant parse', () => {
    const date = formatStringDate('this is some date', config)
    expect(date).toEqual('this is some date')
  })

  test('returns raw value if order is wrong', () => {
    const date = formatStringDate('03-1991-15', config)
    expect(date).toEqual('03-1991-15')
  })
})

describe('isColumnNumberType', () => {
  test('returns true for QUANTITY', () => {
    expect(isColumnNumberType({ type: 'QUANTITY' })).toBeTruthy()
  })
  test('returns false for DATE', () => {
    expect(isColumnNumberType({ type: 'DATE' })).toBeFalsy()
  })
})

describe('isColumnStringType', () => {
  test('returns false for QUANTITY', () => {
    expect(isColumnStringType({ type: 'QUANTITY' })).toBeFalsy()
  })
  test('returns false for DATE', () => {
    expect(isColumnStringType({ type: 'DATE' })).toBeTruthy()
  })
})

describe('formatChartLabel', () => {
  // test('currency formats correctly', () => {
  //   const d = 93.5
  //   const col = {
  //     type: 'DOLLAR_AMT',
  //   }
  //   const config = {
  //     currencyCode: 'CAD',
  //   }
  //   const label = formatChartLabel({ d, col, config })
  //   expect(label.formattedLabel).toEqual('CA$94')
  // })

  describe('long labels get truncated', () => {
    // const d = 'This is a really long label that should get cut off at around 35 characters'
    // const column = { type: 'STRING' }
    // const label = formatChartLabel({ d, column })
    // test('isTruncated is true', () => {
    //   expect(label.isTruncated).toBeTruthy()
    // })
    // test('string is shortened with ellipsis', () => {
    //   expect(label.formattedLabel).toEqual('This is a really lon...')
    // })
  })
})

describe('formatElement', () => {
  describe('DOLLAR_AMT type', () => {
    test('renders 2 decimals and comma thousands by default', () => {
      const element = 15000
      const column = { type: 'DOLLAR_AMT' }
      expect(formatElement({ element, column })).toEqual('$15,000.00')
    })
  })

  describe('date type', () => {
    test('DATE type returns correct value from epoch', () => {
      const element = 1517443200
      const column = { type: 'DATE' }
      expect(formatElement({ element, column })).toEqual('Feb 1, 2018')
    })
    test('DATE_STRING type returns correct value from string', () => {
      const element = '1991-09-18'
      const column = { type: 'DATE_STRING' }
      expect(formatElement({ element, column })).toEqual('Sep 18, 1991')
    })
  })

  describe('QUANTITY type', () => {
    test('renders no decimals if orig has no decimals', () => {
      const element = 15000
      const column = { type: 'QUANTITY' }
      expect(formatElement({ element, column })).toEqual('15,000')
    })

    test('renders 1 decimal orig has decimals', () => {
      const element = (22 / 7) * 5000
      const column = { type: 'QUANTITY' }
      expect(formatElement({ element, column })).toEqual('15,714.29')
    })

    test('renders no decimals if config is 0', () => {})
  })

  describe('RATIO type', () => {
    test('defaults to 4 decimals', () => {
      const element = 0.23
      const column = { type: 'RATIO' }
      expect(formatElement({ element, column })).toEqual('0.2300')
    })
  })

  describe('PERCENT type', () => {
    test('defaults to 2 decimals', () => {
      const element = 23.0
      const column = { type: 'PERCENT' }
      expect(formatElement({ element, column })).toEqual('23.00%')
    })
  })

  test('unknown type returns original value', () => {
    expect(formatElement({ element: 'se83n', column: { type: 'unknown' } })).toEqual('se83n')
  })

  test('thrown error is caught (title is not a string)', () => {
    ignoreConsoleErrors(() => {
      const element = 1517443200
      const column = { title: {}, type: 'DATE' }
      const formatted = formatElement({ element, column })
      expect(formatted).toEqual(1517443200)
    })
  })
})

describe('getColumnTypeAmounts', () => {
  test('works when all types are provided', () => {
    const columns = [
      { type: 'QUANTITY', is_visible: true },
      { type: 'DOLLAR_AMT', is_visible: true },
      { type: 'STRING', is_visible: true },
      { type: 'RATIO', is_visible: true },
    ]
    expect(getColumnTypeAmounts(columns)).toEqual({
      amountOfNumberColumns: 3,
      amountOfStringColumns: 1,
    })
  })
})

describe('getNumberOfGroupables', () => {
  test('correct with 0 groupables', () => {
    const columns = [
      { groupable: false, is_visible: true },
      { groupable: false, is_visible: true },
      { groupable: false, is_visible: true },
      { groupable: false, is_visible: true },
    ]
    expect(getNumberOfGroupables(columns)).toEqual(0)
  })
  test('correct with 2 groupables', () => {
    const columns = [
      { groupable: false, is_visible: true },
      { groupable: false, is_visible: true },
      { groupable: true, is_visible: true },
      { groupable: true, is_visible: true },
    ]
    expect(getNumberOfGroupables(columns)).toEqual(2)
  })
})

describe('getGroupableColumns', () => {
  test('works correctly with columns provided', () => {
    const columns = [
      { groupable: false, name: 'one' },
      { groupable: false, name: 'two' },
      { groupable: true, name: 'three' },
      { groupable: true, name: 'four' },
    ]
    expect(getGroupableColumns(columns)).toEqual([2, 3])
  })

  test('returns undefined when empty columns are provided', () => {
    const columns = []
    expect(getGroupableColumns(columns)).toEqual([])
  })

  test('returns undefined when no columns are provided', () => {
    expect(getGroupableColumns()).toEqual([])
  })
})

describe('isChartType', () => {
  test('returns true for "bar"', () => {
    expect(isChartType('bar')).toBeTruthy()
  })
  test('returns false for "pivot_table"', () => {
    expect(isChartType('pivot_table')).toBeFalsy()
  })
})

describe('isTableType', () => {
  test('returns true for "pivot_table"', () => {
    expect(isTableType('pivot_table')).toBeTruthy()
  })
  test('returns false for "column"', () => {
    expect(isTableType('column')).toBeFalsy()
  })
})

describe('supportsRegularPivotTable', () => {
  test('true case', () => {
    const columns = [
      { groupable: true, is_visible: true },
      { groupable: true, is_visible: true },
      { groupable: false, is_visible: true },
    ]
    expect(supportsRegularPivotTable(columns)).toBeTruthy()
  })
  test('false case', () => {
    const columns = [{ groupable: true }, { groupable: true }]
    expect(supportsRegularPivotTable(columns)).toBeFalsy()
  })
})

describe('supports2DCharts', () => {
  test('true case', () => {
    const columns = [
      { type: 'QUANTITY', is_visible: true },
      { type: 'DOLLAR_AMT', is_visible: true },
      { type: 'STRING', is_visible: true },
      { type: 'STRING', is_visible: true },
    ]
    expect(supports2DCharts(columns)).toBeTruthy()
  })
  test('false case', () => {
    const columns = [
      { type: 'QUANTITY', is_visible: true },
      { type: 'QUANTITY', is_visible: true },
      { type: 'QUANTITY', is_visible: true },
      { type: 'QUANTITY', is_visible: true },
    ]
    expect(supports2DCharts(columns)).toBeFalsy()
  })
})

describe('getSupportedDisplayTypes', () => {
  test('supports list only', () => {
    const response = {
      data: {
        data: {
          display_type: 'data',
          columns: [
            { type: 'STRING', is_visible: true },
            { type: 'STRING', is_visible: true },
          ],
          rows: [
            ['Nikki', 'Moore'],
            ['John', 'Deer'],
          ],
        },
      },
    }

    expect(getSupportedDisplayTypes({ response })).toEqual(['table'])
  })

  test('supports 2d charts', () => {
    const response = {
      data: {
        data: {
          row_limit: 50,
          display_type: 'data',
          interpretation:
            'total online sales by Month between 2023-01-01T00:00:00.000Z and 2023-12-31T23:59:59.000Z (Date)',
          condition_filter: [],
          query_id: 'q_LqQ3sg__QxiYCwXPXDcIYA',
          chart_images: null,
          sql: [''],
          rows: [
            ['2023-01-01T00:00Z', '6202938.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
            ['2023-02-01T00:00Z', '1355992.0'],
          ],
          columns: [
            {
              is_visible: true,
              multi_series: false,
              dow_style: 'NUM_1_SUN',
              name: "date_trunc('month', public.date_dimension.date)",
              precision: 'MONTH',
              type: 'DATE',
              groupable: true,
              display_name: 'month',
            },
            {
              is_visible: true,
              multi_series: false,
              dow_style: '',
              name: 'sum(online_sales.online_sales_fact.sales_dollar_amount)',
              precision: '',
              type: 'DOLLAR_AMT',
              groupable: false,
              display_name: 'Total Online Sales',
            },
          ],
          parsed_interpretation: [
            {
              c_type: 'PREFIX',
              eng: 'total',
            },
            {
              c_type: 'SEED',
              eng: 'online sales',
            },
            {
              c_type: 'GROUPBY',
              eng: 'by Month',
            },
            {
              c_type: 'FILTER',
              eng: 'between 2023-01-01T00:00:00.000Z and 2023-12-31T23:59:59.000Z (Date)',
            },
          ],
          text: 'total online sales this year by month',
          count_rows: 2,
          fe_req: {
            v2_dates: 0,
            debug: false,
            test: false,
            date_format: 'ISO8601',
            chart_images: 'exclude',
            session_filter_locks: [],
            persistent_filter_locks: [],
            filters: [],
            source: 'data_messenger',
            translation: 'exclude',
            disambiguation: [],
            text: 'total online sales this year by month',
            page_size: 50,
            orders: [],
          },
        },
      },
    }

    expect(getSupportedDisplayTypes({ response })).toEqual(['table', 'column', 'bar', 'histogram', 'line'])
  })

  test('supports 3d charts', () => {
    expect(getSupportedDisplayTypes({ response: sampleDoubleGroupableResponse })).toEqual([
      'table',
      'pivot_table',
      'stacked_column',
      'stacked_bar',
      'column',
      'bar',
      'bubble',
      'heatmap',
    ])
  })

  test('supports line and stacked line if there is a date column', () => {
    expect(getSupportedDisplayTypes({ response: sampleDoubleGroupableResponseWithDateColumn })).toEqual([
      'table',
      'pivot_table',
      'stacked_column',
      'stacked_bar',
      'column',
      'bar',
      'bubble',
      'heatmap',
      'stacked_line',
      'line',
    ])
  })
})

describe('isDisplayTypeValid', () => {
  test('returns true for valid display type', () => {
    expect(isDisplayTypeValid(sampleDoubleGroupableResponse, 'stacked_bar')).toBe(true)
  })
  test('returns false for invalid display type', () => {
    expect(isDisplayTypeValid(sampleDoubleGroupableResponse, 'pie')).toBe(false)
  })
})

describe('getDefaultDisplayType', () => {
  test('returns "table" for non-pivot data', () => {
    expect(getDefaultDisplayType(sampleListResponse, true)).toEqual('table')
  })

  test('returns "single-value" for single value response', () => {
    expect(getDefaultDisplayType(sampleSingleValueResponse, true)).toEqual('single-value')
  })

  test('returns "stacked_column" if available and charts are preferred', () => {
    expect(getDefaultDisplayType(sampleDoubleGroupableResponse, true)).toEqual('stacked_column')
  })

  test('returns "pivot_table" if available and tables are preferred', () => {
    expect(getDefaultDisplayType(sampleDoubleGroupableResponse, false)).toEqual('pivot_table')
  })

  test('returns "suggestion" for suggestion response', () => {
    expect(getDefaultDisplayType(responseTestCases[5], true)).toEqual('text')
  })

  test('returns "text" as default', () => {
    expect(getDefaultDisplayType(responseTestCases[2], true)).toEqual('text')
  })
})

describe('nameValueObject', () => {
  test('has expected output with valid input', () => {
    expect(nameValueObject('key', 90)).toEqual({ name: 'key', value: 90 })
  })

  test('has expected output with undefined input', () => {
    expect(nameValueObject()).toEqual({})
  })
})

describe('isAggregation', () => {
  test('single groupable', () => {
    expect(isAggregation(sampleSingleGroupableResponse.data.data.columns)).toBe(true)
  })
  test('double groupable', () => {
    expect(isAggregation(sampleDoubleGroupableResponse.data.data.columns)).toBe(true)
  })
  test('single value', () => {
    expect(isAggregation(sampleSingleValueResponse.data.data.columns)).toBe(false)
  })
  test('list', () => {
    expect(isAggregation(sampleListResponse.data.data.columns)).toBe(false)
  })
})

describe('getObjSize', () => {
  test('returns 0 for empty object', () => {
    expect(getObjSize({})).toEqual(0)
  })
  test('returns 0 for undefined object', () => {
    expect(getObjSize()).toBeUndefined()
  })
  test('returns undefined for string type', () => {
    expect(getObjSize('not an object')).toBeUndefined()
  })
  test('returns correct length for array type', () => {
    expect(getObjSize(['array', 'of', 'strings'])).toEqual(3)
  })
  test('returns correct length for object type', () => {
    expect(getObjSize({ key1: 1, key2: '2', key3: {} })).toEqual(3)
  })
})

describe('getMaxValueFromKeyValueObj', () => {
  test('returns correct value from valid data', () => {
    const inputObject = {
      key1: 6,
      key2: -5,
      key4: 8,
      key5: null,
      key6: undefined,
      key7: 'string',
    }
    expect(getMaxValueFromKeyValueObj(inputObject)).toEqual(8)
  })
})

describe('getMinValueFromKeyValueObj', () => {
  test('returns correct value from valid data', () => {
    const inputObject = {
      key1: 6,
      key2: -5,
      key4: 8,
      key5: null,
      key6: undefined,
      key7: 'string',
    }
    expect(getMinValueFromKeyValueObj(inputObject)).toEqual(-5)
  })
})
