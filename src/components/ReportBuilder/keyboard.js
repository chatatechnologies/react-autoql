// Whether the keyboard calls its Enter key Return, as a Mac's does: for naming keys in hints.
export const isMacKeyboard = () => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')
}
