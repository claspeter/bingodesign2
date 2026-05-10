const API   = ''
let TOKEN   = localStorage.getItem('userToken') || null
let profile = null

/* ── Helpers ── */
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    ...opts,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function showErr(el, msg)  { el.textContent = msg; el.classList.remove('hidden') }
function hideErr(el)       { el.classList.add('hidden') }

function fmtDate(str) {
  if (!str) return '–'
  return new Date(str).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
}
function fmtDateTime(str) {
  if (!str) return '–'
  return new Date(str).toLocaleString()
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

/* ── Auth tab switcher ── */
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => switchAuthTab(btn.dataset.target))
})
document.getElementById('goRegister').addEventListener('click', e => {
  e.preventDefault(); switchAuthTab('formRegister')
})
document.getElementById('goLogin').addEventListener('click', e => {
  e.preventDefault(); switchAuthTab('formLogin')
})

function switchAuthTab(targetId) {
  document.querySelectorAll('.auth-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.target === targetId))
  document.querySelectorAll('.auth-form').forEach(f =>
    f.classList.toggle('active', f.id === targetId))
}

/* ── Login ── */
document.getElementById('formLogin').addEventListener('submit', async e => {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  const err = document.getElementById('loginErr')
  hideErr(err); btn.disabled = true; btn.textContent = 'Signing in…'

  try {
    const data = await apiFetch('/api/user-auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email:    document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
      }),
    })
    TOKEN = data.token
    localStorage.setItem('userToken', TOKEN)
    await loadDashboard()
  } catch (err2) {
    showErr(err, err2.message)
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In'
  }
})

/* ── Register ── */
document.getElementById('formRegister').addEventListener('submit', async e => {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  const err = document.getElementById('registerErr')
  hideErr(err); btn.disabled = true; btn.textContent = 'Creating account…'

  const password = document.getElementById('regPassword').value
  if (password.length < 6) {
    showErr(err, 'Password must be at least 6 characters')
    btn.disabled = false; btn.textContent = 'Create Account'
    return
  }

  try {
    const data = await apiFetch('/api/user-auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name:     document.getElementById('regName').value.trim(),
        email:    document.getElementById('regEmail').value.trim(),
        phone:    document.getElementById('regPhone').value.trim() || null,
        password,
      }),
    })
    TOKEN = data.token
    localStorage.setItem('userToken', TOKEN)
    await loadDashboard()
  } catch (err2) {
    showErr(err, err2.message)
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account'
  }
})

/* ── Logout ── */
document.getElementById('logoutBtn').addEventListener('click', () => {
  TOKEN = null; profile = null
  localStorage.removeItem('userToken')
  showScreen('loginScreen')
})

/* ── Tab nav ── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active')
    if (btn.dataset.tab === 'tickets')      loadTickets()
    if (btn.dataset.tab === 'live')         loadLiveTab()
    if (btn.dataset.tab === 'sell')         loadSellTab()
    if (btn.dataset.tab === 'transactions') loadTransactions()
  })
})

/* ── Load dashboard ── */
async function loadDashboard() {
  profile = await apiFetch('/api/user-portal/me')
  renderTopbar()
  renderOverview()
  showScreen('dashboard')
}

function renderTopbar() {
  document.getElementById('topName').textContent    = profile.name
  document.getElementById('topPoints').textContent  = Number(profile.points ?? 0).toLocaleString()

  const badge = document.getElementById('regTypeBadge')
  const isAgent = !!profile.agent_name
  badge.textContent  = isAgent ? 'Agent User' : 'Member'
  badge.className    = `reg-badge ${isAgent ? 'rb-agent' : 'rb-self'}`
}

function renderOverview() {
  document.getElementById('ovPoints').textContent = Number(profile.points ?? 0).toLocaleString()
  document.getElementById('prName').textContent   = profile.name
  document.getElementById('prEmail').textContent  = profile.email || '–'
  document.getElementById('prPhone').textContent  = profile.phone || '–'
  document.getElementById('prSince').textContent  = fmtDate(profile.created_at)

  const isAgent = !!profile.agent_name
  document.getElementById('prType').textContent = isAgent ? 'Agent User' : 'Member (self-registered)'

  const agentRow = document.getElementById('agentRow')
  if (isAgent) {
    agentRow.style.display = 'flex'
    document.getElementById('prAgent').textContent = profile.agent_name
  } else {
    agentRow.style.display = 'none'
  }
}

/* ════════════════════════════════════════════
   BINGO CARD / TICKET RENDERING
   ════════════════════════════════════════════ */

function isPresetFormat(numbers) {
  return Array.isArray(numbers) && numbers.length > 0 && typeof numbers[0] === 'object' && 'row1' in numbers[0]
}

