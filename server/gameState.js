export function createGameState() {
  return {
    called: new Set(),
    gameOver: false,
  }
}

export function drawNumber(state) {
  if (state.gameOver) return null
  const available = []
  for (let i = 1; i <= 75; i++) {
    if (!state.called.has(i)) available.push(i)
  }
  if (!available.length) return null
  const number = available[Math.floor(Math.random() * available.length)]
  state.called.add(number)
  return number
}

export function resetGame(state) {
  state.called.clear()
  state.gameOver = false
}

export function getState(state) {
  return {
    called: [...state.called],
    gameOver: state.gameOver,
  }
}
