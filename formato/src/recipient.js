import { extractSaleTotal } from './saleTotal.js'

const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
const aliases = {
  nombres: ['nombre completo', 'nombres', 'nombre', 'cliente'],
  rut: ['documento de identidad', 'rut', 'r.u.t'],
  telefono: ['telefono', 'numero', 'celular'],
  correo: ['correo electronico', 'correo', 'email', 'e-mail'],
  comuna: ['comuna', 'ciudad'],
  domicilio: ['direccion', 'domicilio'],
  unidad: ['dep.ofi.casa', 'dep. ofi. casa', 'departamento', 'depto', 'oficina', 'casa'],
  sucursal: ['sucursal'],
  receptor: ['quien recibe'],
  indicaciones: ['informacion adicional', 'notas adicionales', 'indicaciones', 'observaciones', 'notas', 'comentarios'],
  cliente: ['datos del cliente'],
  envio: ['envio'],
  tipo: ['tipo de pedido'],
  preventa: ['preventa', 'numero de despacho'],
  ignorar: ['archivo adjunto', 'rango de despacho', 'region', 'giro', 'detalle', 'despacho', 'pago', 'notificaciones', 'historial', 'total', 'total de la venta', 'total venta', 'total del pedido', 'total a pagar', 'total general', 'monto total', 'subtotal'],
}
const labels = Object.entries(aliases).flatMap(([key, values]) => values.map(label => ({ key, label }))).sort((a, b) => b.label.length - a.label.length)
const present = value => value && !/^[-–—]+$/.test(value.trim())
const rutPattern = /\b\d{1,2}(?:\.?\d{3}){2}-[0-9kK]\b/
const phonePattern = /(?:\+56[\s-]*)?9[\s-]*\d{4}[\s-]*\d{4}\b/
const formatRut = value => {
  const digits = value.replace(/[^0-9kK]/g, '').toUpperCase()
  return digits.length >= 8 && digits.length <= 9 ? `${digits.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${digits.slice(-1)}` : value
}

export function parseRecipient(text) {
  // Separate bold labels from their adjacent values before removing Markdown.
  const clean = text.replace(/\\([@_.*])/g, '$1').replace(/\*\*([^*]+)\*\*/g, '\n$1\n')
  const lines = clean.split(/\r?\n/).map(line => line.replace(/^\s*#+\s*/, '').replace(/^(?:person|local_shipping|note_add)\s*/, '').trim()).filter(Boolean)
  const records = []
  for (const line of lines) {
    if (/^\$\s*[\d.,]+$/.test(line)) continue
    const normalized = normalize(line)
    const match = labels.find(({ label }) => normalized === label || normalized.startsWith(`${label}:`))
    if (match) records.push({ key: match.key, value: line.slice(match.label.length).replace(/^\s*:\s*/, '').trim() })
    else if (records.length && !line.startsWith('|')) records.at(-1).value += `${records.at(-1).value ? '\n' : ''}${line}`
  }
  const result = {}
  const receiver = {}
  const notes = []
  let inReceiver = false
  let hasReceiver = false
  let orderType = ''
  for (const { key, value } of records) {
    if (key === 'cliente' || key === 'envio') { inReceiver = false; continue }
    if (key === 'receptor') {
      inReceiver = true
      hasReceiver = Boolean(present(value))
      if (hasReceiver) {
        const rut = value.match(rutPattern)?.[0]
        const phone = value.match(phonePattern)?.[0]
        receiver.nombres = value.replace(rut || /$^/, '').replace(phone || /$^/, '').replace(/\b(?:rut|tel[eé]fono|celular)\s*:?/gi, '').replace(/^[\s,;|–-]+|[\s,;|–-]+$/g, '').trim()
        if (rut) receiver.rut = rut
        if (phone) receiver.telefono = phone
      }
      continue
    }
    if (key === 'indicaciones') { result.indicaciones = ''; if (present(value)) notes.push(value); inReceiver = false; continue }
    if (!present(value)) { if (key === 'unidad') result.unidad = ''; continue }
    if (inReceiver && ['nombres', 'rut', 'telefono'].includes(key)) {
      receiver[key] = value
      if (key === 'nombres') hasReceiver = true
      continue
    }
    if (key === 'tipo') { orderType = value; continue }
    // This is the seller's branch (e.g. Casa Matriz), never the destination.
    if (['ignorar', 'sucursal'].includes(key)) continue
    if (!result[key] || key === 'domicilio') result[key] = value
  }
  if (notes.length) result.indicaciones = [...new Set(notes)].join('\n')
  const order = clean.match(/\bpre\s*[-\s]*venta\s*(?:n[°ºo]?\.?|numero|#|:)?\s*(\d+)/i)
  if (order) result.preventa = order[1]
  const email = clean.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  if (!result.correo && email) result.correo = email[0]
  if (hasReceiver) {
    // Never identify a different receiver with the purchaser's RUT or phone.
    result.nombres = receiver.nombres || ''
    result.rut = receiver.rut || ''
    result.telefono = receiver.telefono || ''
  } else {
    const rut = clean.match(rutPattern)?.[0]
    const phone = clean.match(phonePattern)?.[0]
    if (!result.rut && rut) result.rut = rut
    if (!result.telefono && phone) result.telefono = phone
  }
  if (result.rut) result.rut = formatRut(result.rut)
  const n = normalize(clean)
  if (/\bpor\s*pagar\b/.test(n)) result.pago = 'Por pagar'
  else if (/\bpagado\b/.test(n)) result.pago = 'Pagado'
  else if (/\bcuenta corriente\b/.test(n)) result.pago = 'Cuenta corriente'
  const address = normalize(result.domicilio || '')
  const type = normalize(orderType)
  if (/\bsucursal\b/.test(address)) result.entrega = 'Retiro en sucursal'
  else if (/\ba domicilio\b/.test(address)) result.entrega = 'A domicilio'
  else if (/\bsucursal\b/.test(type)) result.entrega = 'Retiro en sucursal'
  else if (/\ba domicilio\b/.test(type)) result.entrega = 'A domicilio'
  const total = extractSaleTotal(text)
  if (total !== null) result.totalVenta = String(total)
  return result
}

