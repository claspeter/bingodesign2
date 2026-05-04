import { getColumn, COL_COLORS } from '../utils/bingoLogic.js'
import { animateBallDrop, animateChipAppear } from '../animations/numberBall.js'

export class NumberDraw {
  constructor(ballEl, calledEl) {
    this.ballEl = ballEl
    this.calledEl = calledEl
    this.called = new Set()
  }

  display(number) {
    const letter = getColumn(number)
    const color = COL_COLORS[letter]

    this.ballEl.querySelector('.ball-letter').textContent = letter
    this.ballEl.querySelector('.ball-number').textContent = number
    animateBallDrop(this.ballEl, letter)

    const chip = document.createElement('div')
    chip.className = 'called-chip'
    chip.textContent = `${letter}${number}`
    chip.style.cssText = `color:${color};background:${color}22;border:1px solid ${color}55`
    this.calledEl.prepend(chip)
    animateChipAppear(chip)

    this.called.add(number)
  }

  reset() {
    this.called.clear()
    this.calledEl.innerHTML = ''
    this.ballEl.querySelector('.ball-letter').textContent = '?'
    this.ballEl.querySelector('.ball-number').textContent = '--'
  }
}
