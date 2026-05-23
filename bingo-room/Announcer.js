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

// Image base path for the 4 announcers × 3 poses
const IMG = (type, pose) => `/bingo-room/announcers/ann-${type}-${pose}.png`

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
    this._type     = 'a'      // default announcer; changed by setType()
    this._voice    = null
    this._speaking = false
    this._unlocked = false
    this._mouthInterval = null

    speechSynthesis.onvoiceschanged = () => { this._voice = pickVoice() }
    this._voice = pickVoice()

    this._build()
    this._idleAnim()
    this._unlock()
  }

  // ── Public: switch to a different announcer (called when draw changes) ──
  setType(type) {
    if (!type || !['a','b','c','d'].includes(type)) return
    this._type = type
    this._setImg('closed')
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  _setImg(pose) {
    if (this._img) this._img.src = IMG(this._type, pose)
  }

  _startMouth() {
    clearInterval(this._mouthInterval)
    let open = false
    this._mouthInterval = setInterval(() => {
      open = !open
      this._setImg(open ? 'talking' : 'closed')
    }, 180)
  }

  _stopMouth() {
    clearInterval(this._mouthInterval)
    this._mouthInterval = null
    this._setImg('closed')
  }

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
    }
    document.addEventListener('click',      handler)
    document.addEventListener('keydown',    handler)
    document.addEventListener('touchstart', handler)
  }

  _build() {
    const el = document.createElement('div')
    el.id        = 'announcer'
    el.className = 'announcer'
    el.innerHTML = `
      <div class="ann-bubble" id="ann-bubble">
        <span class="ann-bubble-num" id="ann-bubble-num"></span>
      </div>
      <img class="announcer-img" src="${IMG(this._type, 'closed')}" alt="announcer"/>
    `
    document.body.appendChild(el)
    this._el        = el
    this._img       = el.querySelector('.announcer-img')
    this._bubble    = el.querySelector('#ann-bubble')
    this._bubbleNum = el.querySelector('#ann-bubble-num')
  }

  _idleAnim() {
    gsap.to(this._el, {
      y: -7, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1,
    })
  }

  // ── Show speech bubble ────────────────────────────────────────────────────
  _showBubble(text) {
    this._bubbleNum.textContent = text
    gsap.fromTo(this._bubble,
      { opacity: 0, scale: 0.4, y: 12 },
      { opacity: 1, scale: 1,   y: 0,  duration: 0.4, ease: 'back.out(1.7)' }
    )
    // Bounce
    gsap.timeline()
      .to(this._el, { y: '-=10', duration: 0.2, ease: 'power2.out' })
      .to(this._el, { y: '+=10', duration: 0.3, ease: 'bounce.out' })
  }

  _hideBubble() {
    gsap.to(this._bubble, { opacity: 0, scale: 0.75, duration: 0.45, delay: 0.4 })
  }

  // ── Public: say arbitrary text (optional onDone callback) ────────────────
  sayText(text, onDone) {
    if (this._speaking) { speechSynthesis.cancel(); this._stopMouth() }
    this._speaking = true

    // Excited pose for BINGO/LINE, talking for everything else
    const isExcited = /bingo|line!/i.test(text)
    this._setImg(isExcited ? 'excited' : 'talking')
    if (!isExcited) this._startMouth()

    this._showBubble(text)

    this._speak(text, () => {
      this._speaking = false
      this._stopMouth()
      this._hideBubble()
      if (onDone) onDone()
    })
  }

  // ── Public: announce a ball number ───────────────────────────────────────
  announce(number) {
    if (this._speaking) { speechSynthesis.cancel(); this._stopMouth() }
    this._speaking = true

    this._startMouth()
    this._showBubble(number)

    gsap.timeline()
      .to(this._el, { y: '-=14', duration: 0.18, ease: 'power2.out' })
      .to(this._el, { y: '+=14', duration: 0.28, ease: 'bounce.out' })

    this._speak(say(number), () => {
      this._speaking = false
      this._stopMouth()
      gsap.to(this._bubble, { opacity: 0, scale: 0.75, duration: 0.45, delay: 0.6 })
    })
  }

  // ── Private: Web Speech API ───────────────────────────────────────────────
  _speak(text, onEnd) {
    if (!('speechSynthesis' in window)) { onEnd(); return }
    const utt = new SpeechSynthesisUtterance(text)
    if (!this._voice) this._voice = pickVoice()
    if (this._voice)  utt.voice = this._voice
    utt.pitch = 1.15; utt.rate = 0.88; utt.volume = 1
    utt.onend   = onEnd
    utt.onerror = onEnd
    speechSynthesis.speak(utt)
  }

  reset() {
    speechSynthesis.cancel()
    this._stopMouth()
    this._speaking = false
  }
}
