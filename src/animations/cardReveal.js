import { gsap } from 'gsap'

export function animateCardIn(cardEl) {
  const cells = cardEl.querySelectorAll('.cell')
  const headers = cardEl.querySelectorAll('.header-cell')

  gsap.set(cardEl, { opacity: 0, scale: 0.9, y: 20 })
  gsap.set(headers, { opacity: 0, y: -20 })
  gsap.set(cells, { opacity: 0, scale: 0.5, rotateY: -90 })

  const tl = gsap.timeline()
  tl.to(cardEl, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' })
    .to(headers, { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' }, '-=0.2')
    .to(cells, {
      opacity: 1, scale: 1, rotateY: 0, duration: 0.4,
      stagger: { amount: 0.5, from: 'random' },
      ease: 'back.out(1.5)',
    }, '-=0.15')

  return tl
}

export function animateCellMark(cellEl) {
  const tl = gsap.timeline()
  tl.to(cellEl, { scale: 1.25, duration: 0.12, ease: 'power2.out' })
    .to(cellEl, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
  return tl
}

export function animateWinLine(cells) {
  const tl = gsap.timeline()
  tl.to(cells, {
    scale: 1.15,
    duration: 0.2,
    stagger: 0.06,
    ease: 'power2.out',
    yoyo: true,
    repeat: 1,
  })
  return tl
}
