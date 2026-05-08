import { gsap } from 'gsap'
import { COL_COLORS, getColumn } from '../utils/bingoLogic.js'

// ── Constants ─────────────────────────────────────────────────────────
const BALL_RADIUS      = 14   // px, half of 28px ball
const DRUM_PHYS_RADIUS = 126  // inner collision radius inside 290px sphere
const MIN_SPEED        = 0.7
const MAX_SPEED        = 2.4
const VISIBLE_COUNT    = 16

// Air-flow forces
const UPWARD_FORCE  = 0.032   // constant upward push (simulates air pressure)
const SWIRL_FORCE   = 0.038   // tangential swirl per frame
const TURBULENCE    = 0.06    // random horizontal jitter

// ── Tube path waypoints (ball CENTER, machine-container coords) ────────
// Drum wrapper is at left:10, top:80 inside .lottery-machine
// Drum center is at (10+145, 80+145) = (155, 225) in machine coords
// Drum top is at (155, 80)
//
// SVG path goes: drum-top → up → right → down → left → down → right → down → left (rest tray)
//
// These waypoints follow the SVG centerline:
const DRUM_TOP_X = 155
const DRUM_TOP_Y = 80

const TUBE_WAYPOINTS = [
  { x: DRUM_TOP_X, y: DRUM_TOP_Y },   // [0] drum top exit fitting
  { x: DRUM_TOP_X, y: 12 },            // [1] top of exit fitting (above drum)
  { x: 530,        y: 12 },            // [2] end of top horizontal
  { x: 530,        y: 135 },           // [3] bottom of first drop
  { x: 375,        y: 135 },           // [4] end of first left return
  { x: 375,        y: 255 },           // [5] bottom of second drop
  { x: 530,        y: 255 },           // [6] end of second right pass
  { x: 530,        y: 385 },           // [7] bottom of final drop → rest tray
]

// Rest tray: balls accumulate at y=385, starting from x=516 going left
// Rows: 7 balls per row (stops before overlapping drum at x≈300)
const REST_Y        = 385
const REST_X_START  = 516  // x-center of first ball slot (rightmost)
const REST_STEP     = 32   // px between ball centers
const REST_PER_ROW  = 7

// ── DrumAnimation class ───────────────────────────────────────────────
export class DrumAnimation {
  constructor(drumEl, machineEl) {
    this.drumEl    = drumEl
    this.machineEl = machineEl
    this.balls     = []
    this.pool      = []
    this.animFrame = null
    this.running   = false
    this.cx = 0; this.cy = 0   // drum physics center (relative to drum element)
    this.drawnCount  = 0        // how many balls have been drawn so far
    this._perturbTimer = null
  }

  init(allNumbers) {
    // Drum physics center = half of 290px sphere
    this.cx = 145
    this.cy = 145

    const shuffled = [...allNumbers].sort(() => Math.random() - 0.5)
    const initial  = shuffled.slice(0, VISIBLE_COUNT)
    this.pool      = shuffled.slice(VISIBLE_COUNT)

    initial.forEach(n => this._spawnBall(n))
    this._startLoop()
    this.running = true

    // Periodic extra turbulence kick
    this._perturbTimer = setInterval(() => this._turbulenceKick(), 2600)
  }

  // ── Ball spawning ────────────────────────────────────────────────────
  _spawnBall(number, fromPool = false) {
    const letter = getColumn(number)
    const color  = COL_COLORS[letter]

    const el = document.createElement('div')
    el.className = 'drum-ball'
    el.innerHTML = `<span>${number}</span>`
    el.style.background    = `radial-gradient(circle at 36% 34%, ${color}ee 0%, ${color}66 100%)`
    el.style.borderColor   = color
    el.style.boxShadow     = `0 0 8px ${color}55, inset 0 1px 0 rgba(255,255,255,0.28)`

    // Spawn near center to avoid immediate wall collision
    const angle = Math.random() * Math.PI * 2
    const r     = Math.random() * (DRUM_PHYS_RADIUS * 0.55)
    const x     = this.cx + r * Math.cos(angle)
    const y     = this.cy + r * Math.sin(angle)

    // Give each ball a random velocity with upward bias
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)
    const va    = Math.random() * Math.PI * 2
    const vx    = speed * Math.cos(va)
    const vy    = speed * Math.sin(va) - 0.8  // slight upward bias at spawn

    this.drumEl.appendChild(el)
    const ball = { x, y, vx, vy, number, letter, color, el, exiting: false }
    this.balls.push(ball)
    this._setPos(ball)

