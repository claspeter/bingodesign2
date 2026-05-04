export const COL_COLORS = {
  B: '#4aa3ff',
  I: '#ff5e7d',
  N: '#4dffb4',
  G: '#ffe24d',
  O: '#c77dff',
}

export function getColumn(number) {
  if (number <= 15) return 'B'
  if (number <= 30) return 'I'
  if (number <= 45) return 'N'
  if (number <= 60) return 'G'
  return 'O'
}

export function drawNumber(called) {
  const available = []
  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) available.push(i)
  }
  if (!available.length) return null
  return available[Math.floor(Math.random() * available.length)]
}
