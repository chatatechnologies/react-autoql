import React from 'react'
import { mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'

import { QueryOutput as QueryOutputWithoutTheme } from '../QueryOutput'
import testCases from '../../../../test/responseTestCases'

// A response with enough rows and columns to support both a table and a chart.
const makeResponse = () => _cloneDeep(testCases[8])

const mountOutput = (props = {}) =>
  mount(<QueryOutputWithoutTheme queryResponse={makeResponse()} queryFn={() => {}} {...props} />)

describe('an answer whose rows have been dropped to a preview', () => {
  // The first version of this crashed on mount: isDataTruncated read this.state, but
  // getDataLength calls it while the constructor is still deciding the initial display
  // type - before state exists.
  test('mounts without touching state before it exists', () => {
    expect(() => mountOutput({ dataTruncated: { droppedRowCount: 4512 } })).not.toThrow()
  })

  // Judging the supported display types on ten rows would quietly move a message off
  // the chart the user left it on, then strand it there once the data came back.
  test('reports the dropped row count, not the preview length, so display types stay stable', () => {
    const truncated = makeResponse()
    const droppedRowCount = truncated.data.data.rows.length
    truncated.data.data.rows = truncated.data.data.rows.slice(0, 2)

    const output = mount(
      <QueryOutputWithoutTheme queryResponse={truncated} queryFn={() => {}} dataTruncated={{ droppedRowCount }} />,
    )

    expect(output.instance().getDataLength()).toBe(droppedRowCount)
  })

  test('reports the preview length once the data is back', () => {
    const output = mountOutput({ dataTruncated: { droppedRowCount: 4512 } })
    output.setState({ isDataRestored: true })

    expect(output.instance().getDataLength()).toBe(output.instance().tableData.length)
  })

  test('is not truncated when the prop is absent', () => {
    expect(mountOutput().instance().isDataTruncated()).toBe(false)
  })

  // Once the rows are a preview, rows.length < count_rows is true of every answer - so
  // the usual test would report answers as limited that never were, changing which
  // display types they support and adding a row-limit warning underneath them.
  test('keeps the data-limited reading taken before the rows went', () => {
    expect(mountOutput({ dataTruncated: { wasDataLimited: false } }).instance().getIsDataLimited()).toBe(false)
    expect(mountOutput({ dataTruncated: { wasDataLimited: true } }).instance().getIsDataLimited()).toBe(true)
  })

  // These read the rows on screen, which while truncated are only a preview - handing
  // ten rows back as the whole answer would be worse than refusing.
  test('refuses the actions that would export a preview as if it were the answer', () => {
    const output = mountOutput({ dataTruncated: { droppedRowCount: 4512 } })

    expect(output.instance().getBase64Data()).toBeUndefined()
    // False rather than undefined: the toolbar reports a successful copy off this
    // return value, so a refusal has to be distinguishable from a copy.
    expect(output.instance().copyTableToClipboard()).toBe(false)
  })

  // Filtering is answered from the rows the table is holding, which are the preview.
  test('refuses to open the table filters', () => {
    const output = mountOutput({ dataTruncated: { droppedRowCount: 4512 } })
    const toggleIsFiltering = jest.fn()
    output.instance().tableRef = { _isMounted: true, toggleIsFiltering }
    output.setState({ displayType: 'table' })

    output.instance().toggleTableFilter(true)

    expect(toggleIsFiltering).not.toHaveBeenCalled()
  })

  // The add-column button is positioned against the top of the message, not the top of
  // the table, so the banner pushes the header out from under it. The class is how the
  // stylesheet knows to move it down (see AddColumnBtn.scss).
  test('marks the container so the add-column button can follow the table down', () => {
    const hasMarker = (props) => {
      const output = mountOutput(props)
      output.setState({ displayType: 'table' })
      return output.find('.react-autoql-response-content-container').first().hasClass('has-truncated-banner')
    }

    expect(hasMarker({ dataTruncated: { droppedRowCount: 4512 } })).toBe(true)
    expect(hasMarker()).toBe(false)
  })

  test('drops the marker for a charted message, which gets the card instead', () => {
    const output = mountOutput({ dataTruncated: { droppedRowCount: 4512 } })
    output.setState({ displayType: 'column' })

    expect(output.find('.react-autoql-response-content-container').first().hasClass('has-truncated-banner')).toBe(false)
  })

  // Cancelling resolves with the rows already on screen - the preview. Treating that as
  // a restore cleared the banner and left the real rows unreachable.
  test('does not mark the data restored when the request was cancelled', async () => {
    const output = mountOutput({ dataTruncated: { droppedRowCount: 4512 } })
    const instance = output.instance()
    const onRestoreData = jest.fn()
    output.setProps({ onRestoreData })

    instance.queryFn = async () => {
      instance.wasQueryFnCancelled = true
      return instance.queryResponse
    }

    await instance.restoreTruncatedData()

    expect(onRestoreData).not.toHaveBeenCalled()
    expect(instance.state.isDataRestored).toBe(false)
    expect(instance.isDataTruncated()).toBe(true)
    // Nothing failed, so nothing to report - the notice is left as it was.
    expect(instance.state.restoreError).toBeFalsy()
  })

  test('marks the data restored when the request lands', async () => {
    const output = mountOutput({ dataTruncated: { droppedRowCount: 4512 } })
    const instance = output.instance()
    const onRestoreData = jest.fn()
    output.setProps({ onRestoreData })

    const full = makeResponse()
    instance.queryFn = async () => full

    await instance.restoreTruncatedData()

    expect(onRestoreData).toHaveBeenCalledWith(full)
    expect(instance.state.isDataRestored).toBe(true)
    expect(instance.isDataTruncated()).toBe(false)
  })
})
