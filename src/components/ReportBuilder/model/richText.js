import { Extension, generateHTML } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { Markdown, MarkdownManager } from '@tiptap/markdown'
import { prepareEditorRuntime } from './editorRuntime'

// A report's text as it can be formatted (RW-346), as Jira's editor formats it: bold, italic, underline and
// strikethrough, links, bulleted and numbered lists, and headings within the text. Text blocks and an
// analysis's wording are kept as Markdown (underline as ++text++), edited with ProseMirror (TipTap), and drawn
// on the page from the same schema, so what's edited is what prints. Plain text reads as it always did; a
// single line break is a line break.

// What `marked` reads the Markdown with: GitHub's flavour (~~strikethrough~~), and a single line break kept.
const MARKED_OPTIONS = { breaks: true, gfm: true }

// The link a pasted or typed address becomes; only web and mail links.
export const LINK_PROTOCOLS = ['http', 'https', 'mailto']

// ⌘K / Ctrl+K asks the formatting bar for a link; the bar listens for this.
export const LINK_REQUEST_EVENT = 'react-autoql-link-request'

const LinkShortcut = Extension.create({
  name: 'reactAutoqlLinkShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        this.editor.emit(LINK_REQUEST_EVENT)
        return true
      },
    }
  },
})

// The order formatting is written in, outermost first (the schema's mark order: a higher priority is further
// out), so that formatting which starts or ends inside a word comes back. Markdown reads ++ anywhere, ** and *
// beside ~~ but not beside ++, and ~~ only against the letters: underline goes outside, then bold and italic,
// then strikethrough. "revie++**~~w" comes back formatted, where "revie**++w" came back as asterisks.
const MARK_PRIORITY = { underline: 102, strike: 99 }

const OrderedStarterKit = StarterKit.extend({
  addExtensions() {
    return this.parent().map((extension) =>
      MARK_PRIORITY[extension.name] ? extension.extend({ priority: MARK_PRIORITY[extension.name] }) : extension,
    )
  },
})

// The schema and its Markdown: everything a report's text can hold. `placeholder` is shown in an empty editor.
export const richTextExtensions = ({ placeholder } = {}) => {
  prepareEditorRuntime()
  return [
    OrderedStarterKit.configure({
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        protocols: LINK_PROTOCOLS,
      },
    }),
    Markdown.configure({ markedOptions: MARKED_OPTIONS }),
    LinkShortcut,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ]
}

// What the page's HTML is drawn with, made when a report's text is first drawn rather than when the package loads:
// an app that never shows a report never sets the editor up.
let staticExtensions = null
const pageExtensions = () => {
  if (!staticExtensions) {
    staticExtensions = richTextExtensions()
  }
  return staticExtensions
}

let manager = null
const markdownManager = () => {
  if (!manager) {
    manager = new MarkdownManager({ extensions: pageExtensions(), markedOptions: MARKED_OPTIONS })
  }
  return manager
}

const textOf = (markdown) => (typeof markdown === 'string' ? markdown : '')

// The page's HTML for some Markdown, built from the editor's own schema, so nothing outside it (raw HTML,
// scripts, a javascript: link) gets through. Kept for the page's life: the same text is drawn on the sheet,
// measured and printed.
const htmlCache = new Map()
const HTML_CACHE_MAX = 300

export const richTextHtml = (markdown) => {
  const text = textOf(markdown)
  if (!text) {
    return ''
  }
  let html = htmlCache.get(text)
  if (html === undefined) {
    html = generateHTML(markdownManager().parse(text), pageExtensions())
    if (htmlCache.size >= HTML_CACHE_MAX) {
      htmlCache.clear()
    }
    htmlCache.set(text, html)
  }
  return html
}

// A text taller than a page goes on over the next (layout/paginate): it breaks between its pieces, each block of
// it (a paragraph, a heading) and each item of a list. In order: { node } for a block, { list, node, index } for
// a list item, `list` being its list and `index` its place in it. The page's HTML has the same pieces: the root's
// children, a list's items in place of the list (layout/measure).
const LIST_TYPES = ['bulletList', 'orderedList']
const chunkCache = new Map()

const chunksOf = (text) => {
  let chunks = chunkCache.get(text)
  if (chunks === undefined) {
    chunks = []
    ;(markdownManager().parse(text).content || []).forEach((node) => {
      if (LIST_TYPES.includes(node.type)) {
        ;(node.content || []).forEach((item, index) => chunks.push({ list: node, node: item, index }))
      } else {
        chunks.push({ node })
      }
    })
    if (chunkCache.size >= HTML_CACHE_MAX) {
      chunkCache.clear()
    }
    chunkCache.set(text, chunks)
  }
  return chunks
}

const plainTextOf = (node) =>
  node.type === 'text'
    ? node.text || ''
    : (node.content || []).map(plainTextOf).join(node.type === 'paragraph' ? '' : '\n')

// Each piece's words, for estimating heights where nothing can be measured, and whether it's a heading (which
// goes on to the next page with what follows it).
export const richTextPieces = (markdown) => {
  const text = textOf(markdown)
  return text
    ? chunksOf(text).map((chunk) => ({ text: plainTextOf(chunk.node), heading: chunk.node.type === 'heading' }))
    : []
}

const sliceCache = new Map()

// The page's HTML for pieces `from` to `to` (not included) of some Markdown: one page's share of a text split
// across pages. A list cut in two goes on as the same list, a numbered one counting on from where it stopped.
export const richTextSliceHtml = (markdown, from, to) => {
  const text = textOf(markdown)
  if (!text) {
    return ''
  }
  const key = `${from}:${to}\u0000${text}`
  let html = sliceCache.get(key)
  if (html === undefined) {
    const content = []
    let open = null
    chunksOf(text)
      .slice(from, to)
      .forEach((chunk) => {
        if (!chunk.list) {
          open = null
          content.push(chunk.node)
          return
        }
        if (!open || open.list !== chunk.list) {
          const attrs =
            chunk.list.type === 'orderedList'
              ? { ...chunk.list.attrs, start: (chunk.list.attrs?.start ?? 1) + chunk.index }
              : chunk.list.attrs
          open = { list: chunk.list, node: { ...chunk.list, attrs, content: [] } }
          content.push(open.node)
        }
        open.node.content.push(chunk.node)
      })
    html = content.length ? generateHTML({ type: 'doc', content }, pageExtensions()) : ''
    if (sliceCache.size >= HTML_CACHE_MAX) {
      sliceCache.clear()
    }
    sliceCache.set(key, html)
  }
  return html
}

const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/
// Another scheme (javascript:, ftp:), but not an address with a port (example.com:8080).
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i
const DOMAIN = /^[^\s.]+(\.[^\s.]+)+$/

// A link as typed in the formatting bar: an address gets https://, an email address mailto:. Anything else
// (javascript: and the like) isn't a link, and gives null.
export const linkHref = (input) => {
  const text = String(input ?? '').trim()
  if (!text) {
    return null
  }
  if (/^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(text)) {
    return text
  }
  if (EMAIL.test(text)) {
    return `mailto:${text}`
  }
  if (OTHER_SCHEME.test(text)) {
    return null
  }
  return DOMAIN.test(text) ? `https://${text}` : null
}
