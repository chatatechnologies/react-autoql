import axios from 'axios'
// todo: set up mock axios for easier edge case handling
// import mockAxios from 'jest-mock-axios'

import {
  runQuery,
  runQueryOnly,
  runQueryValidation,
  fetchAutocomplete,
  reportProblem,
  fetchSuggestions,
  runDrilldown,
  setColumnVisibility,
  fetchExploreQueries,
} from './queryService'

import responseTestCases from '../../test/responseTestCases'
import validationTestCases from '../../test/validationTestCases'
import autocompleteTestCases from '../../test/autocompleteTestCases'
import relatedQueriesTestCases from '../../test/relatedQueriesTestCases'

jest.mock('axios')
// afterEach(() => {
//   mockAxios.reset()
// })

const sampleErrorResponse = {
  response: {
    data: { message: 'there was an error', reference_id: '1.1.1' },
  },
}

const allQueryParams = {
  query: 'List all sales today',
  debug: true,
  test: false,
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
  source: ['data-messenger', 'user'],
}

const allValidationParams = {
  text: 'List all sales today',
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
}

const allReportProblemParams = {
  message: 'there is missing data',
  queryId: 'q284b10238rb',
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
}

const allFetchSuggestionsParams = {
  query: 'List all sales today',
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
}

const allDrilldownParams = {
  queryID: 'q284b10238rb',
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
  groupBys: [
    {
      name: 'Cost',
      value: 55.98,
    },
  ],
}

const colVisibilityParams = {
  columns: [],
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
}

const allRelatedQueriesParams = {
  keywords: 'all sales',
  pageSize: 20,
  pageNumber: 1,
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
  skipQueryValidation: true,
}

describe('runQuery', () => {
  const data = responseTestCases[7]

  test('fetches query data successfully with all params provided except query validation', async () => {
    axios.post.mockImplementationOnce(() => Promise.resolve(data))
    await expect(runQuery(allQueryParams)).resolves.toEqual(data)
  })

  test('returns query data when validation has no suggestions', async () => {
    const input = {
      ...allQueryParams,
      enableQueryValidation: true,
    }

    const validationResponse = {
      data: {
        replacements: [],
        text: 'sales last month',
      },
      message: 'Success',
      reference_id: '1.1.240',
    }

    axios.get.mockImplementationOnce(() => Promise.resolve(validationResponse))
    axios.post.mockImplementationOnce(() => Promise.resolve(data))
    await expect(runQuery(input)).resolves.toEqual(data)
  })

  test('returns validation response when there are suggestions', async () => {
    const input = {
      ...allQueryParams,
      enableQueryValidation: true,
    }

    const validationResponse = validationTestCases[0]

    // todo: this doesnt need to be backwards compatible anymore. It should be simplified
    const restructuredResponse = {
      data: {
        data: {
          text: 'sales for jou',
          replacements: [
            {
              end: 13,
              start: 10,
              suggestions: [
                {
                  text: 'billy joe',
                  value_label: 'Customer',
                },
                {
                  text: 'tommy joe',
                  value_label: 'Customer',
                },
              ],
            },
          ],
        },
        message: 'Success',
        reference_id: '1.1.240',
      },
    }

    axios.get.mockImplementationOnce(() => Promise.resolve(validationResponse))
    await expect(runQuery(input)).resolves.toEqual(restructuredResponse)
  })

  test('throws query error when no query is provided', async () => {
    const input = { ...allQueryParams, query: undefined }
    await expect(runQuery(input)).rejects.toEqual({
      error: 'No query supplied',
    })
  })

  test('throws validation error when enableQueryValidation is true and no query is provided', async () => {
    const input = {
      ...allQueryParams,
      query: undefined,
      enableQueryValidation: true,
    }
    await expect(runQuery(input)).rejects.toThrow('No text supplied')
  })
})

