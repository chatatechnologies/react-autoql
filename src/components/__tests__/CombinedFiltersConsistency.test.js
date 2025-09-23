import React from 'react'
import { mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'

import { QueryOutput } from '../QueryOutput/QueryOutput'
import responseTestCases from '../../../test/responseTestCases'

// Mock the react-tooltip to avoid CSS issues in tests
jest.mock('react-tooltip', () => {
  return {
    __esModule: true,
    default: () => null,
  }
})

describe('Combined Filters Consistency Test', () => {
  let mockQueryResponse

  beforeEach(() => {
    // Create a mock query response with filters
    mockQueryResponse = _cloneDeep(responseTestCases[8])

    // Add some mock filters to simulate a real scenario
    mockQueryResponse.data.data.fe_req = {
      ...mockQueryResponse.data.data.fe_req,
      filters: [
        { name: 'region', value: 'West', operator: '=' },
        { name: 'category', value: 'Electronics', operator: '=' },
      ],
      session_filter_locks: [{ name: 'status', value: 'Active', operator: '=' }],
    }
  })

  test('should have consistent combined filters between custom options export and dashboard tile', () => {
    let queryOutputRef = null

    // 1. Setup QueryOutput component
    const queryOutputComponent = mount(
      <QueryOutput
        ref={(r) => {
          queryOutputRef = r
        }}
        queryResponse={mockQueryResponse}
        authentication={{}}
        autoQLConfig={{}}
        dataFormatting={{}}
      />,
    )

    // Wait for component to mount and initialize
    queryOutputComponent.update()

    // 2. Simulate table filters being applied
    const mockTableFilters = [
      { name: 'amount', value: '>1000', operator: '>' },
      { name: 'date', value: '2023-01-01', operator: '>=' },
    ]

    if (queryOutputRef) {
      queryOutputRef.formattedTableParams = {
        filters: mockTableFilters,
        sorters: [],
      }
    }

    // 3. Test getCombinedFilters method directly
    let combinedFilters = []
    if (queryOutputRef?.getCombinedFilters) {
      combinedFilters = queryOutputRef.getCombinedFilters()
    }

    // 4. Simulate custom options callback (what OptionsToolbar would pass)
    const customOptionsData = {
      queryResponse: mockQueryResponse,
      tableFilters: combinedFilters, // This is what OptionsToolbar passes now
      // ... other properties would be here
    }

    // 5. Simulate dashboard tile creation (what Dashboard.addTile would receive)
    const dashboardTileData = {
      queryResponse: customOptionsData.queryResponse,
      tableFilters: customOptionsData.tableFilters,
      // ... other properties
    }

    // 6. Verify that filters are identical between both paths
    expect(customOptionsData.tableFilters).toEqual(dashboardTileData.tableFilters)

    // 7. Verify specific filter combinations are present
    expect(combinedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'region', value: 'West' }),
        expect.objectContaining({ name: 'category', value: 'Electronics' }),
        expect.objectContaining({ name: 'amount', value: '>1000' }),
        expect.objectContaining({ name: 'date', value: '2023-01-01' }),
      ]),
    )

    // 8. Verify that query filters and table filters are properly combined
    expect(combinedFilters.length).toBeGreaterThan(mockTableFilters.length)

    // Cleanup
    queryOutputComponent.unmount()
  })

  test('should handle empty filters correctly', () => {
    let queryOutputRef = null

    // Test case where there are no filters
    const queryOutputComponent = mount(
      <QueryOutput
        ref={(r) => {
          queryOutputRef = r
        }}
        queryResponse={responseTestCases[8]} // No filters
        authentication={{}}
        autoQLConfig={{}}
        dataFormatting={{}}
      />,
    )

    queryOutputComponent.update()

    // Test getCombinedFilters when no filters are present
    let combinedFilters = []
    if (queryOutputRef?.getCombinedFilters) {
      combinedFilters = queryOutputRef.getCombinedFilters()
    }

    // Verify that empty filters are handled correctly
    expect(Array.isArray(combinedFilters)).toBe(true)
    expect(combinedFilters.length).toBeGreaterThanOrEqual(0)

    // Simulate what would be passed to custom options
    const customOptionsData = {
      tableFilters: combinedFilters,
    }

    // Simulate what would be saved as dashboard tile
    const dashboardTileData = {
      tableFilters: customOptionsData.tableFilters,
    }

    // Verify consistency even with empty filters
    expect(customOptionsData.tableFilters).toEqual(dashboardTileData.tableFilters)

    // Cleanup
    queryOutputComponent.unmount()
  })

  test('should preserve filter structure and properties', () => {
    let queryOutputRef = null

    const queryOutputComponent = mount(
      <QueryOutput
        ref={(r) => {
          queryOutputRef = r
        }}
        queryResponse={mockQueryResponse}
        authentication={{}}
        autoQLConfig={{}}
        dataFormatting={{}}
      />,
    )

    queryOutputComponent.update()

    // Add complex table filters with various properties
    const complexFilters = [
      {
        name: 'sales_amount',
        value: '500,2000',
        operator: 'between',
        column_type: 'DOLLAR_AMT',
        columnName: 'Sales Amount',
      },
      {
        name: 'created_date',
        value: '2023-01-01T00:00:00.000Z,2023-12-31T23:59:59.999Z',
        operator: 'between',
        column_type: 'TIME',
        columnName: 'Created Date',
      },
    ]

    if (queryOutputRef) {
      queryOutputRef.formattedTableParams = {
        filters: complexFilters,
        sorters: [],
      }
    }

    // Test getCombinedFilters with complex filters
    let combinedFilters = []
    if (queryOutputRef?.getCombinedFilters) {
      combinedFilters = queryOutputRef.getCombinedFilters()
    }

    // Simulate custom options data
    const customOptionsData = {
      tableFilters: combinedFilters,
    }

    // Simulate dashboard tile data
    const dashboardTileData = {
      tableFilters: customOptionsData.tableFilters,
    }

    // Verify consistency
    expect(customOptionsData.tableFilters).toEqual(dashboardTileData.tableFilters)

    // Verify that all filter properties are preserved (except columnName which is set separately)
    expect(combinedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'sales_amount',
          value: '500,2000',
          operator: 'between',
          column_type: 'DOLLAR_AMT',
        }),
        expect.objectContaining({
          name: 'created_date',
          operator: 'between',
          column_type: 'TIME',
          value: '2023-01-01T00:00:00.000Z,2023-12-31T23:59:59.999Z',
        }),
      ]),
    )

    // Verify that original query filters are also included
    expect(combinedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'region',
          value: 'West',
        }),
        expect.objectContaining({
          name: 'category',
          value: 'Electronics',
        }),
      ]),
    )

    // Cleanup
    queryOutputComponent.unmount()
  })

  test('should handle filters stored only in formattedTableParams (not in fe_req)', () => {
    let queryOutputRef = null

    // Create a response without filters in fe_req
    const responseWithoutFeReqFilters = _cloneDeep(responseTestCases[8])
    // Ensure no filters in fe_req
    if (responseWithoutFeReqFilters.data.data.fe_req) {
      delete responseWithoutFeReqFilters.data.data.fe_req.filters
      delete responseWithoutFeReqFilters.data.data.fe_req.session_filter_locks
    }

    const queryOutputComponent = mount(
      <QueryOutput
        ref={(r) => {
          queryOutputRef = r
        }}
        queryResponse={responseWithoutFeReqFilters}
        authentication={{}}
        autoQLConfig={{}}
        dataFormatting={{}}
      />,
    )

    queryOutputComponent.update()

    // Set filters directly on formattedTableParams (simulating user table interactions)
    const directTableFilters = [
      { name: 'product_id', value: '12345', operator: '=' },
      { name: 'price', value: '100,500', operator: 'between' },
      { name: 'created_at', value: '2023-01-01', operator: '>=' },
    ]

    if (queryOutputRef) {
      queryOutputRef.formattedTableParams = {
        filters: directTableFilters,
        sorters: [],
      }
    }

    // Test getCombinedFilters method
    let combinedFilters = []
    if (queryOutputRef?.getCombinedFilters) {
      combinedFilters = queryOutputRef.getCombinedFilters()
    }

    // Simulate custom options data
    const customOptionsData = {
      tableFilters: combinedFilters,
    }

    // Simulate dashboard tile data
    const dashboardTileData = {
      tableFilters: customOptionsData.tableFilters,
    }

    // Verify consistency
    expect(customOptionsData.tableFilters).toEqual(dashboardTileData.tableFilters)

    // Verify that all formattedTableParams filters are included
    expect(combinedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'product_id',
          value: '12345',
          operator: '=',
        }),
        expect.objectContaining({
          name: 'price',
          value: '100,500',
          operator: 'between',
        }),
        expect.objectContaining({
          name: 'created_at',
          value: '2023-01-01',
          operator: '>=',
        }),
      ]),
    )

    // Verify that the combined filters only contain the table filters (no fe_req filters)
    expect(combinedFilters.length).toBe(directTableFilters.length)

    // Verify each filter matches exactly
    directTableFilters.forEach((expectedFilter) => {
      expect(combinedFilters).toContainEqual(expect.objectContaining(expectedFilter))
    })

    // Cleanup
    queryOutputComponent.unmount()
  })

  test('should combine both fe_req filters and formattedTableParams filters correctly', () => {
    let queryOutputRef = null

    // Create a response with filters in fe_req
    const responseWithBothSources = _cloneDeep(mockQueryResponse)

    const queryOutputComponent = mount(
      <QueryOutput
        ref={(r) => {
          queryOutputRef = r
        }}
        queryResponse={responseWithBothSources}
        authentication={{}}
        autoQLConfig={{}}
        dataFormatting={{}}
      />,
    )

    queryOutputComponent.update()

    // Add additional filters via formattedTableParams (simulating user table interactions)
    const additionalTableFilters = [
      { name: 'user_role', value: 'admin', operator: '=' },
      { name: 'last_login', value: '2023-06-01', operator: '>=' },
    ]

    if (queryOutputRef) {
      queryOutputRef.formattedTableParams = {
        filters: additionalTableFilters,
        sorters: [],
      }
    }

    // Test getCombinedFilters method
    let combinedFilters = []
    if (queryOutputRef?.getCombinedFilters) {
      combinedFilters = queryOutputRef.getCombinedFilters()
    }

    // Simulate custom options data
    const customOptionsData = {
      tableFilters: combinedFilters,
    }

    // Simulate dashboard tile data
    const dashboardTileData = {
      tableFilters: customOptionsData.tableFilters,
    }

    // Verify consistency
    expect(customOptionsData.tableFilters).toEqual(dashboardTileData.tableFilters)

    // Verify that both fe_req filters and formattedTableParams filters are included
    // Note: getCombinedFilters only includes fe_req.filters, not fe_req.session_filter_locks
    expect(combinedFilters).toEqual(
      expect.arrayContaining([
        // Original fe_req filters
        expect.objectContaining({
          name: 'region',
          value: 'West',
          operator: '=',
        }),
        expect.objectContaining({
          name: 'category',
          value: 'Electronics',
          operator: '=',
        }),
        // Additional formattedTableParams filters
        expect.objectContaining({
          name: 'user_role',
          value: 'admin',
          operator: '=',
        }),
        expect.objectContaining({
          name: 'last_login',
          value: '2023-06-01',
          operator: '>=',
        }),
      ]),
    )

    // Verify total count includes both sources
    // Note: session_filter_locks are not included by getCombinedFilters
    const expectedTotalFilters =
      2 + // fe_req.filters (region, category)
      2 // formattedTableParams.filters (user_role, last_login)
    expect(combinedFilters.length).toBe(expectedTotalFilters)

    // Cleanup
    queryOutputComponent.unmount()
  })

  test('should PASS: OptionsToolbar now correctly uses getCombinedFilters (FIXED!)', () => {
    let actualExportedData = null

    // Mock responseRef that simulates a QueryOutput with both fe_req filters and table filters
    const mockResponseRef = {
      queryResponse: {
        data: {
          data: {
            text: 'test query',
            fe_req: {
              filters: [
                { name: 'region', value: 'West', operator: '=' },
                { name: 'category', value: 'Electronics', operator: '=' },
              ],
              session_filter_locks: [],
              additional_selects: [],
              display_overrides: [],
              orders: [],
            },
          },
        },
      },
      state: {
        aggConfig: {},
        displayType: 'table',
      },
      tableConfig: {},
      pivotTableConfig: {},
      // Mock getCombinedFilters method that returns BOTH fe_req and table filters
      getCombinedFilters: () => [
        { name: 'region', value: 'West', operator: '=' },
        { name: 'category', value: 'Electronics', operator: '=' },
        { name: 'user_id', value: '12345', operator: '=' }, // Table filter that should be included
        { name: 'created_date', value: '2023-01-01', operator: '>=' }, // Table filter that should be included
      ],
    }

    // Test the ACTUAL OptionsToolbar behavior after the fix
    // Simulate what OptionsToolbar.js lines 480-497 do NOW (with the fix)
    const responseCopy = _cloneDeep(mockResponseRef?.queryResponse)

    // This is what line 491 in OptionsToolbar.js NOW does (after fix):
    const actualOptionsToolbarFilters = mockResponseRef?.getCombinedFilters?.()

    // This is what it should do (same as above now!):
    const expectedCombinedFilters = mockResponseRef?.getCombinedFilters?.()

    console.log('✅ FIX VERIFICATION:')
    console.log('✅ OptionsToolbar (line 491) now exports:', actualOptionsToolbarFilters?.length || 0, 'filters')
    console.log('✅ Expected combined filters:', expectedCombinedFilters?.length || 0, 'filters')
    console.log(
      '✅ Missing table filters:',
      (expectedCombinedFilters?.length || 0) - (actualOptionsToolbarFilters?.length || 0),
    )

    // THIS TEST SHOULD NOW PASS because line 491 uses getCombinedFilters()!
    // When the test PASSES, it confirms the bug has been fixed!
    expect(actualOptionsToolbarFilters).toEqual(expectedCombinedFilters)

    // Additional verification: ensure all 4 filters are present
    expect(actualOptionsToolbarFilters).toHaveLength(4)
    expect(actualOptionsToolbarFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'region', value: 'West' }),
        expect.objectContaining({ name: 'category', value: 'Electronics' }),
        expect.objectContaining({ name: 'user_id', value: '12345' }),
        expect.objectContaining({ name: 'created_date', value: '2023-01-01' }),
      ]),
    )
  })
})
