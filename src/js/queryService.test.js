import axios from 'axios'
import { runQuery, runQueryOnly, runSafetyNet } from './queryService'
import responseTestCases from '../../test/responseTestCases'
import validationTestCases from '../../test/validationTestCases'

jest.mock('axios')

const completeQueryParams = {
  query: 'List all sales today',
  debug: true,
  test: false,
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
  source: 'data-messenger',
}

const completeValidationParams = {
  text: 'List all sales today',
  domain: 'https://yourdomain.com',
  apiKey: 'yourAPIkey',
  token: 'FH9W83FH23UHRSKFJ9UH2FONFOR5IJEJRG',
}

describe('runQueryOnly', () => {
  const data = responseTestCases[8]
  axios.post.mockImplementationOnce(() => Promise.resolve(data))

  test('fetches query data successfully with all params provided', async () => {
    await expect(runQueryOnly(completeQueryParams)).resolves.toEqual(data)
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
})

describe('safetyNet', () => {
  const data = validationTestCases[0]
  axios.get.mockImplementationOnce(() => Promise.resolve(data))

  test('fetches query data successfully with all params provided', async () => {
    await expect(runSafetyNet(completeValidationParams)).resolves.toEqual(data)
  })
})
