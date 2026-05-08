import { animateCardIn, animateCellMark, animateWinLine } from '../animations/cardReveal.js'
import { COL_COLORS, getColumn } from '../utils/bingoLogic.js'

// 90-ball bingo card: 9 columns × 3 rows, 15 numbers total (5 per row)
export class BingoCard {
  constructor(container) {
    this.container = container
    this._completedRows = new Set()
    this.reset()
  }

  reset() {
    const { grid, mask } = this._generateCard()
    this._grid = grid
    this._mask = mask
    this._marked = new Set()
    this._completedRows = new Set()
    this._render()
    const card = this.container.querySelector('.bingo-card')
    if (card) animateCardIn(card)
  }

  _generateCard() {
    // Find a column-count distribution where each col has 1–3 entries and each row has 5
    let mask
    for (let attempt = 0; attempt < 300; attempt++) {
      mask = []
      for (let r = 0; r < 3; r++) {
        const cols = [0,1,2,3,4,5,6,7,8].sort(() => Math.random() - 0.5).slice(0, 5)
        mask.push(new Set(cols))
      }
      const colCounts = Array.from({ length: 9 }, (_, c) =>
        mask.filter(row => row.has(c)).length
      )
      if (colCounts.every(n => n >= 1 && n <= 3)) break
    }

    const colRanges = [
      [1,9],[10,19],[20,29],[30,39],[40,49],
      [50,59],[60,69],[70,79],[80,90],
    ]

    const grid = Array.from({ length: 3 }, () => Array(9).fill(null))
    for (let c = 0; c < 9; c++) {
      const [min, max] = colRanges[c]
      const pool = []
      for (let n = min; n <= max; n++) pool.push(n)
      pool.sort(() => Math.random() - 0.5)
      const activeRows = [0,1,2].filter(r => mask[r].has(c))
      const nums = pool.slice(0, activeRows.length).sort((a, b) => a - b)
      activeRows.forEach((r, i) => { grid[r][c] = nums[i] })
    }
    return { grid, mask }
  }

  _render() {
    let html = '<div class="bingo-card"><div class="card-grid-90">'
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        const num = this._grid[r][c]
        if (num !== null) {
          const color = COL_COLORS[getColumn(num)]
          html += `<div class="cell90" data-number="${num}" data-row="${r}" data-col="${c}"
            style="--accent:${color}">${num}</div>`
        } else {
          html += `<div class="cell90 cell90--blank"></div>`
        }
      }
    }
    html += '</div></div>'
    this.container.innerHTML = html

    this.container.querySelectorAll('.cell90:not(.cell90--blank)').forEach(el => {
      el.addEventListener('click', () => this._markCell(el))
    })
  }

  markNumber(number) {
    const el = this.container.querySelector(`[data-number="${number}"]`)
    if (el) return this._markCell(el)
    return null
  }

  _markCell(el) {
    if (el.classList.contains('marked')) return null
    el.classList.add('marked')
    this._marked.add(Number(el.dataset.number))
    animateCellMark(el)
    return this._checkWin()
  }

  _checkWin() {
    let newLine = false
    for (let r = 0; r < 3; r++) {
      if (this._completedRows.has(r)) continue
      const cells = [...this.container.querySelectorAll(`[data-row="${r}"]`)]
      if (cells.length > 0 && cells.every(c => c.classList.contains('marked'))) {
        this._completedRows.add(r)
        animateWinLine(cells)
        newLine = true
      }
    }
    if (!newLine) return null
    if (this._completedRows.size === 3) return 'BINGO'
    if (this._completedRows.size === 2) return '2LINES'
    return '1LINE'
  }
}