    if (fromPool) {
      el.style.opacity = '0'
      gsap.to(el, { opacity: 1, duration: 0.6, delay: 0.2 })
    }
  }

  _setPos(ball) {
    ball.el.style.left = ball.x - BALL_RADIUS + 'px'
    ball.el.style.top  = ball.y - BALL_RADIUS + 'px'
  }

  // ── Physics loop ─────────────────────────────────────────────────────
  _startLoop() {
    const tick = () => {
      if (!this.running) return
      this._step()
      this.animFrame = requestAnimationFrame(tick)
    }
    this.animFrame = requestAnimationFrame(tick)
  }

  _step() {
    const active = this.balls.filter(b => !b.exiting)

    // ── Apply forces & update positions ──
    for (const b of active) {
      // Upward air pressure
      b.vy -= UPWARD_FORCE

      // Swirl force: tangential acceleration (counter-clockwise)
      const dx    = b.x - this.cx
      const dy    = b.y - this.cy
      const dist  = Math.sqrt(dx * dx + dy * dy) || 1
      const tx    = -dy / dist  // tangent unit vector x (counter-clockwise)
      const ty    =  dx / dist  // tangent unit vector y
      b.vx += SWIRL_FORCE * tx
      b.vy += SWIRL_FORCE * ty

      // Small random horizontal turbulence
      b.vx += (Math.random() - 0.5) * TURBULENCE

      b.x += b.vx
      b.y += b.vy

      // ── Circular wall collision ──
      const wdx  = b.x - this.cx
      const wdy  = b.y - this.cy
      const wdst = Math.sqrt(wdx * wdx + wdy * wdy)
      const maxD = DRUM_PHYS_RADIUS - BALL_RADIUS

      if (wdst > maxD) {
        const nx  = wdx / wdst
        const ny  = wdy / wdst
        const dot = b.vx * nx + b.vy * ny
        if (dot > 0) {
          b.vx -= 2 * dot * nx * 0.82  // slight energy loss on wall bounce
          b.vy -= 2 * dot * ny * 0.82
        }
        // Small random deflection at wall
        b.vx += (Math.random() - 0.5) * 0.3
        b.vy += (Math.random() - 0.5) * 0.3
        // Push inside boundary
        b.x = this.cx + nx * (maxD - 0.5)
        b.y = this.cy + ny * (maxD - 0.5)
      }

      // ── Speed clamping ──
      const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
      if (spd < MIN_SPEED) {
        b.vx = (b.vx / spd) * MIN_SPEED
        b.vy = (b.vy / spd) * MIN_SPEED
      } else if (spd > MAX_SPEED) {
        b.vx = (b.vx / spd) * MAX_SPEED
        b.vy = (b.vy / spd) * MAX_SPEED
      }

      this._setPos(b)
    }

    // ── Ball–ball elastic collisions ──
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a  = active[i]
        const b  = active[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d  = Math.sqrt(dx * dx + dy * dy)
        const minD = BALL_RADIUS * 2

        if (d < minD && d > 0) {
          const nx  = dx / d
          const ny  = dy / d
          const rv  = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny

          if (rv > 0) {
            const imp = rv * 0.90
            a.vx -= imp * nx; a.vy -= imp * ny
            b.vx += imp * nx; b.vy += imp * ny
          }
          // Separate overlapping balls
          const sep = (minD - d) * 0.52
          a.x -= nx * sep; a.y -= ny * sep
          b.x += nx * sep; b.y += ny * sep
        }
      }
    }
  }

  _turbulenceKick() {
    for (const b of this.balls) {
      if (b.exiting) continue
      b.vx += (Math.random() - 0.5) * 1.8
      b.vy += (Math.random() - 0.5) * 1.8
    }
  }

  // ── Exit animation along the S-curve tube ────────────────────────────
  exitRandomBall(onComplete) {
    const available = this.balls.filter(b => !b.exiting)
    if (!available.length) return null

    const ball = available[Math.floor(Math.random() * available.length)]
    ball.exiting = true

    // ── Get drum position within machine container ──
    const machineRect = this.machineEl.getBoundingClientRect()
    const drumRect    = this.drumEl.getBoundingClientRect()
    const drumOffX    = drumRect.left - machineRect.left
    const drumOffY    = drumRect.top  - machineRect.top

    // Ball's current position in machine coords
    const startLeft = drumOffX + ball.x - BALL_RADIUS
    const startTop  = drumOffY + ball.y - BALL_RADIUS

    // ── Create clone positioned absolutely inside machine container ──
    const clone = document.createElement('div')
    clone.className = 'drum-ball--clone'
    clone.innerHTML = ball.el.innerHTML
    clone.style.background  = ball.el.style.background
    clone.style.borderColor = ball.el.style.borderColor
    clone.style.boxShadow   = ball.el.style.boxShadow
    clone.style.left        = startLeft + 'px'
    clone.style.top         = startTop  + 'px'
    this.machineEl.appendChild(clone)

    // Shrink and fade the original inside the drum
    gsap.to(ball.el, { opacity: 0, scale: 0.35, duration: 0.18, transformOrigin: 'center' })

    // ── Determine rest position for this ball ──
    const idx    = this.drawnCount
    const row    = Math.floor(idx / REST_PER_ROW)
    const col    = idx % REST_PER_ROW
    const restCX = REST_X_START - col * REST_STEP
    const restCY = REST_Y + row * REST_STEP
    const restLeft = restCX - BALL_RADIUS
    const restTop  = restCY - BALL_RADIUS
    this.drawnCount++

    // ── Helper: convert waypoint center → clone's left/top ──
    const wp = (i) => ({
      left: TUBE_WAYPOINTS[i].x - BALL_RADIUS,
      top:  TUBE_WAYPOINTS[i].y - BALL_RADIUS,
    })

    // ── Build timeline ──
    const tl = gsap.timeline({
      onComplete: () => {
        // Convert clone to a permanent rest-ball
        clone.remove()
        ball.el.remove()
        this.balls = this.balls.filter(b => b !== ball)

        // Spawn replacement from pool
        if (this.pool.length > 0) {
          this._spawnBall(this.pool.shift(), true)
        }

        // Place a static rest ball
        const restBall = document.createElement('div')
        restBall.className = 'rest-ball rest-ball--latest'
        restBall.innerHTML = clone.innerHTML
        restBall.style.background  = clone.style.background
        restBall.style.borderColor = clone.style.borderColor
        restBall.style.boxShadow   = `0 0 10px ${ball.color}88`
        restBall.style.left        = restLeft + 'px'
        restBall.style.top         = restTop  + 'px'
        this.machineEl.appendChild(restBall)

        // Remove latest glow after a beat
        setTimeout(() => restBall.classList.remove('rest-ball--latest'), 2000)

        onComplete(ball.number, ball.letter, ball.color)
      }
    })

    // Phase 1 – rise inside drum to drum-top exit
    tl.to(clone, { left: wp(0).left, top: wp(0).top, duration: 0.36, ease: 'power2.in' })

    // Phase 2 – shoot up through the collar/fitting
    .to(clone, { left: wp(1).left, top: wp(1).top, duration: 0.22, ease: 'power3.out' })

    // Phase 3 – travel right along top horizontal
    .to(clone, { left: wp(2).left, top: wp(2).top, duration: 0.48, ease: 'none' })

    // Phase 4 – drop down first vertical
    .to(clone, { left: wp(3).left, top: wp(3).top, duration: 0.28, ease: 'power2.in' })

    // Phase 5 – slide left along first return
    .to(clone, { left: wp(4).left, top: wp(4).top, duration: 0.34, ease: 'none' })

    // Phase 6 – drop down second vertical
    .to(clone, { left: wp(5).left, top: wp(5).top, duration: 0.28, ease: 'power2.in' })

    // Phase 7 – slide right along second pass
    .to(clone, { left: wp(6).left, top: wp(6).top, duration: 0.34, ease: 'none' })

    // Phase 8 – final drop into rest tray
    .to(clone, { left: wp(7).left, top: wp(7).top, duration: 0.32, ease: 'bounce.out' })

    // Phase 9 – slide left to final resting position
    .to(clone, { left: restLeft, top: restTop, duration: 0.28, ease: 'power2.out' })

    return ball.number
  }

  stop() {
    this.running = false
    if (this.animFrame)    cancelAnimationFrame(this.animFrame)
    if (this._perturbTimer) clearInterval(this._perturbTimer)
  }

  reset(allNumbers) {
    this.stop()
    this.balls.forEach(b => b.el.remove())
    // Remove any rest balls
    this.machineEl.querySelectorAll('.rest-ball, .drum-ball--clone').forEach(el => el.remove())
    this.balls      = []
    this.pool       = []
    this.drawnCount = 0
    this.init(allNumbers)
  }
}
