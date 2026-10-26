import axios from 'axios'
import {
  brandFontFaceCss,
  brandingFromApi,
  brandingToApi,
  mergeBranding,
  normalizeBranding,
  paperFontFamilies,
  paperFontStyle,
  parseColour,
  sameBrandFonts,
} from '../model/branding'
import { clearBrandingCache, fetchBranding, saveBranding } from '../run/brandingApi'

jest.mock('axios')

const AUTH = { domain: 'https://example.test', apiKey: 'k 1', token: 't' }
const FONT = 'data:font/woff2;base64,d09GMgABAAAAAA=='

describe('brand colours', () => {
  it('reads HEX and RGB in the forms people type them', () => {
    expect(parseColour('#1B4D8F')).toBe('#1b4d8f')
    expect(parseColour('1b4d8f')).toBe('#1b4d8f')
    expect(parseColour('#fa0')).toBe('#ffaa00')
    expect(parseColour('rgb(27, 77, 143)')).toBe('#1b4d8f')
    expect(parseColour('27, 77, 143')).toBe('#1b4d8f')
    expect(parseColour(' 27 77 143 ')).toBe('#1b4d8f')
    ;['', 'blue', '#12345', '256, 0, 0', 'rgb(1, 2)'].forEach((text) => expect(parseColour(text)).toBeNull())
  })
})

describe('the branding the pages draw', () => {
  it('sits on the left unless told otherwise, and keeps six distinct colours', () => {
    const colors = ['#111', '#111111', 'teal', '#222', '#333', '#444', '#555', '#666', '#777']
    expect(normalizeBranding({ name: 'Acme', colors })).toMatchObject({
      name: 'Acme',
      position: 'left',
      colors: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'],
    })
    // There's no initials badge, so a colour of its own isn't kept.
    expect(normalizeBranding({ name: 'Acme', color: '#26A7DF' })).not.toHaveProperty('color')
  })

  it('takes what the organisation set over the host’s, and the host’s for the rest', () => {
    const host = { name: 'TestFirm' }
    expect(mergeBranding(host, {})).toMatchObject({ name: 'TestFirm', colors: [] })
    expect(mergeBranding(host, { name: 'Acme Wealth', colors: ['#0bbfad'], position: 'center' })).toMatchObject({
      name: 'Acme Wealth',
      colors: ['#0bbfad'],
      position: 'center',
    })
    expect(mergeBranding(host, { name: '' }).name).toBe('TestFirm')
  })

  it('maps AutoQL’s snake_case and back, clearing what’s left out', () => {
    const api = {
      name: 'Acme',
      logo: 'data:image/png;base64,AA',
      wordmark: null,
      position: 'right',
      colors: ['#0BBFAD'],
      heading_font: { name: 'Acme Sans', data: FONT },
      body_font: null,
    }
    const branding = brandingFromApi(api)
    expect(branding).toEqual({
      name: 'Acme',
      logoUrl: 'data:image/png;base64,AA',
      position: 'right',
      colors: ['#0bbfad'],
      headingFont: { name: 'Acme Sans', url: FONT },
    })
    expect(brandingToApi(branding)).toEqual({
      name: 'Acme',
      logo: 'data:image/png;base64,AA',
      wordmark: null,
      position: 'right',
      colors: ['#0bbfad'],
      heading_font: { name: 'Acme Sans', data: FONT },
      body_font: null,
    })
    expect(brandingFromApi(null)).toEqual({})
  })
})

describe('the organisation’s fonts', () => {
  it('are written as @font-face rules, base64 data: URLs only', () => {
    const css = brandFontFaceCss({
      headingFont: { url: FONT },
      bodyFont: { url: 'https://elsewhere.test/x.woff2")}</style>' },
    })
    expect(css).toBe(
      `@font-face{font-family:'react-autoql-brand-heading';src:url("${FONT}") format('woff2');font-display:block;}`,
    )
    expect(brandFontFaceCss({})).toBe('')
  })

  it('set a report on the theme’s typeface, and leave a typeface chosen by name alone', () => {
    const branding = { headingFont: { url: FONT }, bodyFont: { url: FONT } }
    expect(paperFontStyle({ typeface: 'theme' }, branding)).toEqual({
      '--react-autoql-report-builder-body-font': expect.stringMatching(/^'react-autoql-brand-body', /),
      '--react-autoql-report-builder-heading-font': expect.stringMatching(/^'react-autoql-brand-heading', /),
    })
    expect(paperFontStyle({ typeface: 'newsreader' }, branding)).toEqual({
      fontFamily: expect.stringContaining('Newsreader'),
    })
    expect(paperFontStyle({ typeface: 'theme' }, {})).toBeUndefined()
    expect(paperFontFamilies({ typeface: 'theme' }, { bodyFont: { url: FONT } })).toEqual(["'react-autoql-brand-body'"])
    expect(sameBrandFonts(branding, { ...branding })).toBe(true)
    expect(sameBrandFonts(branding, { bodyFont: branding.bodyFont })).toBe(false)
  })
})

