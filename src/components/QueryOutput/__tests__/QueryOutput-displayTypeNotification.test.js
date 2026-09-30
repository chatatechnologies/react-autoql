import React from 'react'
import { mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'

import { QueryOutput as QueryOutputWithoutTheme } from '../QueryOutput'
import testCases from '../../../../test/responseTestCases'

const makeResponse = () => _cloneDeep(testCases[8])

// The parent records this in its own state (ChatContent holds the view state for every
// message), and setting state on another component while this one is rendering is a React
// error - reported as "Cannot update a component while rendering a different component".
describe('telling the parent which display type this answer opened on', () => {
  test('does not report it while the component is still being constructed', () => {
    const onDisplayTypeChange = jest.fn()

    // eslint-disable-next-line no-new
    new QueryOutputWithoutTheme({
      ...QueryOutputWithoutTheme.defaultProps,
      queryResponse: makeResponse(),
      queryFn: () => {},
      onDisplayTypeChange,
    })

    expect(onDisplayTypeChange).not.toHaveBeenCalled()
  })

  test('reports it once mounted', () => {
    const onDisplayTypeChange = jest.fn()

    const output = mount(
      <QueryOutputWithoutTheme
        queryResponse={makeResponse()}
        queryFn={() => {}}
        onDisplayTypeChange={onDisplayTypeChange}
      />,
    )

    expect(onDisplayTypeChange).toHaveBeenCalledWith(output.instance().state.displayType)
  })
})
