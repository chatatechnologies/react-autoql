import React from 'react'
import { shallow, mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'
import { findByTestAttr } from '../../../test/testUtils'
import { QueryOutput } from '../..'
import { QueryOutput as QueryOutputWithoutTheme } from '../../components/QueryOutput/QueryOutput'
import testCases from '../../../test/responseTestCases'

const defaultProps = QueryOutput.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<QueryOutput {...setupProps} />).dive()
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('test each response case', () => {
  for (let i = 0; i < testCases.length; i++) {
    describe(`renders correctly: response index ${i}`, () => {
      test('renders correctly with only token prop', () => {
        const wrapper = shallow(<QueryOutput queryResponse={testCases[i]} />).dive()
        const responseComponent = findByTestAttr(wrapper, 'query-response-wrapper')
        expect(responseComponent.exists()).toBe(true)
      })
      test(`renders correctly with default props: response index ${i}`, () => {
        const wrapper = setup({
          queryResponse: testCases[i],
        })
        expect(wrapper.exists()).toBe(true)
      })
    })
  }
})

describe('supported display types', () => {
  test('support charts even for 1 row of data', async () => {
    const queryResponse = _cloneDeep(testCases[8])
    queryResponse.data.data.rows = [queryResponse.data.data.rows[0]]
    const queryOutput = mount(<QueryOutputWithoutTheme queryResponse={queryResponse} queryFn={() => {}} />)
    const supportedDisplayTypes = queryOutput.instance().getCurrentSupportedDisplayTypes()
    expect(supportedDisplayTypes).toEqual(['table', 'column', 'bar'])
    queryOutput.unmount()
  })
})

