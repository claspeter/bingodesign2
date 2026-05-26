import { gsap } from 'gsap'

// Traditional 90-ball bingo call phrases
const CALLS = {
  1:'Kelly\'s eye — number one!', 2:'One little duck — number two!',
  3:'Cup of tea — number three!', 4:'Knock at the door — number four!',
  5:'Man alive — number five!', 7:'Lucky seven!',
  8:'One fat lady — number eight!', 11:'Legs eleven!',
  13:'Unlucky for some — thirteen!', 21:'Key of the door — twenty one!',
  22:'Two little ducks — twenty two!', 88:'Two fat ladies — eighty eight!',
  90:'Top of the shop — ninety!',
}
const say = n => CALLS[n] || `Number ${n}!`

const IMG = (type, pose) => `/bingo-room/announcers/ann-${type}-${pose}.png`

// Frame sequences from the announcer-demo tool
// 0 = closed, 1 = talking, 2 = excited
// TICKS_PER_STEP at ~60fps: 6 ticks ≈ 100ms per step — natural speech rhythm
const SEQS = {
  talk: [0,0, 1,1,1, 0,0, 1,1, 0, 1,1,1,1, 0,0,0, 1,1, 0],
  win:  [2,2,2, 1, 2,2, 1, 2,2,2, 1,1, 2,2, 1, 2,2,2],
}
const TICKS_PER_STEP = 6
const POSES = ['closed', 'talking', 'excited']

function pickVoice() {
  const voices = speechSynthesis.getVoices()
  const prefer = ['Samantha','Karen','Moira','Tessa','Victoria',
                  'Google UK English Female','Microsoft Zira','Alice']
  for (const name of prefer) {
    const v = voices.find(v => v.name.includes(name))
    if (v) return v
  }
  return voices.find(v => /en[-_]/i.test(v.lang) && v.name.toLowerCase().includes('female'))
      || voices.find(v => /en[-_]/i.test(v.lang))
      || null
}

export class Announcer {
  constructor() {
    this._type     = 'a'
    this._voice    = null
    this._speaking = false
    this._unlocked = false
    this._rafId    = null   // requestAnimationFrame handle
    this._tick     = 0
    this._seq      = null   // current frame sequence
    this._speakGen = 0      // incremented each speak; guards stale onerror callbacks

    speechSynthesis.onvoiceschanged = () => { this._voice = pickVoice() }
    this._voice = pickVoice()

    this._build()
    this._idleAnim()
    this._unlock()
  }

  // Switch to a different announcer character (a / b / c / d)
  setType(type) {
    if (!type || !['a','b','c','d'].includes(type)) return
    this._el.classList.remove(`announcer-${this._type}`)
    this._type = type
    this._el.classList.add(`announcer-${this._type}`)
    this._setImg('closed')
  }

  // ── Private: image swap ───────────────────────────────────────────────────
  _setImg(pose) {
    if (this._img) this._img.src = IMG(this._type, pose)
  }

  // ── Private: rAF-based frame sequence ────────────────────────────────────
  _startSeq(seqName) {
    this._stopSeq()
    this._seq  = SEQS[seqName]
    this._tick = 0
    const step = () => {
      this._tick++
      const seqIdx   = Math.floor(this._tick / TICKS_PER_STEP) % this._seq.length
      const frameIdx = this._seq[seqIdx]
      this._setImg(POSES[frameIdx])
      this._rafId = requestAnimationFrame(step)
    }
    this._rafId = requestAnimationFrame(step)
  }

  _stopSeq() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null }
    this._seq  = null
    this._tick = 0
    this._setImg('closed')
  }

  // ── Private: speech unlock (required on mobile before first utterance) ───
  _unlock() {
    const handler = () => {
      if (this._unlocked) return
      this._unlocked = true
      const utt = new SpeechSynthesisUtterance('')
      utt.volume = 0
      speechSynthesis.speak(utt)
      document.removeEventListener('click',      handler)
      document.removeEventListener('keydown',    handler)
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('mousemove',  handler)
    }
    document.addEventListener('click',      handler)
    document.addEventListener('keydown',    handler)
    document.addEventListener('touchstart', handler)
    document.addEventListener('mousemove',  handler, { once: true })  // desktop: unlock on first mouse movement
  }

  _build() {
    const el = document.createElement('div')
    el.id        = 'announcer'
    el.className = `announcer announcer-${this._type}`
    el.innerHTML = `<img class="announcer-img" src="${IMG(this._type, 'closed')}" alt="announcer"/>`
    document.body.appendChild(el)
    this._el  = el
    this._img = el.querySelector('.announcer-img')
  }

  // No idle animation — announcer stays perfectly still
  _idleAnim() {}

  // ── Public: say arbitrary text ────────────────────────────────────────────
  sayText(text, onDone) {
    if (this._speaking) { speechSynthesis.cancel(); this._stopSeq() }
    this._speaking = true
    // Win sequence for BINGO / LINE, talk sequence for everything else
    this._startSeq(/bingo|line!/i.test(text) ? 'win' : 'talk')
    this._speak(text, () => {
      this._speaking = false
      this._stopSeq()
      if (onDone) onDone()
    })
  }

  // ── Public: announce a drawn ball number ──────────────────────────────────
  announce(number) {
    if (this._speaking) { speechSynthesis.cancel(); this._stopSeq() }
    this._speaking = true
    this._startSeq('talk')
    this._speak(say(number), () => {
      this._speaking = false
      this._stopSeq()
    })
  }

  // ── Private: Web Speech API ───────────────────────────────────────────────
  _speak(text, onEnd) {
    if (!('speechSynthesis' in window)) { onEnd(); return }
    const gen = ++this._speakGen          // snapshot current generation
    const utt = new SpeechSynthesisUtterance(text)
    if (!this._voice) this._voice = pickVoice()
    if (this._voice)  utt.voice = this._voice
    utt.pitch = 1.15; utt.rate = 0.88; utt.volume = 1
    // Only call onEnd if this utterance is still the current one
    const done = () => { if (this._speakGen === gen) onEnd() }
    // Minimum animation duration: ensures mouth movement is always visible even
    // when speech synthesis is blocked (e.g. Chrome autoplay policy fires onerror
    // immediately). Estimate ~380ms per word; min 1200ms.
    const minMs = Math.max(1200, text.split(/\s+/).length * 380)
    let minTimer = setTimeout(done, minMs)
    // If speech ends naturally (earlier than minMs) — clear the fallback and finish
    utt.onend  = () => { clearTimeout(minTimer); done() }
    // If speech is blocked/fails — let minTimer drive the animation; stay silent
    utt.onerror = () => { /* minTimer handles it */ }
    speechSynthesis.speak(utt)
  }

  reset() {
    speechSynthesis.cancel()
    this._speaking = false
    this._stopSeq()
  }
}
