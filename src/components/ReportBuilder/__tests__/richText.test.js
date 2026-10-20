import { Editor } from '@tiptap/core'
import { linkHref, richTextExtensions, richTextHtml } from '../model/richText'

// A report's formatted text (RW-346): Markdown in, the page's HTML out, and back to Markdown from the editor.

const html = (markdown) => {
  const host = document.createElement('div')
  host.innerHTML = richTextHtml(markdown)
  return host
}

// What the editor makes of some Markdown, and what it keeps.
const roundTrip = (markdown) => {
  const editor = new Editor({ extensions: richTextExtensions(), content: markdown, contentType: 'markdown' })
  const out = editor.getMarkdown()
  editor.destroy()
  return out
}

describe('richTextHtml', () => {
  it('draws the formatting: bold, italic, underline, strikethrough and links', () => {
    const page = html('**Bold**, *italic*, ++under++, ~~gone~~ and [the site](https://example.com).')
    expect(page.querySelector('strong').textContent).toBe('Bold')
    expect(page.querySelector('em').textContent).toBe('italic')
    expect(page.querySelector('u').textContent).toBe('under')
    expect(page.querySelector('s').textContent).toBe('gone')
    const link = page.querySelector('a')
    expect(link.getAttribute('href')).toBe('https://example.com')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('draws lists and headings, and keeps a single line break', () => {
    const page = html('### Key points\n\nFirst line\nsecond line\n\n- one\n- two\n\n1. first\n2. second\n\n#### Detail')
    expect(page.querySelector('h3').textContent).toBe('Key points')
    expect(page.querySelector('h4').textContent).toBe('Detail')
    expect(page.querySelector('p br')).not.toBeNull()
    expect([...page.querySelectorAll('ul li')].map((li) => li.textContent)).toStrictEqual(['one', 'two'])
    expect([...page.querySelectorAll('ol li')].map((li) => li.textContent)).toStrictEqual(['first', 'second'])
  })

  it('reads plain text as typed', () => {
    const page = html('Fees_2026_Q3 rose 3 * 2 points.\nSee below.')
    expect(page.textContent).toBe('Fees_2026_Q3 rose 3 * 2 points.See below.')
    expect(page.querySelector('em, strong')).toBeNull()
    expect(page.querySelectorAll('br')).toHaveLength(1)
  })

  it('lets nothing through but the formatting: no raw HTML, no javascript: links', () => {
    const page = html('Hi <script>alert(1)</script><img src=x onerror=alert(1)> [bad](javascript:alert(1))')
    expect(page.querySelector('script, img')).toBeNull()
    expect(page.querySelector('a')?.getAttribute('href') || '').not.toMatch(/javascript/i)
  })

  it('draws nothing for no text', () => {
    expect(richTextHtml('')).toBe('')
    expect(richTextHtml(undefined)).toBe('')
  })
})

describe('the editor’s Markdown', () => {
  it('keeps every kind of formatting as it was written', () => {
    const markdown =
      '### Heading\n\n**Bold** *italic* ++under++ ~~strike~~ [link](https://example.com)\n\n- one\n- two\n\n1. first\n2. second'
    expect(roundTrip(markdown)).toBe(markdown)
  })

  it('keeps a single line break as one', () => {
    expect(roundTrip('One\nTwo')).toBe('One  \nTwo')
    expect(richTextHtml(roundTrip('One\nTwo'))).toBe(richTextHtml('One\nTwo'))
  })

  // Formatting from the middle of one word to the middle of another, with any mix of the bar's buttons, as
  // someone selects and formats: it used to come back as "revie**++w" in plain asterisks (bold and underline).
  it('keeps formatting that starts and ends inside a word, with any mix of marks', () => {
    const text = 'This review summarises the holding today.'
    const from = 1 + text.indexOf('review') + 5 // before the "w"
    const to = 1 + text.indexOf('holding') + 5 // before the "ng"
    const marksOn = (editor, word) => {
      let names = null
      editor.state.doc.descendants((node) => {
        if (names === null && node.isText && node.text.includes(word)) names = node.marks.map((m) => m.type.name)
      })
      return (names || []).sort()
    }
    const toggles = { bold: 'toggleBold', italic: 'toggleItalic', underline: 'toggleUnderline', strike: 'toggleStrike' }
    const names = Object.keys(toggles)
    for (let mask = 1; mask < 1 << names.length; mask++) {
      const mix = names.filter((name, index) => mask & (1 << index))
      const editor = new Editor({ extensions: richTextExtensions(), content: text, contentType: 'markdown' })
      mix.reduce((chain, name) => chain[toggles[name]](), editor.chain().setTextSelection({ from, to })).run()
      const markdown = editor.getMarkdown()
      editor.destroy()

      const reloaded = new Editor({ extensions: richTextExtensions(), content: markdown, contentType: 'markdown' })
      expect({ mix, text: reloaded.state.doc.textContent }).toStrictEqual({ mix, text })
      expect({ mix, marks: marksOn(reloaded, 'summarises') }).toStrictEqual({ mix, marks: [...mix].sort() })
      expect({ mix, before: marksOn(reloaded, 'revie') }).toStrictEqual({ mix, before: [] })
      reloaded.destroy()
    }
  })
})

describe('linkHref', () => {
  it('takes a web or mail address as it is, and makes one of an address without its scheme', () => {
    expect(linkHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(linkHref('  http://x.test ')).toBe('http://x.test')
    expect(linkHref('mailto:pat@example.com')).toBe('mailto:pat@example.com')
    expect(linkHref('pat@example.com')).toBe('mailto:pat@example.com')
    expect(linkHref('www.example.com/path')).toBe('https://www.example.com/path')
    expect(linkHref('example.com:8080/x')).toBe('https://example.com:8080/x')
  })

  it('turns down what isn’t a link', () => {
    ;['', '   ', 'javascript:alert(1)', 'ftp://files.test', 'not a link', 'word'].forEach((text) =>
      expect(linkHref(text)).toBeNull(),
    )
  })
})
