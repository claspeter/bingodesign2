// Lightweight bridge so route handlers can trigger game actions
// without creating circular imports with server/index.js

let _reschedule  = null
let _manualWin   = null

export function setRescheduleCallback(fn) { _reschedule = fn }
export function triggerReschedule()       { _reschedule?.() }

export function setManualWinCallback(fn)  { _manualWin = fn }
export function triggerManualWin(params)  { return _manualWin?.(params) ?? { error: 'Game not ready' } }