describe('runQueryOnly', () => {
  const data = responseTestCases[7]

  test('fetches query data successfully with all params provided', async () => {
    axios.post.mockImplementationOnce(() => Promise.resolve(data))
    await expect(runQueryOnly(allQueryParams)).resolves.toEqual(data)
  })

  test('throws no query supplied error if no input params are supplied', async () => {
    await expect(runQueryOnly()).rejects.toEqual({
      error: 'No query supplied',
    })
  })

  test('throw unauthenticated error if domain is not supplied', async () => {
    const inputParams = {
      query: 'List all sales today',
      apiKey: 'yourAPIkey',
      token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
    }

    await expect(runQueryOnly(inputParams)).rejects.toEqual({
      error: 'Unauthenticated',
    })
  })

  test('throw unauthenticated error if api key is not supplied', async () => {
    const inputParams = {
      query: 'List all sales today',
      domain: 'https://yourdomain.com',
      token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
    }

    await expect(runQueryOnly(inputParams)).rejects.toEqual({
      error: 'Unauthenticated',
    })
  })

  test('throw unauthenticated error if token is not supplied', async () => {
    const inputParams = {
      query: 'List all sales today',
      domain: 'https://yourdomain.com',
      apiKey: 'yourAPIkey',
    }

    await expect(runQueryOnly(inputParams)).rejects.toEqual({
      error: 'Unauthenticated',
    })
  })

  test('throw error if query is not supplied', async () => {
    const inputParams = {
      token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
      domain: 'https://yourdomain.com',
      apiKey: 'yourAPIkey',
    }

    await expect(runQueryOnly(inputParams)).rejects.toEqual({
      error: 'No query supplied',
    })
  })

  test('throw error if query is just spaces', async () => {
    const inputParams = {
      query: '      ',
      token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
      domain: 'https://yourdomain.com',
      apiKey: 'yourAPIkey',
    }

    await expect(runQueryOnly(inputParams)).rejects.toEqual({
      error: 'No query supplied',
    })
  })

  test('returns parse error is data is a string', async () => {
    axios.post.mockImplementationOnce(() =>
      Promise.resolve({ data: 'this is a string' })
    )
    await expect(runQueryOnly(allQueryParams)).rejects.toEqual({
      error: 'Parse error',
    })
  })

  test('returns authenticated error on 401', async () => {
    axios.post.mockImplementationOnce(() => Promise.reject({ response: 401 }))
    await expect(runQueryOnly(allQueryParams)).rejects.toEqual({
      error: 'Unauthenticated',
    })
  })

  test('returns unauthenticated error if no error details are returned', async () => {
    axios.post.mockImplementationOnce(() => Promise.reject({ response: {} }))
    await expect(runQueryOnly(allQueryParams)).rejects.toEqual({
      error: 'Unauthenticated',
    })
  })

  test('returns unauthenticated error if proper error details are returned', async () => {
    axios.post.mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: { message: 'there was an error', reference_id: '1.1.1' },
        },
      })
    )

    await expect(runQueryOnly(allQueryParams)).rejects.toEqual({
      data: {
        message: 'there was an error',
        reference_id: '1.1.1',
      },
    })
  })

  // test('returns suggestion response if reference ID is 1.1.430', async () => {
  //   axios.post.mockImplementationOnce(() =>
  //     Promise.reject({
  //       response: {
  //         data: { message: 'there was an error', reference_id: '1.1.430' },
  //       },
  //     })
  //   )
  //   axios.get.mockImplementationOnce(() => {
  //     Promise.resolve({ data: { data: { items: ['sugg1, sugg2'] } } })
  //   })

  //   await expect(runQueryOnly(allQueryParams)).resolves.toEqual({
  //     data: { data: { items: ['sugg1, sugg2'] } },
  //   })
  // })
})

