import { animateCardIn, animateCellMark, animateWinLine } from '../animations/cardReveal.js'

export class BingoCard {
  constructor(container) {
    this.container = container
    this.reset()
  }

  reset() {
    this.numbers = this.generateCard()
    this.marked = new Set(['FREE'])
    this.render()
    animateCardIn(this.container.querySelector('.bingo-card'))
  }

  // Returns numbers[col][row] — col 0-4 = B I N G O
  generateCard() {
    const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]]
    return ranges.map(([min, max]) => {
      const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min)
      const picked = []
      for (let i = 0; i < 5; i++) {
        picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
      }
      return picked
    })
  }

  render() {
    let gridHTML = ''
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const isFree = col === 2 && row === 2
        const num = isFree ? 'FREE' : this.numbers[col][row]
        gridHTML += `
          <div class="cell ${isFree ? 'free marked' : ''}"
               data-col="${col}" data-row="${row}" data-number="${num}">
            ${isFree ? '★' : num}
          </div>`
      }
    }

    this.container.innerHTML = `
      <div class="bingo-card">
        <div class="card-header">
          ${['B','I','N','G','O'].map(l => `<div class="header-cell">${l}</div>`).join('')}
        </div>
        <div class="card-grid">${gridHTML}</div>
      </div>`

    this.container.querySelectorAll('.cell:not(.free)').forEach(cell => {
      cell.addEventListener('click', () => this.markCell(cell))
    })
  }

  markCell(cellEl) {
    if (cellEl.classList.contains('marked')) return null
    cellEl.classList.add('marked')
    this.marked.add(Number(cellEl.dataset.number))
    animateCellMark(cellEl)
    return this.checkWin()
  }

  markNumber(number) {
    const cell = this.container.querySelector(`[data-number="${number}"]`)
    if (cell) return this.markCell(cell)
    return null
  }

  checkWin() {
    const cell = (col, row) => this.container.querySelector(`[data-col="${col}"][data-row="${row}"]`)
    const isMarked = el => el && el.classList.contains('marked')

    // Rows
    for (let row = 0; row < 5; row++) {
      const cells = [0,1,2,3,4].map(col => cell(col, row))
      if (cells.every(isMarked)) return this.highlightWin(cells)
    }
    // Columns
    for (let col = 0; col < 5; col++) {
      const cells = [0,1,2,3,4].map(row => cell(col, row))
      if (cells.every(isMarked)) return this.highlightWin(cells)
    }
    // Diagonals
    const d1 = [0,1,2,3,4].map(i => cell(i, i))
    if (d1.every(isMarked)) return this.highlightWin(d1)
    const d2 = [0,1,2,3,4].map(i => cell(i, 4-i))
    if (d2.every(isMarked)) return this.highlightWin(d2)

    return null
  }

  highlightWin(cells) {
    cells.forEach(c => c.classList.add('win-line'))
    animateWinLine(cells)
    return 'BINGO'
  }
}
