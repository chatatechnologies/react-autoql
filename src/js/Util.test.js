import { ignoreConsoleErrors } from '../../test/testUtils'

import {
  onlyUnique,
  makeEmptyArray,
  formatEpochDate,
  formatStringDate,
  formatChartLabel,
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
  isAggregation,
  getObjSize,
  getMaxValueFromKeyValueObj,
  getMinValueFromKeyValueObj,
} from './Util'

import {
  getColumnTypeAmounts,
  isColumnStringType,
  isColumnNumberType,
} from '../components/QueryOutput/columnHelpers'

import responseTestCases from '../../test/responseTestCases'

const sampleListResponse = {
  data: {
    data: {
      display_type: 'data',
      columns: [{ type: 'STRING' }, { type: 'STRING' }, { type: 'QUANTITY' }],
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
      columns: [{ type: 'STRING' }],
      rows: [['Nikki']],
    },
  },
}

const sampleSingleGroupableResponse = {
  data: {
    data: {
      display_type: 'data',
      columns: [{ type: 'STRING', groupable: true }, { type: 'QUANTITY' }],
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
        { type: 'STRING', groupable: true },
        { type: 'STRING', groupable: true },
        { type: 'QUANTITY' },
      ],
      rows: [
        ['Nikki', 'Moore', 100],
        ['John', 'Deer', 350],
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
  test('currency formats correctly', () => {
    const d = 93.5
    const col = {
      type: 'DOLLAR_AMT',
    }
    const config = {
      currencyCode: 'CAD',
    }
    const label = formatChartLabel({ d, col, config })
    expect(label.formattedLabel).toEqual('CA$94')
  })

  describe('long labels get truncated', () => {
    const d =
      'This is a really long label that should get cut off at around 35 characters'
    const col = { type: 'STRING' }
    const label = formatChartLabel({ d, col })
    test('isTruncated is true', () => {
      expect(label.isTruncated).toBeTruthy()
    })

    test('string is shortened with ellipsis', () => {
      expect(label.formattedLabel).toEqual('This is a really lon...')
    })
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
      const element = 15000.23098230593278
      const column = { type: 'QUANTITY' }
      expect(formatElement({ element, column })).toEqual('15,000.2')
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
      const element = 0.23
      const column = { type: 'PERCENT' }
      expect(formatElement({ element, column })).toEqual('23.00%')
    })
  })

  test('unknown type returns original value', () => {
    expect(
      formatElement({ element: 'se83n', column: { type: 'unknown' } })
    ).toEqual('se83n')
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
      { type: 'QUANTITY' },
      { type: 'DOLLAR_AMT' },
      { type: 'STRING' },
      { type: 'RATIO' },
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
      { groupable: false },
      { groupable: false },
      { groupable: false },
      { groupable: false },
    ]
    expect(getNumberOfGroupables(columns)).toEqual(0)
  })
  test('correct with 2 groupables', () => {
    const columns = [
      { groupable: false },
      { groupable: false },
      { groupable: true },
      { groupable: true },
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
      { groupable: true },
      { groupable: true },
      { groupable: false },
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
      { type: 'QUANTITY' },
      { type: 'DOLLAR_AMT' },
      { type: 'STRING' },
      { type: 'STRING' },
    ]
    expect(supports2DCharts(columns)).toBeTruthy()
  })
  test('false case', () => {
    const columns = [
      { type: 'QUANTITY' },
      { type: 'QUANTITY' },
      { type: 'QUANTITY' },
      { type: 'QUANTITY' },
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
          columns: [{ type: 'STRING' }, { type: 'STRING' }],
          rows: [
            ['Nikki', 'Moore'],
            ['John', 'Deer'],
          ],
        },
      },
    }

    expect(getSupportedDisplayTypes(response)).toEqual(['table'])
  })

  test('supports 2d charts', () => {
    const response = {
      data: {
        data: {
          display_type: 'data',
          columns: [
            { type: 'STRING' },
            { type: 'STRING' },
            { type: 'QUANTITY' },
          ],
          rows: [
            ['Nikki', 'Moore', 100],
            ['John', 'Deer', 350],
          ],
        },
      },
    }

    expect(getSupportedDisplayTypes(response)).toEqual([
      'table',
      'column',
      'bar',
      'line',
      'pie',
    ])
  })

  test('supports 3d charts', () => {
    expect(getSupportedDisplayTypes(sampleDoubleGroupableResponse)).toEqual([
      'pivot_table',
      'stacked_column',
      'stacked_bar',
      'stacked_line',
      'column',
      'bar',
      'line',
      'bubble',
      'heatmap',
      'table',
    ])
  })
})

describe('isDisplayTypeValid', () => {
  test('returns true for valid display type', () => {
    expect(
      isDisplayTypeValid(sampleDoubleGroupableResponse, 'stacked_bar')
    ).toBe(true)
  })

  test('returns false for invalid display type', () => {
    expect(isDisplayTypeValid(sampleDoubleGroupableResponse, 'pie')).toBe(false)
  })
})

describe('getDefaultDisplayType', () => {
  test('returns "table" for non-pivot data', () => {
    expect(getDefaultDisplayType(sampleListResponse, true)).toEqual('table')
  })

  test('returns "table" for single value response', () => {
    expect(getDefaultDisplayType(sampleSingleValueResponse, true)).toEqual(
      'table'
    )
  })

  test('returns "stacked_column" if available and charts are preferred', () => {
    expect(getDefaultDisplayType(sampleDoubleGroupableResponse, true)).toEqual(
      'stacked_column'
    )
  })

  test('returns "pivot_table" if available and tables are preferred', () => {
    expect(getDefaultDisplayType(sampleDoubleGroupableResponse, false)).toEqual(
      'pivot_table'
    )
  })

  test('returns "suggestion" for suggestion response', () => {
    expect(getDefaultDisplayType(responseTestCases[5], true)).toEqual(
      'suggestion'
    )
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
    expect(isAggregation(sampleSingleGroupableResponse.data.data.columns)).toBe(
      true
    )
  })
  test('double groupable', () => {
    expect(isAggregation(sampleDoubleGroupableResponse.data.data.columns)).toBe(
      true
    )
  })
  test('single value', () => {
    expect(isAggregation(sampleSingleValueResponse.data.data.columns)).toBe(
      false
    )
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

// export const calculateMinAndMaxSums = data
// export const changeTooltipText = (id, text, tooltipShiftDistance, duration)
// export const getChartLabelTextWidthInPx = text
// export const getLongestLabelInPx = (labels, col, config)
// export const shouldRotateLabels = (tickWidth, labels, col, config)
// export const getTickWidth = (scale, innerPadding)
// export const setCSSVars = ({ themeConfig, prefix })
// export const setStyleVars = ({ themeStyles, prefix })
// export const getQueryParams = url
// export const getNumberColumnIndices = columns
// export const filterDataForDrilldown = (response, drilldownData)
// export const getPadding = element
// export const capitalizeFirstChar = string
// export const isSingleValueResponse = response
// export const isTableResponse = (response, displayType)
// export const getGroupBysFromTable = (row, tableColumns)
// getGroupBysFromPivotTable = (
//   cell,
//   tableColumns,
//   pivotTableColumns,
//   originalColumnData
// )
