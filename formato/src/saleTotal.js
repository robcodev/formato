export function parsePesos(value) {
  const text = String(value).trim().replace(/^(?:CLP\s*)?\$?\s*/i, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,00)?$/.test(text)) return null
  const amount = Number(text.replace(/,00$/, '').replace(/\./g, ''))
  return Number.isSafeInteger(amount) ? amount : null
}

export function extractSaleTotal(text) {
  const lines = text.replace(/\*\*/g, '').split(/\r?\n/).map(line => line.trim())
  const explicit = []
  for (let i = 0; i < lines.length; i++) {
    // Product-row totals and subtotals are not the order's total.
    const match = lines[i].match(/^(?:total(?:\s+(?:de\s+la\s+venta|venta|del\s+pedido|a\s+pagar|general))?|monto\s+total)\s*:?\s*(.*)$/i)
    if (!match) continue
    const next = lines.slice(i + 1).find(line => line)
    const amount = parsePesos(match[1] || next || '')
    if (amount !== null) explicit.push(amount)
  }
  const unique = [...new Set(explicit)]
  if (unique.length) return unique.length === 1 ? unique[0] : null
  // In the pasted sales screen, a standalone amount precedes customer details.
  const customerStart = lines.findIndex(line => /datos del cliente|^nombre/i.test(line))
  const header = customerStart === -1 ? lines : lines.slice(0, customerStart)
  const standalone = header.filter(line => /^\$\s*[\d.,]+$/.test(line)).map(parsePesos).filter(value => value !== null)
  return standalone.length === 1 ? standalone[0] : null
}

export function needsReceipt(value) {
  const amount = parsePesos(value)
  return amount !== null && amount > 50000
}