describe('runDrilldown', () => {
  const data = responseTestCases[6]

  test('fetches drilldown data with all params provided', async () => {
    axios.post.mockImplementationOnce(() => Promise.resolve(data))
    await expect(runDrilldown(allDrilldownParams)).resolves.toEqual(data)
  })

  test('throws no query id error when query id is not provided', async () => {
    const input = {
      ...allDrilldownParams,
      queryID: undefined,
    }
    await expect(runDrilldown(input)).rejects.toThrow('Query ID not supplied')
  })

  test('throws unauthenticated error when no token is provided', async () => {
    const input = {
      ...allDrilldownParams,
      token: undefined,
    }
    await expect(runDrilldown(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no API key is provided', async () => {
    const input = {
      ...allDrilldownParams,
      apiKey: undefined,
    }
    await expect(runDrilldown(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no domain is provided', async () => {
    const input = {
      ...allDrilldownParams,
      domain: undefined,
    }
    await expect(runDrilldown(input)).rejects.toThrow('Unauthenticated')
  })
})

describe('setColumnVisibility', () => {
  const data = { message: 'Success' }

  test('sets column visibility successfully with all params provided', async () => {
    axios.put.mockImplementationOnce(() => Promise.resolve(data))
    await expect(setColumnVisibility(colVisibilityParams)).resolves.toEqual(
      data
    )
  })

  test('throws unauthenticated error when no params are provided', async () => {
    await expect(setColumnVisibility()).rejects.toThrow('Unauthenticated')
  })

  test('doesnt crash if call fails', async () => {
    axios.put.mockImplementationOnce(() =>
      Promise.reject({ response: { data: { message: 'an error occurred' } } })
    )
    await expect(setColumnVisibility(colVisibilityParams)).rejects.toEqual({
      message: 'an error occurred',
    })
  })
})

describe('queryValidation', () => {
  const data = validationTestCases[0]

  test('fetches validation data successfully with all params provided', async () => {
    axios.get.mockImplementationOnce(() => Promise.resolve(data))
    await expect(runQueryValidation(allValidationParams)).resolves.toEqual(data)
  })

  test('throws no query supplied error if no input params are supplied', async () => {
    await expect(runQueryValidation()).rejects.toThrow('No text supplied')
  })

  test('throws unauthenticated error when no token is provided', async () => {
    const input = { ...allValidationParams, token: undefined }
    await expect(runQueryValidation(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no API key is provided', async () => {
    const input = { ...allValidationParams, apiKey: undefined }
    await expect(runQueryValidation(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no domain is provided', async () => {
    const input = { ...allValidationParams, domain: undefined }
    await expect(runQueryValidation(input)).rejects.toThrow('Unauthenticated')
  })
})

describe('fetchAutocomplete', () => {
  const allAutocompleteParams = {
    suggestion: 'all ',
    domain: 'https://yourdomain.com',
    apiKey: 'yourAPIkey',
    token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
  }

  const data = autocompleteTestCases[0]

  test('fetches autocomplete data successfully with all params provided', async () => {
    axios.get.mockImplementationOnce(() => Promise.resolve(data))
    await expect(fetchAutocomplete(allAutocompleteParams)).resolves.toEqual(
      data
    )
  })

  test('throws no query supplied error if no input params are supplied', async () => {
    await expect(fetchAutocomplete()).rejects.toThrow('No query supplied')
  })

  test('throws unauthenticated error when no token is provided', async () => {
    const input = { ...allAutocompleteParams, token: undefined }
    await expect(fetchAutocomplete(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no API key is provided', async () => {
    const input = { ...allAutocompleteParams, apiKey: undefined }
    await expect(fetchAutocomplete(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no domain is provided', async () => {
    const input = { ...allAutocompleteParams, domain: undefined }
    await expect(fetchAutocomplete(input)).rejects.toThrow('Unauthenticated')
  })

  // Use mock axios to test this case   // Use mock axios to test this case
  // test('cancels previous autocomplete call if new one was made', async () => {
  //   const cancelFn = jest.fn()
  //   fetchAutocomplete(allAutocompleteParams).then(cancelFn)
  //   mockAxios.mockResponse(data)
  //   mockAxios.mockResponse(data)
  //   setImmediate(() => {
  //     expect(cancelFn).toHaveBeenCalledTimes(1)
  //   })
  // })
})

describe('reportProblem', () => {
  const data = { message: 'Success' }

  test('reports successfully with all params provided', async () => {
    axios.put.mockImplementationOnce(() => Promise.resolve(data))
    await expect(reportProblem(allReportProblemParams)).resolves.toEqual(data)
  })

  test('doesnt crash if call fails', async () => {
    axios.put.mockImplementationOnce(() => Promise.reject(sampleErrorResponse))
    await expect(reportProblem(allReportProblemParams)).rejects.toEqual(
      sampleErrorResponse.response.data
    )
  })

  test('reports successfully with no message provided', async () => {
    axios.put.mockImplementationOnce(() => Promise.resolve(data))
    const input = { ...allReportProblemParams, message: undefined }
    await expect(reportProblem(input)).resolves.toEqual(data)
  })

  test('throws no query ID supplied error if no query ID is supplied', async () => {
    const input = { ...allReportProblemParams, queryId: undefined }
    await expect(reportProblem(input)).rejects.toThrow('No query ID supplied')
  })

  test('throws unauthenticated error when no token is provided', async () => {
    const input = { ...allReportProblemParams, token: undefined }
    await expect(reportProblem(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no API key is provided', async () => {
    const input = { ...allReportProblemParams, apiKey: undefined }
    await expect(reportProblem(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no domain is provided', async () => {
    const input = { ...allReportProblemParams, domain: undefined }
    await expect(reportProblem(input)).rejects.toThrow('Unauthenticated')
  })
})

describe('fetchSuggestions', () => {
  const data = { message: 'Success', data: ['', '', ''] }

  test('fetches suggestions successfully with all params provided', async () => {
    axios.get.mockImplementationOnce(() => Promise.resolve(data))
    await expect(fetchSuggestions(allFetchSuggestionsParams)).resolves.toEqual(
      data
    )
  })

  test('throws unauthenticated error if no params provided', async () => {
    await expect(fetchSuggestions()).rejects.toThrow('No query supplied')
  })

  test('throws no query supplied error when no query is supplied', async () => {
    const input = { ...allFetchSuggestionsParams, query: undefined }
    await expect(fetchSuggestions(input)).rejects.toThrow('No query supplied')
  })

  test('doesnt crash if query is not a string', async () => {
    const input = {
      ...allFetchSuggestionsParams,
      query: { something: 'something' },
    }
    axios.get.mockImplementationOnce(() => Promise.resolve(data))
    await expect(fetchSuggestions(input)).resolves.toEqual(data)
  })

  test('throws unauthenticated error when no token is provided', async () => {
    const input = { ...allFetchSuggestionsParams, token: undefined }
    await expect(fetchSuggestions(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no API key is provided', async () => {
    const input = { ...allFetchSuggestionsParams, apiKey: undefined }
    await expect(fetchSuggestions(input)).rejects.toThrow('Unauthenticated')
  })

  test('throws unauthenticated error when no domain is provided', async () => {
    const input = { ...allFetchSuggestionsParams, domain: undefined }
    await expect(fetchSuggestions(input)).rejects.toThrow('Unauthenticated')
  })
})

describe('fetchExploreQueries', () => {
  const data = relatedQueriesTestCases[0]

  test('fetches related queries successfully with all params provided', async () => {
    axios.get.mockImplementationOnce(() => Promise.resolve(data))
    await expect(fetchExploreQueries(allRelatedQueriesParams)).resolves.toEqual(
      data
    )
  })

  test('throws unauthenticated error if no params provided', async () => {
    await expect(fetchExploreQueries()).rejects.toThrow('Unauthenticated')
  })

  test('fetches validation response when skipQueryValidation is false', async () => {
    const input = {
      ...allRelatedQueriesParams,
      skipQueryValidation: false,
    }

    axios.get.mockImplementationOnce(() =>
      Promise.resolve(validationTestCases[0])
    )
    await expect(fetchExploreQueries(input)).resolves.toEqual(
      validationTestCases[0]
    )
  })

  test('fetches correctly when validation suggestions are empty', async () => {
    const input = {
      ...allRelatedQueriesParams,
      skipQueryValidation: false,
    }

    axios.get.mockImplementationOnce(() => Promise.resolve(data))
    await expect(fetchExploreQueries(allRelatedQueriesParams)).resolves.toEqual(
      data
    )
  })

  test('doesnt crash if call fails', async () => {
    axios.get.mockImplementationOnce(() =>
      Promise.reject({ response: { data: { message: 'an error occurred' } } })
    )
    await expect(fetchExploreQueries(allRelatedQueriesParams)).rejects.toEqual({
      message: 'an error occurred',
    })
  })
})