function renderCardGrid(card, calledSet, highlightRows = new Set(), highlightAll = false, tableClass = 'card-grid') {
  const rows = [card.row1, card.row2, card.row3]
  const rowsHtml = rows.map((row, ri) => {
    const cells = row.map(n => {
      if (n === null) return '<td class="blank"></td>'
      const isCalled = calledSet.has(n)
      const isWin    = highlightAll ? isCalled : (isCalled && highlightRows.has(ri))
      const cls = isWin
        ? (highlightAll ? 'bingo-win' : 'line-win')
        : isCalled ? 'called' : 'num'
      return `<td class="${cls}">${n}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  return `<table class="${tableClass}">${rowsHtml}</table>`
}

function renderBingoTicket(cards, calledSet, opts = {}) {
  return cards.map((card, i) => {
    const grid = renderCardGrid(card, calledSet)
    const sep  = i < cards.length - 1 ? '<div class="card-sep">— — —</div>' : ''
    return `
      <div class="bingo-card">
        <div class="card-code-label">Card ${esc(card.code)}</div>
        ${grid}
      </div>${sep}`
  }).join('')
}

/* ── Win detection ── */
function checkLineWin(card, calledSet) {
  const rows = [card.row1, card.row2, card.row3]
  for (let i = 0; i < 3; i++) {
    const nums = rows[i].filter(n => n !== null)
    if (nums.length && nums.every(n => calledSet.has(n))) return i
  }
  return -1
}

function checkBingo(card, calledSet) {
  const nums = [...card.row1, ...card.row2, ...card.row3].filter(n => n !== null)
  return nums.every(n => calledSet.has(n))
}

/* ════════════════════════════════════════════
   WIN OVERLAY
   ════════════════════════════════════════════ */

let winShownFor = new Set() // track card codes already announced

function showWinOverlay(card, calledSet, type) {
  const key = card.code + ':' + type
  if (winShownFor.has(key)) return
  winShownFor.add(key)

  const badge = document.getElementById('winBadge')
  badge.textContent = type === 'bingo' ? 'BINGO!' : 'LINE!'
  badge.className   = 'win-badge ' + type

  document.getElementById('winCardId').textContent = 'Card ' + card.code

  const highlightRows = new Set()
  if (type === 'line') {
    const ri = checkLineWin(card, calledSet)
    if (ri >= 0) highlightRows.add(ri)
  }
  document.getElementById('winCardGrid').outerHTML =
    renderCardGrid(card, calledSet, highlightRows, type === 'bingo', 'win-card-grid')
      .replace('<table ', '<table id="winCardGrid" ')

  document.getElementById('winOverlay').classList.remove('hidden')
}

document.getElementById('winDismiss').addEventListener('click', () => {
  document.getElementById('winOverlay').classList.add('hidden')
})

/* ════════════════════════════════════════════
   MY TICKETS TAB
   ════════════════════════════════════════════ */

document.getElementById('refreshTickets').addEventListener('click', loadTickets)

let allTickets = []

async function loadTickets() {
  const el = document.getElementById('ticketList')
  el.innerHTML = '<div class="empty-state"><div class="ei">⏳</div><p>Loading…</p></div>'

  try {
    allTickets = await apiFetch('/api/user-portal/tickets')

    document.getElementById('ovTickets').textContent = allTickets.length
    const wins = allTickets.filter(t => t.prize_amount > 0).length
    document.getElementById('ovWins').textContent = wins

    if (!allTickets.length) {
      el.innerHTML = '<div class="empty-state"><div class="ei">🎟️</div><p>No tickets yet</p></div>'
      return
    }

    el.innerHTML = allTickets.map(t => {
      const numbers = JSON.parse(t.numbers || '[]')
      const statusColor = t.status === 'active' ? 'var(--accent)' :
                          t.prize_amount > 0 ? 'var(--success)' : 'var(--muted)'

      if (isPresetFormat(numbers)) {
        // 6-card bingo ticket grid (no live marking in static view)
        const emptySet  = new Set()
        const cardsHtml = renderBingoTicket(numbers, emptySet)
        return `
          <div class="bingo-ticket-wrap">
            <div class="bingo-ticket-meta">
              <span><strong>${esc(t.draw_title)}</strong> &nbsp;·&nbsp; ${fmtDate(t.draw_date)} ${esc(t.draw_time ?? '')}</span>
              <span style="color:${statusColor}">${esc(t.draw_status ?? t.status)}</span>
            </div>
            ${cardsHtml}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
              ${t.prize_amount > 0
                ? `<span class="ticket-prize">🏆 Won ${Number(t.prize_amount).toLocaleString()} pts</span>`
                : `<span style="font-size:12px;color:var(--muted)">Paid: ${Number(t.purchase_price).toLocaleString()} pts</span>`}
              <button class="btn-watch" data-tid="${t.id}">▶ Watch Live</button>
            </div>
          </div>`
      }

      // Legacy flat-number format
      const balls = numbers.map(n => `<div class="ball">${n}</div>`).join('')
      return `
        <div class="ticket-card">
          <div class="ticket-header">
            <span class="ticket-draw">${esc(t.draw_title)}</span>
            <span class="ticket-date">${fmtDate(t.draw_date)} ${esc(t.draw_time ?? '')}</span>
          </div>
          <div class="ticket-numbers">${balls}</div>
          <div class="ticket-footer">
            <span style="color:${statusColor}">${esc(t.draw_status ?? t.status)}</span>
            ${t.prize_amount > 0
              ? `<span class="ticket-prize">🏆 Won ${Number(t.prize_amount).toLocaleString()} pts</span>`
              : `<span>Paid: ${Number(t.purchase_price).toLocaleString()} pts</span>`}
          </div>
        </div>`
    }).join('')

    // Wire "Watch Live" buttons
    el.querySelectorAll('.btn-watch').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid  = Number(btn.dataset.tid)
        const tkData = allTickets.find(t => t.id === tid)
        if (tkData) watchTicket(tkData)
      })
    })

  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Error: ${esc(err.message)}</p></div>`
  }
}

/* ════════════════════════════════════════════
   LIVE DRAW TAB
   ════════════════════════════════════════════ */

let socket       = null
let liveCards    = null   // array of 6 card objects being watched
let calledSet    = new Set()
let lineWinDone  = false
let bingoWinDone = false

function setLiveStatus(text, state = 'off') {
  const el = document.getElementById('liveStatus')
  const dot = state === 'on'  ? 'on'  :
              state === 'off' ? 'off' : ''
  el.innerHTML = `<div class="live-dot ${dot}"></div>${esc(text)}`
}

function initSocket() {
  if (socket) return
  socket = io({ transports: ['websocket', 'polling'] })

  socket.on('connect', () => setLiveStatus('Live draw connected', 'on'))
  socket.on('disconnect', () => setLiveStatus('Disconnected — reconnecting…', 'off'))

  socket.on('state', ({ called, gameOver }) => {
    calledSet = new Set(called)
    if (gameOver) setLiveStatus('Draw has ended', 'off')
    refreshLiveGrid()
  })

  socket.on('number-drawn', ({ number, called }) => {
    calledSet = new Set(called)
    refreshLiveGrid()
    checkAllWins()
  })

  socket.on('game-reset', () => {
    calledSet     = new Set()
    lineWinDone   = false
    bingoWinDone  = false
    winShownFor   = new Set()
    refreshLiveGrid()
    setLiveStatus('New draw started', 'on')
  })

  socket.on('game-over', () => setLiveStatus('Draw complete', 'off'))
}

function refreshLiveGrid() {
  if (!liveCards) return
  const grid = document.getElementById('liveTicketGrid')
  if (!grid) return
  grid.innerHTML = renderBingoTicket(liveCards, calledSet)
}

function checkAllWins() {
  if (!liveCards) return
  for (const card of liveCards) {
    if (!bingoWinDone && checkBingo(card, calledSet)) {
      bingoWinDone = true
      lineWinDone  = true
      showWinOverlay(card, calledSet, 'bingo')
      return
    }
    if (!lineWinDone && checkLineWin(card, calledSet) >= 0) {
      lineWinDone = true
      showWinOverlay(card, calledSet, 'line')
      return
    }
  }
}

function watchTicket(ticketData) {
  const numbers = JSON.parse(ticketData.numbers || '[]')
  if (!isPresetFormat(numbers)) return

  liveCards    = numbers
  lineWinDone  = false
  bingoWinDone = false
  winShownFor  = new Set()

  // Switch to Live tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
  document.querySelector('.tab-btn[data-tab="live"]').classList.add('active')
  document.getElementById('tab-live').classList.add('active')

  // Show ticket view
  document.getElementById('liveTicketPicker').classList.add('hidden')
  document.getElementById('liveTicketView').classList.remove('hidden')
  document.getElementById('liveTicketLabel').textContent =
    `${ticketData.draw_title} — ${fmtDate(ticketData.draw_date)}`

  refreshLiveGrid()
  initSocket()
}

function loadLiveTab() {
  initSocket()

  if (liveCards) {
    document.getElementById('liveTicketPicker').classList.add('hidden')
    document.getElementById('liveTicketView').classList.remove('hidden')
    refreshLiveGrid()
    return
  }

  // Show picker if user has preset tickets
  const presetTickets = allTickets.filter(t => {
    const n = JSON.parse(t.numbers || '[]')
    return isPresetFormat(n)
  })

  const picker = document.getElementById('liveTicketPicker')
  const list   = document.getElementById('livePickerList')

  if (!presetTickets.length) {
    setLiveStatus('Connected — no tickets to display', 'on')
    picker.classList.add('hidden')
    document.getElementById('liveTicketView').classList.add('hidden')
    return
  }

  list.innerHTML = presetTickets.map(t => `
    <div class="picker-item">
      <span><strong>${esc(t.draw_title)}</strong> &nbsp;·&nbsp; ${fmtDate(t.draw_date)}</span>
      <button class="btn-watch" data-tid="${t.id}">Watch</button>
    </div>`).join('')

  list.querySelectorAll('.btn-watch').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = Number(btn.dataset.tid)
      const tk  = allTickets.find(t => t.id === tid)
      if (tk) watchTicket(tk)
    })
  })

  picker.classList.remove('hidden')
  document.getElementById('liveTicketView').classList.add('hidden')
}

