import { gsap } from 'gsap'
import { io } from 'socket.io-client'
import { BingoCard }   from './components/BingoCard.js'
import { CallCard }    from './components/CallCard.js'
import { Announcer }   from './components/Announcer.js'
import { DrumPhysics } from './animations/DrumPhysics.js'
import { playWinSequence, hideWinOverlay } from './animations/winSequence.js'
import './style.css'

const machineEl    = document.getElementById('lottery-machine')
const drumEl       = document.getElementById('drum')
const ballEl       = document.getElementById('current-ball')
const calledEl     = document.getElementById('called-numbers')
const cardContainer = document.getElementById('card-container')
const timerBarEl   = document.getElementById('drum-timer-bar')
const statusTextEl = document.getElementById('drum-status-text')
const countdownEl  = document.getElementById('drum-countdown')
const statusSuffix = document.getElementById('drum-status-suffix')
const callSublabel = document.getElementById('call-sublabel')
const newCardBtn   = document.getElementById('new-card-btn')
const winOverlay   = document.getElementById('win-overlay')
const playAgainBtn = document.getElementById('play-again-btn')

let numberDraw = new CallCard(calledEl, ballEl)
let bingoCard  = new BingoCard(cardContainer)
let drum       = new DrumPhysics(drumEl, machineEl)
let announcer  = new Announcer()

let gameOver = false
let drawing  = false

function setVh() {
  document.documentElement.style.setProperty('--real-vh', window.innerHeight + 'px')
}
setVh()
window.addEventListener('resize', setVh)

gsap.from('.title span', {
  y: -80, opacity: 0, duration: 0.6,
  stagger: 0.08, ease: 'back.out(1.7)', delay: 0.1,
})

// ── Socket.io ─────────────────────────────────────────────────────────────
const socket = io()

socket.on('state', ({ called, gameOver: over }) => {
  called.forEach((n) => numberDraw.called.add(n))
  if (called.length) numberDraw.display(called[called.length - 1])
  if (over) {
    gameOver = true
    setStatus('bingo')
    winOverlay.classList.add('active')
    playWinSequence(winOverlay)
  }
})

socket.on('countdown', ({ remaining, total }) => {
  if (gameOver) return
  setStatus('idle', remaining, total)
  timerBarEl.style.setProperty('--progress', remaining / total)
  countdownEl.textContent = Math.ceil(remaining)
})

socket.on('number-drawn', ({ number }) => {
  if (gameOver || drawing) return
  drawing = true
  setStatus('drawing')

  drum.exitBall(
    number,
    (num, group, color) => {
      numberDraw.display(num)
      announcer.announce(num)
      callSublabel.textContent = groupRange(group)
      gsap.fromTo(ballEl,
        { scale: 1.4, filter: `drop-shadow(0 0 28px ${color})` },
        { scale: 1,   filter: 'none', duration: 0.55, ease: 'elastic.out(1,0.5)' }
      )
    },
    (num) => {
      const result = bingoCard.markNumber(num)
      if (result === 'BINGO') {
        gameOver = true
        timerBarEl.style.setProperty('--progress', '0')
        setStatus('bingo')
        socket.emit('bingo')
        setTimeout(() => {
          winOverlay.classList.add('active')
          playWinSequence(winOverlay)
        }, 600)
      } else {
        if (result === '1LINE' || result === '2LINES') {
          gsap.fromTo('.bingo-card',
            { filter: 'brightness(1.6)' },
            { filter: 'none', duration: 0.8, ease: 'power2.out' }
          )
        }
        drawing = false
      }
    }
  )
})

socket.on('game-over', () => {
  gameOver = true
  setStatus('bingo')
  timerBarEl.style.setProperty('--progress', '0')
  setTimeout(() => {
    winOverlay.classList.add('active')
    playWinSequence(winOverlay)
  }, 600)
})

socket.on('game-reset', () => {
  hideWinOverlay(winOverlay)
  setTimeout(() => {
    gameOver = false
    drawing  = false
    bingoCard.reset()
    numberDraw.reset()
    announcer.reset()
    callSublabel.textContent = ' '
    const all = Array.from({ length: 90 }, (_, i) => i + 1)
    drum.reset(all)
    timerBarEl.style.setProperty('--progress', '1')
    setStatus('idle', 7, 7)
  }, 350)
})

// ── Boot ──────────────────────────────────────────────────────────────────
setTimeout(() => {
  const all = Array.from({ length: 90 }, (_, i) => i + 1)
  drum.init(all)
}, 500)

// ── Helpers ───────────────────────────────────────────────────────────────
function groupRange(group) {
  const ranges = ['1–9','10–19','20–29','30–39','40–49','50–59','60–69','70–79','80–90']
  return ranges[(group || 1) - 1] || ''
}

function setStatus(state, remaining = 7, total = 7) {
  if (state === 'idle') {
    statusTextEl.textContent = 'Next draw in '
    countdownEl.textContent  = Math.ceil(remaining)
    statusSuffix.textContent = 's'
  } else if (state === 'drawing') {
    statusTextEl.textContent = 'Drawing…'
    countdownEl.textContent  = ''
    statusSuffix.textContent = ''
  } else if (state === 'bingo') {
    statusTextEl.textContent = 'BINGO!'
    countdownEl.textContent  = ''
    statusSuffix.textContent = ''
  }
}

// ── Controls ──────────────────────────────────────────────────────────────
newCardBtn.addEventListener('click', () => {
  if (gameOver) return
  bingoCard.reset()
})

playAgainBtn.addEventListener('click', () => {
  socket.emit('reset')
})