describe('AutoQL’s branding endpoints', () => {
  beforeEach(() => {
    clearBrandingCache()
    axios.get.mockReset()
    axios.put.mockReset()
  })

  it('reads the branding once per token, with the API key and the token', async () => {
    axios.get.mockResolvedValue({
      data: { reference_id: '1.1.200', message: 'Success', data: { name: 'Acme', colors: ['#0bbfad'] } },
    })
    await expect(fetchBranding({ authentication: AUTH })).resolves.toEqual({ name: 'Acme', colors: ['#0bbfad'] })
    await fetchBranding({ authentication: AUTH })
    expect(axios.get).toHaveBeenCalledTimes(1)
    const [url, config] = axios.get.mock.calls[0]
    expect(url).toBe('https://example.test/autoql/api/v1/reports/branding?key=k%201')
    expect(config.headers.Authorization).toBe('Bearer t')

    await fetchBranding({ authentication: { ...AUTH, token: 't2' } })
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('reads it once per data source, whatever tokens are minted meanwhile, and keeps the last few', async () => {
    const b64url = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const authFor = (project, n) => ({ ...AUTH, token: `h.${b64url({ project_id: project, n })}.s` })
    axios.get.mockResolvedValue({ data: { data: { name: 'Acme' } } })
    await fetchBranding({ authentication: authFor('p1', 1) })
    // The host re-minted the token for the same data source: what was read is kept.
    await fetchBranding({ authentication: authFor('p1', 2) })
    expect(axios.get).toHaveBeenCalledTimes(1)
    expect(axios.get.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${authFor('p1', 1).token}`)

    // Another data source asks; past four, the one used longest ago is let go.
    for (const project of ['p2', 'p3', 'p4', 'p5']) {
      await fetchBranding({ authentication: authFor(project, 1) })
    }
    expect(axios.get).toHaveBeenCalledTimes(5)
    await fetchBranding({ authentication: authFor('p5', 3) })
    expect(axios.get).toHaveBeenCalledTimes(5)
    await fetchBranding({ authentication: authFor('p1', 3) })
    expect(axios.get).toHaveBeenCalledTimes(6)
  })

  it('asks again after a failure, and not at all without a token', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 404 } })
    await expect(fetchBranding({ authentication: AUTH })).rejects.toBeTruthy()
    axios.get.mockResolvedValueOnce({ data: { data: {} } })
    await expect(fetchBranding({ authentication: AUTH })).resolves.toEqual({})
    await expect(fetchBranding({ authentication: { domain: 'https://example.test' } })).rejects.toBeTruthy()
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('saves the whole of it through the management API, and keeps what was stored', async () => {
    axios.put.mockResolvedValue({ data: { data: { name: 'Acme', position: 'center', colors: ['#0bbfad'] } } })
    const saved = await saveBranding({
      authentication: AUTH,
      branding: { name: 'Acme', position: 'center', colors: ['#0BBFAD'] },
    })
    expect(saved).toEqual({ name: 'Acme', position: 'center', colors: ['#0bbfad'] })
    const [url, body, config] = axios.put.mock.calls[0]
    expect(url).toBe('https://example.test/autoql/management/api/v1/reports/branding?key=k%201')
    expect(body).toEqual({
      name: 'Acme',
      logo: null,
      wordmark: null,
      position: 'center',
      colors: ['#0bbfad'],
      heading_font: null,
      body_font: null,
    })
    expect(config.headers.Authorization).toBe('Bearer t')
    // The next builder reads what was saved without asking.
    await expect(fetchBranding({ authentication: AUTH })).resolves.toEqual(saved)
    expect(axios.get).not.toHaveBeenCalled()
  })
})