document.getElementById('liveChangeTkt').addEventListener('click', () => {
  liveCards = null
  document.getElementById('liveTicketView').classList.add('hidden')
  loadLiveTab()
})

/* ── Sell Points ── */
function loadSellTab() {
  const bal = Number(profile?.points ?? 0)
  document.getElementById('sellBal').textContent = bal.toLocaleString()
  document.getElementById('sellAmt').value = '0'

  const infoEl = document.getElementById('sellAgentInfo')
  const btn    = document.getElementById('sellBtn')
  if (profile?.agent_name) {
    infoEl.textContent = `Your agent is ${profile.agent_name}. Sell points back and they will be returned to your agent's balance.`
    btn.disabled = false
  } else {
    infoEl.textContent = 'Your account is not linked to an agent — points cannot be sold back.'
    btn.disabled = true
  }
}

document.getElementById('sellBtn').addEventListener('click', async () => {
  const errEl  = document.getElementById('sellErr')
  const succEl = document.getElementById('sellSucc')
  errEl.classList.add('hidden'); succEl.classList.add('hidden')

  const points = parseInt(document.getElementById('sellAmt').value) || 0
  if (points <= 0) { errEl.textContent = 'Enter a valid amount'; errEl.classList.remove('hidden'); return }

  const btn = document.getElementById('sellBtn')
  btn.disabled = true
  try {
    const result = await apiFetch('/api/user-portal/sell-points', {
      method: 'POST',
      body: JSON.stringify({ points }),
    })
    succEl.textContent =
      `${points.toLocaleString()} points sold back to ${result.agent_name}. ` +
      `Your balance: ${result.remaining_points.toLocaleString()} pts`
    succEl.classList.remove('hidden')
    document.getElementById('sellAmt').value = '0'

    // Refresh profile to update balance everywhere
    profile = await apiFetch('/api/user-portal/me')
    renderTopbar()
    document.getElementById('sellBal').textContent =
      Number(profile.points ?? 0).toLocaleString()
  } catch (err) {
    errEl.textContent = err.message
    errEl.classList.remove('hidden')
  } finally {
    btn.disabled = false
  }
})