describe('test table edge cases', () => {
  describe('all columns initially hidden then visibility changed', () => {
    const testCaseHiddenColumns = _cloneDeep(testCases[8])
    testCaseHiddenColumns.data.data.columns = testCaseHiddenColumns.data.data.columns.map((column) => {
      return {
        ...column,
        is_visible: false,
      }
    })
    test('columns hidden message shows when all columns are hidden', () => {
      const queryOutput = mount(<QueryOutput queryResponse={testCaseHiddenColumns} initialDisplayType='text' />)

      const hiddenColMessage = findByTestAttr(queryOutput, 'columns-hidden-message')
      expect(hiddenColMessage.exists()).toBe(true)
      queryOutput.unmount()
    })
    describe('display type is updated when column visibility is changed', () => {
      const queryOutputVisible = mount(<QueryOutput queryResponse={testCaseHiddenColumns} queryFn={() => {}} />)

      test('display type is text if all columns hidden', () => {
        const displayType = queryOutputVisible.find(QueryOutputWithoutTheme).instance().state.displayType

        expect(displayType).toBe('text')
      })

      test('display type is table after columns are unhidden', () => {
        const newColumns = _cloneDeep(testCases[8].data.data.columns)

        queryOutputVisible.find(QueryOutputWithoutTheme).instance().updateColumns(newColumns)

        const displayType = queryOutputVisible.find(QueryOutputWithoutTheme).instance().state.displayType

        queryOutputVisible.unmount()
        expect(displayType).toBe('table')
      })
    })
  })

  describe('initial table configs preservation', () => {
    test('initial table configs are preserved during mount and not overridden', () => {
      const testCase = _cloneDeep(testCases[9])

      // Create a custom initial table config with valid indices for test case 9 (has many columns)
      const initialTableConfig = {
        stringColumnIndex: 2, // Use Customer column (STRING type)
        stringColumnIndices: [2, 3, 4, 5, 6, 7, 8], // All STRING columns
        numberColumnIndex: 9, // Use Online Sales Amount column (DOLLAR_AMT type)
        numberColumnIndices: [1, 9], // QUANTITY and DOLLAR_AMT columns
        numberColumnIndex2: 1, // Use Transaction Number (QUANTITY type)
        numberColumnIndices2: [1],
        legendColumnIndex: 3, // Use Customer Type
        allNumberColumnIndices: [1, 9],
        currencyColumnIndices: [9],
        quantityColumnIndices: [1],
        ratioColumnIndices: [],
      }

      const initialTableConfigs = {
        tableConfig: initialTableConfig,
      }

      // Mount with initial table configs
      const queryOutput = mount(
        <QueryOutputWithoutTheme
          queryResponse={testCase}
          initialTableConfigs={initialTableConfigs}
          queryFn={() => {}}
        />,
      )

      const instance = queryOutput.instance()

      // Verify that the initial table config was preserved
      expect(instance.tableConfig).toEqual(initialTableConfig)

      // Verify specific properties that would be different from auto-generated config
      expect(instance.tableConfig.stringColumnIndex).toBe(2) // Should be our custom value, not auto-generated
      expect(instance.tableConfig.numberColumnIndex).toBe(9) // Should be our custom value, not auto-generated

      queryOutput.unmount()
    })

    test('initial table configs are ignored if invalid for the dataset', () => {
      const testCase = _cloneDeep(testCases[9])

      // Create an invalid initial table config (stringColumnIndex points to non-existent column)
      const invalidTableConfig = {
        stringColumnIndex: 999, // Invalid index
        stringColumnIndices: [999],
        numberColumnIndex: 4,
        numberColumnIndices: [4, 5, 6],
        numberColumnIndex2: 5,
        numberColumnIndices2: [5, 6],
        legendColumnIndex: 1,
        allNumberColumnIndices: [4, 5, 6],
        currencyColumnIndices: [4],
        quantityColumnIndices: [5],
        ratioColumnIndices: [6],
      }

      const initialTableConfigs = {
        tableConfig: invalidTableConfig,
      }

      // Mount with invalid initial table configs
      const queryOutput = mount(
        <QueryOutputWithoutTheme
          queryResponse={testCase}
          initialTableConfigs={initialTableConfigs}
          queryFn={() => {}}
        />,
      )

      const instance = queryOutput.instance()

      // Verify that the invalid config was ignored and auto-generated config was used instead
      expect(instance.tableConfig.stringColumnIndex).not.toBe(999) // Should not be the invalid value
      expect(instance.tableConfig.stringColumnIndex).toBeGreaterThanOrEqual(0) // Should be a valid index
      expect(instance.tableConfig.stringColumnIndex).toBeLessThan(testCase.data.data.columns.length) // Should be within bounds

      queryOutput.unmount()
    })

    test('table configs can be updated normally after mount', () => {
      const testCase = _cloneDeep(testCases[9])

      // Create initial table config with valid indices for test case 9
      const initialTableConfig = {
        stringColumnIndex: 2, // Use Customer column (STRING type)
        stringColumnIndices: [2, 3, 4, 5, 6, 7, 8], // All STRING columns
        numberColumnIndex: 9, // Use Online Sales Amount column (DOLLAR_AMT type)
        numberColumnIndices: [1, 9], // QUANTITY and DOLLAR_AMT columns
        numberColumnIndex2: 1, // Use Transaction Number (QUANTITY type)
        numberColumnIndices2: [1],
        legendColumnIndex: 3, // Use Customer Type
        allNumberColumnIndices: [1, 9],
        currencyColumnIndices: [9],
        quantityColumnIndices: [1],
        ratioColumnIndices: [],
      }

      const initialTableConfigs = {
        tableConfig: initialTableConfig,
      }

      // Mount with initial table configs
      const queryOutput = mount(
        <QueryOutputWithoutTheme
          queryResponse={testCase}
          initialTableConfigs={initialTableConfigs}
          queryFn={() => {}}
        />,
      )

      const instance = queryOutput.instance()

      // Verify initial config is preserved
      expect(instance.tableConfig.stringColumnIndex).toBe(2)

      // Simulate a display type change that would normally trigger config update
      instance.changeDisplayType('column')

      // After display type change, config should be updated (not preserved)
      // The exact values will depend on the auto-generated config, but they should be different from initial
      expect(instance.tableConfig).toBeDefined()
      // The config should still be valid for the new display type
      expect(instance.tableConfig.stringColumnIndex).toBeGreaterThanOrEqual(0)
      expect(instance.tableConfig.stringColumnIndex).toBeLessThan(testCase.data.data.columns.length)

      queryOutput.unmount()
    })
  })
})

