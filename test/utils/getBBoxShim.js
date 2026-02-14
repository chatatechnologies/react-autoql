// Per-test SVG getBBox shim helper
let _originalGetBBox = null

function installGetBBoxMock() {
  if (typeof SVGElement === 'undefined') return
  if (typeof SVGElement.prototype.getBBox === 'function') return
  _originalGetBBox = null
  SVGElement.prototype.getBBox = function () {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  // mark it so uninstall can detect it was added by us
  SVGElement.prototype.getBBox._isTestShim = true
}

function uninstallGetBBoxMock() {
  if (typeof SVGElement === 'undefined') return
  const fn = SVGElement.prototype.getBBox
  if (fn && fn._isTestShim) {
    try {
      delete SVGElement.prototype.getBBox
    } catch (e) {
      SVGElement.prototype.getBBox = undefined
    }
  }
}

module.exports = { installGetBBoxMock, uninstallGetBBoxMock }
