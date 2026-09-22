import { useLayoutEffect, useRef, useState } from 'react'
import './App.css'

const fields = [
  ['preventa', 'Número de despacho', 'Ej. 27967', ['preventa', 'numero de despacho']],
  ['nombres', 'Nombre completo', 'Nombre y apellido', ['nombre', 'nombres', 'cliente', 'nombre completo']],
  ['rut', 'RUT', '12.345.678-9', ['rut', 'r.u.t', 'documento de identidad']],
  ['telefono', 'Teléfono', '+56 9 1234 5678', ['telefono', 'numero', 'celular']],
  ['correo', 'Correo electrónico', 'nombre@correo.cl', ['correo', 'email', 'e-mail', 'correo electronico']],
  ['comuna', 'Comuna / ciudad', 'Providencia', ['comuna', 'ciudad']],
  ['domicilio', 'Dirección o sucursal', 'Calle, número, departamento o sucursal', ['direccion', 'domicilio', 'sucursal']],
  ['indicaciones', 'Indicaciones adicionales', 'Referencias para la entrega', ['indicaciones', 'observaciones']],
]
const empty = Object.fromEntries(fields.map(([name]) => [name, '']))
const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
const lookup = text => fields.find(field => field[3].includes(normalize(text).replace(/:$/, '').trim()))?.[0]

