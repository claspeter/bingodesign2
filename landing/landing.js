async function loadDraws() {
  const grid = document.getElementById('drawsGrid')
  try {
    const res  = await fetch('/api/special-draws')
    const data = await res.json()

    if (!data.length) {
      grid.innerHTML = '<div class="no-draws">No upcoming draws at the moment — check back soon.</div>'
      return
    }

    grid.innerHTML = data.map(d => {
      const badgeCls   = d.status === 'running'   ? 'badge-live'
                       : d.status === 'scheduled' ? 'badge-upcoming'
                       : 'badge-completed'
      const badgeLabel = d.status === 'running'   ? '● Live Now'
                       : d.status === 'scheduled' ? '⏳ Upcoming'
                       : '✓ Completed'
      const price = Number(d.ticket_price ?? 1).toLocaleString()
      const date  = d.draw_date
        ? new Date(d.draw_date + 'T00:00:00Z').toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })
        : ''
      return `
        <a href="/user-portal" class="draw-card-l">
          <div class="draw-card-l-title">${esc(d.title)}</div>
          <div class="draw-card-l-meta">${date}${date && d.draw_time ? ' · ' : ''}${esc(d.draw_time ?? '')}</div>
          <div class="draw-card-l-row">
            <span class="draw-badge ${badgeCls}">${badgeLabel}</span>
            <span class="draw-price">${price} pt${price === '1' ? '' : 's'} / ticket</span>
          </div>
          ${d.full_house_prize ? `<div class="draw-avail">Full House: ${Number(d.full_house_prize).toLocaleString()} pts</div>` : ''}
        </a>`
    }).join('')
  } catch {
    grid.innerHTML = '<div class="no-draws">Could not load draws.</div>'
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

loadDraws()
