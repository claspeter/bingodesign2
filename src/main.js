import { gsap } from 'gsap'
import { io } from 'socket.io-client'
import { BingoCard } from './components/BingoCard.js'
import { NumberDraw } from './components/NumberDraw.js'
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

const socket = io()

// Sync state for late-joiners
socket.on('state', ({ called, gameOver: over }) => {
  called.forEach((n) => numberDraw.called.add(n))
  if (called.length) numberDraw.display(called[called.length - 1])
  if (over) {
    gameOver = true
    winOverlay.classList.add('active')
    playWinSequence(winOverlay)
  }
})

socket.on('number-drawn', ({ number }) => {
  numberDraw.display(number)
  const result = bingoCard.markNumber(number)
  if (result === 'BINGO') {
    gameOver = true
    socket.emit('bingo')
    setTimeout(() => {
      winOverlay.classList.add('active')
      playWinSequence(winOverlay)
    }, 600)
  }
})

socket.on('game-over', () => {
  gameOver = true
  setTimeout(() => {
    winOverlay.classList.add('active')
    playWinSequence(winOverlay)
  }, 600)
})

socket.on('game-reset', () => {
  hideWinOverlay(winOverlay)
  setTimeout(() => {
    gameOver = false
    bingoCard.reset()
    numberDraw.reset()
  }, 350)
})

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
  socket.emit('draw')
})

newCardBtn.addEventListener('click', () => {
  if (gameOver) return
  bingoCard.reset()
})

playAgainBtn.addEventListener('click', () => {
  socket.emit('reset')
})