function App() {
  const [raw, setRaw] = useState('')
  const [data, setData] = useState({ ...empty, entrega: '', pago: '' })
  const [message, setMessage] = useState('')
  const labelRef = useRef(null)
  const contentRef = useRef(null)
  useLayoutEffect(() => {
    const label = labelRef.current
    const content = contentRef.current
    const fit = () => {
      const style = getComputedStyle(label)
      const available = label.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      const scale = Math.min(1, available / Math.max(content.offsetHeight, 1))
      content.style.transform = `scale(${scale})`
    }
    const observer = new ResizeObserver(fit)
    observer.observe(label)
    observer.observe(content)
    window.addEventListener('beforeprint', fit)
    window.addEventListener('afterprint', fit)
    fit()
    return () => {
      observer.disconnect()
      window.removeEventListener('beforeprint', fit)
      window.removeEventListener('afterprint', fit)
    }
  }, [data])
  function extract(text) {
    const result = {}
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    for (let i = 0; i < lines.length; i++) {
      const colon = lines[i].indexOf(':')
      const key = lookup(colon < 0 ? lines[i] : lines[i].slice(0, colon))
      if (!key) continue
      let value = colon < 0 ? '' : lines[i].slice(colon + 1).trim()
      const next = lines[i + 1]
      if (!value && next && !lookup(next.split(':')[0]) && !['region', 'tipo de pedido', 'quien recibe', 'rango de despacho', '-', 'person', 'local_shipping'].includes(normalize(next))) value = next
      if (value && value !== '-' && !result[key]) result[key] = value
    }
    const order = text.match(/\bpre\s*[-\s]*venta\s*(?:n[°ºo]?\.?|numero|#|:)?\s*(\d+)/i)
    if (order) result.preventa = order[1]
    const mail = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    if (!result.correo && mail) result.correo = mail[0]
    const rut = text.match(/\b\d{1,2}(?:\.?\d{3}){2}-[0-9kK]\b/)
    if (!result.rut && rut) result.rut = rut[0]
    if (result.rut) {
      const digits = result.rut.replace(/[^0-9kK]/g, '').toUpperCase()
      if (digits.length >= 8 && digits.length <= 9) result.rut = `${digits.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${digits.slice(-1)}`
    }
    const phone = text.match(/(?:\+56[\s-]*)?9[\s-]*\d{4}[\s-]*\d{4}\b/)
    if (!result.telefono && phone) result.telefono = phone[0]
    const n = normalize(text)
    if (/\bpor\s*pagar\b/.test(n)) result.pago = 'Por pagar'
    else if (/\bpagado\b/.test(n)) result.pago = 'Pagado'
    else if (/\bcuenta corriente\b/.test(n)) result.pago = 'Cuenta corriente'
    if (/\b(?:retiro en|envio a|entrega en) sucursal\b/.test(n)) result.entrega = 'Retiro en sucursal'
    else if (/\ba domicilio\b/.test(n)) result.entrega = 'A domicilio'
    setData(previous => ({ ...previous, ...result }))
    setMessage(Object.keys(result).length ? 'Datos extraídos. Revisa y ajusta los campos antes de imprimir.' : 'No encontramos datos reconocibles. Puedes escribirlos manualmente.')
  }
  function change(event) {
    const { name, value } = event.target
    setData(previous => ({ ...previous, [name]: value }))
  }
  return <main className="app-shell">
    <div className="workspace">
      <div className="editor">
        <section className="panel">
          <textarea id="source" className="source-input" value={raw} placeholder={'Nombre: María González\nTeléfono: +56 9 1234 5678\nDirección: Av. Providencia 123\nComuna: Providencia'} onChange={e => setRaw(e.target.value)} onPaste={e => { e.preventDefault(); const text = e.clipboardData.getData('text'); setRaw(text); extract(text) }} />
          <div className="source-footer"><p>Los campos se completan al pegar.</p><button className="button secondary" disabled={!raw.trim()} onClick={() => extract(raw)}>Volver a extraer</button></div>
          <p role="status" className="status">{message}</p>
        </section>
        <section className="panel">
          <div className="section-heading"><span className="step">2</span><h2>Revisa y edita</h2></div>
          <p className="description">Puedes editar todos los campos, incluso sin pegar texto.</p>
          <div className="fields">{fields.map(([name, label, placeholder]) => <label className={`field ${['nombres', 'domicilio', 'indicaciones'].includes(name) ? 'wide' : ''}`} key={name}><span>{label}</span>{['domicilio', 'indicaciones'].includes(name) ? <textarea name={name} value={data[name]} placeholder={placeholder} onChange={change} rows={2} /> : <input name={name} value={data[name]} placeholder={placeholder} onChange={change} type={name === 'correo' ? 'email' : name === 'telefono' ? 'tel' : 'text'} />}</label>)}
            <label className="field"><span>Entrega</span><select name="entrega" value={data.entrega} onChange={change}><option value="">Sin especificar</option><option>A domicilio</option><option>Retiro en sucursal</option></select></label>
            <label className="field"><span>Pago del envío</span><select name="pago" value={data.pago} onChange={change}><option value="">Sin especificar</option><option>Por pagar</option><option>Pagado</option><option>Cuenta corriente</option></select></label>
          </div>
        </section>
      </div>
      <aside className="preview-column">
        <div className="preview-heading"><h2>Vista previa</h2><span>10 × 15 cm</span></div>
        <article ref={labelRef} className="shipping-label" aria-label="Vista previa de la etiqueta de 10 por 15 centímetros">
          <div ref={contentRef} className="label-content">
          <div className="label-header"><span>DESPACHO</span><strong>{data.preventa ? `#${data.preventa}` : '—'}</strong></div>
          <div className="recipient"><span className="label-caption">DESTINATARIO</span><h3>{data.nombres || 'Nombre del destinatario'}</h3>{data.rut && <p>RUT: {data.rut}</p>}</div>
          <div className="destination"><span className="label-caption">DIRECCIÓN / SUCURSAL</span><p>{data.domicilio || 'Dirección de entrega'}</p><strong>{data.comuna || 'Comuna / ciudad'}</strong></div>
          {(data.telefono || data.correo) && <div className="contact">{data.telefono && <p><span>Teléfono</span>{data.telefono}</p>}{data.correo && <p><span>Correo</span>{data.correo}</p>}</div>}
          {data.indicaciones && <div className="notes"><span className="label-caption">INDICACIONES</span><p>{data.indicaciones}</p></div>}
          {(data.entrega || data.pago) && <div className="label-tags">{data.entrega && <span>{data.entrega}</span>}{data.pago && <span>{data.pago}</span>}</div>}
          </div>
        </article>
        <button className="button primary" disabled={!Object.values(data).some(value => value.trim())} onClick={() => window.print()}>Imprimir etiqueta</button>
        <p className="print-help">Papel de 100 × 150 mm y escala 100 %. Si tu navegador agrega título o numeración, desactiva «Encabezados y pies de página» al imprimir.</p>
      </aside>
    </div>
  </main>
}
export default App
