import React from 'react'
import { shallow } from 'enzyme'
import DrilldownModal from '../DrilldownModal'
import DrilldownTable from '../DrilldownTable'
import { QueryOutput } from '../../QueryOutput'
import sampleResponses from '../../../../test/responseTestCases'

const originalQueryResponse = sampleResponses[10]

// Mimics the DashboardTile QueryOutput ref that the modal reads the original query from
const activeDrilldownRef = {
  props: {},
  queryResponse: originalQueryResponse,
  tableConfig: {},
  pivotTableConfig: {},
  state: {
    displayType: 'column',
    columns: originalQueryResponse?.data?.data?.columns,
    columnOverrides: {},
  },
}

const setup = (props = {}) => {
  const setupProps = {
    ...DrilldownModal.defaultProps,
    isOpen: true,
    shouldRender: true,
    activeDrilldownRef,
    drilldownResponse: originalQueryResponse,
    isDrilldownRunning: false,
    showQueryInterpretation: true,
    ...props,
  }
  return shallow(<DrilldownModal {...setupProps} />)
}

describe('reverse translation is not duplicated', () => {
  test('only the drilldown table renders the reverse translation', () => {
    const wrapper = setup()

    const withInterpretation = [
      ...wrapper.find(QueryOutput).map((c) => c),
      ...wrapper.find(DrilldownTable).map((c) => c),
    ].filter((c) => c.prop('showQueryInterpretation'))

    expect(withInterpretation).toHaveLength(1)
    expect(withInterpretation[0].type()).toBe(DrilldownTable)
  })

  test('the original query chart never renders a reverse translation', () => {
    const wrapper = setup()

    expect(wrapper.find(QueryOutput).prop('showQueryInterpretation')).toBe(false)
  })

  test('the original query chart ignores showQueryInterpretation coming from the tile props', () => {
    const wrapper = setup({
      activeDrilldownRef: { ...activeDrilldownRef, props: { showQueryInterpretation: true } },
    })

    expect(wrapper.find(QueryOutput).prop('showQueryInterpretation')).toBe(false)
  })

  test('the drilldown table still respects showQueryInterpretation when disabled', () => {
    const wrapper = setup({ showQueryInterpretation: false })

    expect(wrapper.find(DrilldownTable).prop('showQueryInterpretation')).toBe(false)
  })
})
