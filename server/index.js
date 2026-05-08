import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createGameState, drawNumber, resetGame, getState } from './gameState.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' },
})

const game = createGameState()

io.on('connection', (socket) => {
  // Send current game state to newly connected client
  socket.emit('state', getState(game))

  socket.on('draw', () => {
    const number = drawNumber(game)
    if (number !== null) {
      io.emit('number-drawn', { number, called: [...game.called] })
    }
  })

  socket.on('bingo', () => {
    game.gameOver = true
    io.emit('game-over')
  })

  socket.on('reset', () => {
    resetGame(game)
    io.emit('game-reset')
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Bingo server running on http://localhost:${PORT}`)
})
