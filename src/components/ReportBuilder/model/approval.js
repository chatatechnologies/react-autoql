// A report's approval (RW-372): who said "I have reviewed and approved this report.", when, and what they approved.
// It's kept in the report itself, as { name, at, fingerprint }, so the report service needs no change. `fingerprint`
// is the report as it was approved: its content (everything but the approval) and the id it's kept under. An approval
// holds only while both are what they were: a report changed anywhere (in the builder, by Add to Report, by AutoQL's
// fill) is a draft again, and so is a copy of it (a template made from it, a report started from that).

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

// The approval as it's kept, or null for none: a name, a time that can be read, and what was approved.
export const normalizeApproval = (approval) => {
  if (!isObject(approval)) {
    return null
  }
  const name = typeof approval.name === 'string' ? approval.name.trim() : ''
  const at = typeof approval.at === 'string' && !Number.isNaN(Date.parse(approval.at)) ? approval.at : ''
  const fingerprint = typeof approval.fingerprint === 'string' ? approval.fingerprint : ''
  return name && at && fingerprint ? { name, at, fingerprint } : null
}

// The report without its approval: the same object when it has none.
export const withoutApproval = (report) => {
  if (!isObject(report) || !('approval' in report)) {
    return report
  }
  const rest = { ...report }
  delete rest.approval
  return rest
}

// JSON as JSON.stringify writes it, but with every object's keys in order: the same text for the same content, however
// the report was put together or read back from the service.
const canonical = (value) => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }
  if (typeof value.toJSON === 'function') {
    return canonical(value.toJSON())
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => (item === undefined || typeof item === 'function' ? 'null' : canonical(item)))
      .join(',')}]`
  }
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined && typeof value[key] !== 'function')
    .sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}

// cyrb53: a quick 53-bit hash of a string, in hex. It isn't a secret or a signature: it tells one report's content
// from another's.
const hash53 = (text) => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

// What an approval holds for: the report's content, all but its approval, and the id it's kept under (none where the
// host keeps no id).
export const fingerprintOf = (report, reportId) => hash53(`${reportId || ''}\n${canonical(withoutApproval(report))}`)

// The report as `name` approves it, as it is now: kept under `reportId`.
export const approveReport = (report, { name, at = new Date().toISOString(), reportId } = {}) => {
  const content = withoutApproval(report)
  return { ...content, approval: { name: String(name).trim(), at, fingerprint: fingerprintOf(content, reportId) } }
}

// The approval that holds for the report kept under `reportId`: null for none, or for one made for other content or
// another report.
export const heldApproval = (report, reportId) => {
  const approval = normalizeApproval(report?.approval)
  return approval && approval.fingerprint === fingerprintOf(report, reportId) ? approval : null
}