/* ── Transactions ── */
document.getElementById('refreshTxns').addEventListener('click', loadTransactions)

async function loadTransactions() {
  const el = document.getElementById('txnList')
  el.innerHTML = '<div class="empty-state"><div class="ei">⏳</div><p>Loading…</p></div>'

  try {
    const txns = await apiFetch('/api/user-portal/transactions')
    if (!txns.length) {
      el.innerHTML = '<div class="empty-state"><div class="ei">📋</div><p>No transactions yet</p></div>'
      return
    }
    const ICONS = { deposit:'💵', withdraw:'💸', prize:'🏆', points_received:'📥', points_allocated:'📤', ticket_purchase:'🎟️' }
    el.innerHTML = txns.map(t => {
      const isPos = t.amount > 0
      const icon  = ICONS[t.type] || (isPos ? '📥' : '📤')
      return `
        <div class="txn-row">
          <div class="txn-icon">${icon}</div>
          <div class="txn-info">
            <div class="txn-desc">${esc(t.description || t.type)}</div>
            <div class="txn-date">${fmtDateTime(t.created_at)}</div>
          </div>
          <div class="txn-amt ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : ''}${Number(t.amount).toLocaleString()} pts</div>
        </div>`
    }).join('')
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Error: ${esc(err.message)}</p></div>`
  }
}

/* ── Init ── */
if (TOKEN) {
  loadDashboard().catch(() => {
    TOKEN = null
    localStorage.removeItem('userToken')
    showScreen('loginScreen')
  })
} else {
  showScreen('loginScreen')
}
