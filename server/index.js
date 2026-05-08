import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createGameState, drawNumber, resetGame, getState } from './gameState.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' },
})

const DRAW_INTERVAL_MS  = 7000
const TICK_MS           = 100

const game = createGameState()
let drawTimer  = null
let tickTimer  = null
let countdown  = DRAW_INTERVAL_MS

function startCycle() {
  clearTimeout(drawTimer)
  clearInterval(tickTimer)
  countdown = DRAW_INTERVAL_MS

  tickTimer = setInterval(() => {
    countdown = Math.max(0, countdown - TICK_MS)
    io.emit('countdown', { remaining: countdown / 1000, total: DRAW_INTERVAL_MS / 1000 })
  }, TICK_MS)

  drawTimer = setTimeout(() => {
    clearInterval(tickTimer)
    if (game.gameOver) return
    const number = drawNumber(game)
    if (number !== null) {
      io.emit('number-drawn', { number, called: [...game.called] })
      startCycle()
    }
  }, DRAW_INTERVAL_MS)
}

io.on('connection', (socket) => {
  socket.emit('state', getState(game))

  socket.on('bingo', () => {
    game.gameOver = true
    clearTimeout(drawTimer)
    clearInterval(tickTimer)
    io.emit('game-over')
  })

  socket.on('reset', () => {
    resetGame(game)
    startCycle()
    io.emit('game-reset')
  })
})

startCycle()

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Bingo server running on http://localhost:${PORT}`)
})
