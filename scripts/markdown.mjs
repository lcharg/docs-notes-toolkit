import fs from 'node:fs'
import path from 'node:path'

/** Keep source line positions while omitting fenced and inline code. */
export function maskCode(text) {
  let fence = null
  return text.split('\n').map(line => {
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`).test(line)) fence = null
      return ' '.repeat(line.length)
    }
    if (open) { fence = { char: open[1][0], length: open[1].length }; return ' '.repeat(line.length) }
    return line.replace(/(`+)(.*?)\1/g, value => ' '.repeat(value.length))
  }).join('\n')
}
const htmlNames = new Set('a abbr address area article aside audio b base bdi bdo blockquote body br button caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr'.split(' '))
/** Explicit template notation and non-HTML angle placeholders are not finished documentation. */
export function hasPlaceholder(text) {
  if (/\{\{[^}\n]+\}\}/.test(text)) return true
  const prose = maskCode(text).replace(/<!--[\s\S]*?-->/g, '').replace(/\]\(<[^>]+>\)/g, '](target)')
  return [...prose.matchAll(/<([^>\n]+)>/g)].some(([, value]) => {
    if (/^(?:https?:\/\/|mailto:)/i.test(value) || /^[^\s<>@]+@[^\s<>@]+$/.test(value)) return false
    const name = /^\/?([a-z][a-z0-9-]*)(?:\s|\/?$)/i.exec(value)?.[1]?.toLowerCase()
    return !name || !htmlNames.has(name)
  })
}
function slug(text) { return text.toLowerCase().trim().replace(/<[^>]*>/g, '').replace(/[`*_~]/g, '').replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, '-') }
/** ATX headings, repeated heading suffixes and explicit HTML anchors. */
export function anchors(text) {
  const masked = maskCode(text)
  const counts = new Map()
  const result = new Set()
  for (const match of masked.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(match[1]); const n = counts.get(base) ?? 0
    counts.set(base, n + 1); result.add(n ? `${base}-${n}` : base)
  }
  for (const match of masked.matchAll(/<a\s+[^>]*(?:id|name)=["']([^"']+)["'][^>]*>/gi)) result.add(match[1])
  return result
}
/** Parse the documented bounded link subset; report unsupported nested destinations. */
export function links(text) {
  const masked = maskCode(text)
  const definitions = new Map()
  const out = []
  const normalize = label => label.toLowerCase().replace(/\s+/g, ' ').trim()
  const destination = value => {
    const trimmed = value.trim()
    if (trimmed.startsWith('<')) return /^<([^>]+)>/.exec(trimmed)?.[1]
    return /^(\S+?)(?:\s+["'][\s\S]*["'])?$/.exec(trimmed)?.[1]
  }
  for (const match of masked.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(.+)$/gm)) {
    const url = destination(match[2]); definitions.set(normalize(match[1]), url)
    out.push({ url, offset: match.index, definition: true })
  }
  const body = masked.replace(/^ {0,3}\[[^\]]+\]:[^\n]*$/gm, value => ' '.repeat(value.length))
  const re = /!?\[([^\]\n]*)\](?:\((<[^>\n]*>|[^)\n]*)\)|\[([^\]\n]*)\])?/g
  for (const match of body.matchAll(re)) {
    if (match[2] !== undefined) {
      const url = destination(match[2]); out.push({ url, offset: match.index, unsupported: url?.includes('(') || body[match.index + match[0].length] === ')' })
    } else if (match[3] !== undefined) out.push({ url: definitions.get(normalize(match[3] || match[1])), offset: match.index })
    else if (definitions.has(normalize(match[1]))) out.push({ url: definitions.get(normalize(match[1])), offset: match.index })
  }
  return out
}
/** Local path and fragment, with query removed without changing the authored target. */
export function localTarget(url, file) {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) return null
  const hash = url.indexOf('#')
  const rawPath = (hash < 0 ? url : url.slice(0, hash)).split('?')[0]
  const fragment = hash < 0 ? null : decodeURIComponent(url.slice(hash + 1))
  const target = rawPath ? path.resolve(path.dirname(file), decodeURIComponent(rawPath)) : file
  return { target: fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'index.md') : target, fragment }
}
