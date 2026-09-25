import { RB } from '../constants'
import { LETTER_IN } from '../layout/pageGeometry'
import { waitForFonts } from './fonts'

// Printing copies the rendered pages into an off-screen iframe and prints that document. The host's own
// layout never reaches the printer — no clipped app shell, no host @media print rules, no sidebar — and
// the builder ships no global @page or @media print CSS of its own. X-Frame-Options doesn't apply to srcdoc.

export const PAGE_CLASS = `${RB}-page`

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// CSS can't end a <style> element early: "</style" in a string or comment would.
const escapeStyleText = (css) => String(css).replace(/<\/(style)/gi, '<\\/$1')

const readRules = (sheet) => {
  try {
    const rules = sheet?.cssRules
    if (!rules || !rules.length) {
      return null
    }
    return Array.from(rules)
      .map((rule) => rule.cssText)
      .join('\n')
  } catch (error) {
    return null // a cross-origin sheet can't be read; its <link> is copied instead
  }
}

// Every stylesheet the host document uses, in document order, so the pages cascade as they do on screen.
// A <style> is copied from its CSSOM when it has rules, since CSS-in-JS libraries insert rules there
// without touching the element's text.
export const collectStyleMarkup = (doc = document) => {
  const parts = []
  doc.querySelectorAll('link[rel~="stylesheet"], style').forEach((node) => {
    if (node.sheet?.disabled || node.disabled) {
      return
    }
    const media = node.media ? ` media="${escapeHtml(node.media)}"` : ''
    if (node.tagName === 'LINK') {
      if (node.href) {
        const crossOrigin = node.crossOrigin ? ` crossorigin="${escapeHtml(node.crossOrigin)}"` : ''
        parts.push(`<link rel="stylesheet" href="${escapeHtml(node.href)}"${media}${crossOrigin}>`)
      }
      return
    }
    const css = readRules(node.sheet) ?? node.textContent
    if (css && css.trim()) {
      parts.push(`<style${media}>${escapeStyleText(css)}</style>`)
    }
  })
  ;(doc.adoptedStyleSheets || []).forEach((sheet) => {
    const css = readRules(sheet)
    if (css) {
      parts.push(`<style>${escapeStyleText(css)}</style>`)
    }
  })
  return parts.join('\n')
}

// <html>'s attributes carry the theme: configureTheme() sets the --react-autoql-* variables inline on it,
// and hosts put their theme class or data-theme there.
const htmlAttributes = (doc) =>
  Array.from(doc.documentElement?.attributes || [])
    .map(({ name, value }) => ` ${name}="${escapeHtml(value)}"`)
    .join('')

export const getPrintCss = (orientation = 'portrait') => {
  const landscape = orientation === 'landscape'
  const heightIn = landscape ? LETTER_IN.width : LETTER_IN.height
  return `
@page { size: letter ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
html, body {
  margin: 0 !important; padding: 0 !important; background: #fff !important;
  width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important;
}
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.${RB}-print-root { display: block !important; }
.${PAGE_CLASS} {
  margin: 0 !important; box-shadow: none !important; overflow: hidden !important;
  height: calc(${heightIn}in - 1px) !important;
  break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid;
}
.${PAGE_CLASS}:last-child { break-after: auto; page-break-after: auto; }
`
}

// The whole print document as a string. The print CSS goes last so it wins over anything copied in.
export const buildPrintDocument = ({ doc = document, pagesHtml = '', title = '', orientation = 'portrait' } = {}) =>
  [
    '<!doctype html>',
    `<html${htmlAttributes(doc)}>`,
    '<head>',
    '<meta charset="utf-8">',
    `<base href="${escapeHtml(doc.baseURI)}">`,
    `<title>${escapeHtml(title)}</title>`,
    collectStyleMarkup(doc),
    `<style data-report-print>${getPrintCss(orientation)}</style>`,
    '</head>',
    `<body class="${RB}-print-body"><div class="${RB}-print-root">${pagesHtml}</div></body>`,
    '</html>',
  ].join('\n')

const waitForImages = (frameDoc, timeout) => {
  const pending = Array.from(frameDoc?.images || []).filter((img) => !img.complete)
  if (!pending.length) {
    return Promise.resolve()
  }
  const loads = pending.map(
    (img) =>
      new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true })
        img.addEventListener('error', resolve, { once: true })
      }),
  )
  return Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, timeout))])
}

const defaultPrint = (win) => {
  win.focus()
  win.print()
}

// Prints the given page elements. Returns at once with { frame, remove, printed }: `printed` settles
// when the print dialog has been asked for. The frame stays until the dialog closes (afterprint) or
// remove() is called — some browsers abandon the job if the frame goes while their dialog is open.
export const printFrame = ({
  pages,
  title = '',
  orientation = 'portrait',
  doc = document,
  print = defaultPrint,
  assetTimeout = 5000,
} = {}) => {
  const pagesHtml = Array.from(pages || [])
    .map((page) => page.outerHTML)
    .join('')
  const landscape = orientation === 'landscape'

  const frame = doc.createElement('iframe')
  frame.className = `${RB}-print-frame`
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('tabindex', '-1')
  frame.title = title || 'Report'
  Object.assign(frame.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${landscape ? LETTER_IN.height : LETTER_IN.width}in`,
    height: `${landscape ? LETTER_IN.width : LETTER_IN.height}in`,
    border: '0',
  })

  // Browsers name the saved PDF after the document title; the host's is put back afterwards.
  const hostTitle = doc.title
  let removed = false
  let requested = false
  let settle = () => {}

  const remove = () => {
    if (removed) return
    removed = true
    if (title && doc.title === title) {
      doc.title = hostTitle
    }
    frame.parentNode?.removeChild(frame)
    if (!requested) settle(false) // removed before the dialog was asked for
  }

  const printed = new Promise((resolve, reject) => {
    let settled = false
    settle = (value, error) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve(value)
    }

    frame.addEventListener(
      'load',
      () => {
        const win = frame.contentWindow
        const frameDoc = frame.contentDocument
        Promise.all([waitForImages(frameDoc, assetTimeout), waitForFonts(frameDoc, assetTimeout)])
          .then(() => {
            if (removed) return
            win.addEventListener('afterprint', remove, { once: true })
            if (title) {
              doc.title = title
            }
            // Chrome's print() blocks until its dialog closes and fires afterprint before returning,
            // so the frame may already be gone by the next line; it was still printed.
            requested = true
            print(win)
            settle(true)
          })
          .catch((error) => {
            settle(undefined, error)
            remove()
          })
      },
      { once: true },
    )
  })

  frame.srcdoc = buildPrintDocument({ doc, pagesHtml, title, orientation })
  doc.body.appendChild(frame)

  return { frame, remove, printed }
}