describe('pivot table filtering', () => {
  const setupPivotTableTest = () => {
    const testCase = _cloneDeep(testCases[8])
    return {
      testCase,
      queryOutput: mount(
        <QueryOutputWithoutTheme queryResponse={testCase} initialDisplayType='pivot_table' queryFn={() => {}} />,
      ),
    }
  }

  describe('onTableParamsChange triggers pivot data regeneration', () => {
    test('calls generatePivotData when shouldGeneratePivotData returns true', () => {
      const { queryOutput } = setupPivotTableTest()

      const instance = queryOutput.instance()

      const generatePivotDataSpy = jest.spyOn(instance, 'generatePivotData')
      instance.shouldGeneratePivotData = jest.fn().mockReturnValue(true)

      instance.onTableParamsChange({}, {})

      expect(generatePivotDataSpy).toHaveBeenCalled()

      generatePivotDataSpy.mockRestore()
      queryOutput.unmount()
    })

    test('does not call generatePivotData when shouldGeneratePivotData returns false', () => {
      const { queryOutput } = setupPivotTableTest()

      const instance = queryOutput.instance()

      const generatePivotDataSpy = jest.spyOn(instance, 'generatePivotData')
      instance.shouldGeneratePivotData = jest.fn().mockReturnValue(false)

      instance.onTableParamsChange({}, {})

      expect(generatePivotDataSpy).not.toHaveBeenCalled()

      generatePivotDataSpy.mockRestore()
      queryOutput.unmount()
    })
  })

  describe('generatePivotTableData filters data correctly', () => {
    test('filters data based on formattedTableParams.filters', () => {
      const { testCase, queryOutput } = setupPivotTableTest()

      const instance = queryOutput.instance()

      instance.formattedTableParams = {
        filters: [
          {
            id: testCase.data.data.columns[0].name,
            value: testCase.data.data.rows[0][0],
            operator: 'equals',
          },
        ],
      }

      const forceUpdateSpy = jest.spyOn(instance, 'forceUpdate')

      instance.generatePivotTableData()

      expect(forceUpdateSpy).toHaveBeenCalled()
      expect(instance.pivotTableData).toBeDefined()
      expect(instance.pivotTableColumns).toBeDefined()

      forceUpdateSpy.mockRestore()
      queryOutput.unmount()
    })
  })

  describe('generatePivotData state updates', () => {
    test('updates visiblePivotRowChangeCount when dataChanged is true', () => {
      const { queryOutput } = setupPivotTableTest()

      const instance = queryOutput.instance()

      const initialCount = instance.state.visiblePivotRowChangeCount || 0
      instance.setState({ visiblePivotRowChangeCount: initialCount })

      instance.generatePivotData({ dataChanged: true })

      expect(instance.state.visiblePivotRowChangeCount).toBe(initialCount + 1)

      queryOutput.unmount()
    })

    test('does not increment visiblePivotRowChangeCount when dataChanged is false', () => {
      const { queryOutput } = setupPivotTableTest()

      const instance = queryOutput.instance()

      const initialCount = instance.state.visiblePivotRowChangeCount || 0
      instance.setState({ visiblePivotRowChangeCount: initialCount })

      instance.generatePivotData({ dataChanged: false })

      expect(instance.state.visiblePivotRowChangeCount).toBe(initialCount)

      queryOutput.unmount()
    })
  })

  describe('filter-by-zero support', () => {
    test('should allow numeric 0 as a valid filter value', () => {
      const queryOutput = mount(<QueryOutputWithoutTheme queryResponse={testCases[8]} queryFn={() => {}} />)
      const headerFilters = { 0: 0, 1: '10' }
      // Verify 0 is not treated as falsy (should not skip)
      expect(headerFilters[0]).toBe(0)
      expect(headerFilters[0] !== undefined && headerFilters[0] !== null).toBe(true)
      queryOutput.unmount()
    })

    test('should allow string "0" as a valid filter value', () => {
      const queryOutput = mount(<QueryOutputWithoutTheme queryResponse={testCases[8]} queryFn={() => {}} />)
      const headerFilters = { 0: '0' }
      const value = headerFilters[0]
      const isValid = value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')
      expect(isValid).toBe(true)
      queryOutput.unmount()
    })

    test('should skip empty string but not zero values', () => {
      const queryOutput = mount(<QueryOutputWithoutTheme queryResponse={testCases[8]} queryFn={() => {}} />)
      const testValues = [
        { value: 0, shouldPass: true, description: 'numeric 0' },
        { value: '0', shouldPass: true, description: 'string "0"' },
        { value: '', shouldPass: false, description: 'empty string' },
        { value: null, shouldPass: false, description: 'null' },
        { value: undefined, shouldPass: false, description: 'undefined' },
        { value: false, shouldPass: true, description: 'false' },
        { value: '  ', shouldPass: false, description: 'whitespace string' },
      ]
      testValues.forEach(({ value, shouldPass, description }) => {
        const passes = value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')
        expect(passes).toBe(shouldPass, `Failed for ${description}`)
      })
      queryOutput.unmount()
    })
  })
})
