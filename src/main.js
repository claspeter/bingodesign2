import { gsap } from 'gsap'
import { BingoCard } from './components/BingoCard.js'
import { NumberDraw } from './components/NumberDraw.js'
import { drawNumber } from './utils/bingoLogic.js'
import { playWinSequence, hideWinOverlay } from './animations/winSequence.js'
import './style.css'

const cardContainer = document.getElementById('card-container')
const ballEl = document.getElementById('current-ball')
const calledEl = document.getElementById('called-numbers')
const drawBtn = document.getElementById('draw-btn')
const newCardBtn = document.getElementById('new-card-btn')
const winOverlay = document.getElementById('win-overlay')
const playAgainBtn = document.getElementById('play-again-btn')

let bingoCard = new BingoCard(cardContainer)
let numberDraw = new NumberDraw(ballEl, calledEl)
let gameOver = false

// Title entrance
gsap.from('.title span', {
  y: -80,
  opacity: 0,
  duration: 0.6,
  stagger: 0.08,
  ease: 'back.out(1.7)',
  delay: 0.1,
})

drawBtn.addEventListener('click', () => {
  if (gameOver) return

  const number = drawNumber(numberDraw.called)
  if (!number) return

  numberDraw.display(number)

  const result = bingoCard.markNumber(number)
  if (result === 'BINGO') {
    gameOver = true
    setTimeout(() => {
      winOverlay.classList.add('active')
      playWinSequence(winOverlay)
    }, 600)
  }
})

newCardBtn.addEventListener('click', () => {
  if (gameOver) return
  bingoCard.reset()
})

playAgainBtn.addEventListener('click', () => {
  hideWinOverlay(winOverlay)
  setTimeout(() => {
    gameOver = false
    bingoCard.reset()
    numberDraw.reset()
  }, 350)
})
