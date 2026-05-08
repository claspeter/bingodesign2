// 90-ball bingo — 9 groups of 10 (plus 1 extra for 80-90)
export const COL_COLORS = {
  1: '#4aa3ff',  // blue   1–9
  2: '#ff5e7d',  // red    10–19
  3: '#4dffb4',  // green  20–29
  4: '#ffe24d',  // yellow 30–39
  5: '#c77dff',  // purple 40–49
  6: '#ff9a3c',  // orange 50–59
  7: '#00d4aa',  // teal   60–69
  8: '#ff6eb4',  // pink   70–79
  9: '#b0ff5e',  // lime   80–90
}

export function getColumn(number) {
  if (number <=  9) return 1
  if (number <= 19) return 2
  if (number <= 29) return 3
  if (number <= 39) return 4
  if (number <= 49) return 5
  if (number <= 59) return 6
  if (number <= 69) return 7
  if (number <= 79) return 8
  return 9
}

export function drawNumber(called) {
  const available = []
  for (let i = 1; i <= 90; i++) {
    if (!called.has(i)) available.push(i)
  }
  if (!available.length) return null
  return available[Math.floor(Math.random() * available.length)]
}
