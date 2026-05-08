import { getColumn, COL_COLORS } from '../utils/bingoLogic.js'
import { animateBallDrop, animateChipAppear } from '../animations/numberBall.js'

export class NumberDraw {
  constructor(ballEl, calledEl) {
    this.ballEl   = ballEl
    this.calledEl = calledEl
    this.called   = new Set()
  }

  display(number) {
    const group = getColumn(number)
    const color = COL_COLORS[group]

    const numEl = this.ballEl.querySelector('.ball-number')
    if (numEl) numEl.textContent = number
    animateBallDrop(this.ballEl, color)

    const chip = document.createElement('div')
    chip.className   = 'called-chip'
    chip.textContent = number
    chip.style.cssText = `color:${color};background:${color}22;border:1px solid ${color}55`
    this.calledEl.prepend(chip)
    animateChipAppear(chip)

    this.called.add(number)
  }

  reset() {
    this.called.clear()
    if (this.calledEl) this.calledEl.innerHTML = ''
    const numEl = this.ballEl.querySelector('.ball-number')
    if (numEl) numEl.textContent = '--'
    this.ballEl.style.background  = ''
    this.ballEl.style.borderColor = ''
    this.ballEl.style.boxShadow   = ''
    this.ballEl.style.color       = ''
  }
}
