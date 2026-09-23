import { useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import { parseRecipient } from './recipient.js'
import { needsReceipt, parsePesos } from './saleTotal.js'

const empty = { preventa: '', nombres: '', rut: '', telefono: '', correo: '', comuna: '', indicaciones: '', domicilio: '', sucursalDestino: '', unidad: '', entrega: '', pago: '', totalVenta: '' }

function LabelField({ name, value, placeholder, onChange }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const input = ref.current
    const resize = () => {
      input.style.height = '0px'
      input.style.height = `${input.scrollHeight}px`
    }
    resize()
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== Number(input.dataset.width)) {
        input.dataset.width = String(input.clientWidth)
        resize()
      }
    })
    observer.observe(input)
    return () => observer.disconnect()
  }, [value])
  return <span className="label-edit">
    <textarea ref={ref} aria-label={placeholder} name={name} value={value} placeholder={placeholder} onChange={onChange} rows={1} />
    <span className="label-value">{value}</span>
  </span>
}

function App() {
  const [raw, setRaw] = useState('')
  const [data, setData] = useState({ ...empty })
  const [hasExtracted, setHasExtracted] = useState(false)
  const [message, setMessage] = useState('')
  const labelRef = useRef(null)
  const contentRef = useRef(null)
  const isBranch = data.entrega === 'Retiro en sucursal'
  const isHome = data.entrega === 'A domicilio'
  const receiptRequired = needsReceipt(data.totalVenta)
  const destination = isBranch ? data.sucursalDestino : isHome ? data.domicilio : ''
  const canPrint = hasExtracted && Boolean(data.entrega && destination.trim() && data.nombres.trim())
  const deliveryTitle = isBranch ? 'RETIRAR EN SUCURSAL STARKEN' : isHome ? 'ENTREGA A DOMICILIO' : 'ELIGE EL TIPO DE ENTREGA'
  useLayoutEffect(() => {
    const label = labelRef.current
    const content = contentRef.current
    if (!label || !content) return
    const fit = () => {
      const style = getComputedStyle(label)
      const available = label.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      content.style.transform = `scale(${Math.min(1, available / Math.max(content.offsetHeight, 1))})`
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
  }, [data, hasExtracted])

  function extract(text) {
    if (!text.trim()) return
    const result = parseRecipient(text)
    const next = { ...empty, ...result }
    if (result.entrega === 'Retiro en sucursal') {
      next.sucursalDestino = result.domicilio || ''
      next.domicilio = result.domicilio || ''
    }
    setData(next)
    setHasExtracted(true)
    setMessage(result.entrega
      ? `Detectamos ${result.entrega === 'A domicilio' ? 'entrega a domicilio' : 'retiro en sucursal'}. Revisa el destino y corrige lo que necesites.`
      : 'Elige domicilio o sucursal y completa los datos del envío.')
  }
  function change(event) {
    const { name, value } = event.target
    setData(previous => {
      const next = { ...previous, [name]: value }
      if (name === 'entrega' && value === 'Retiro en sucursal' && !next.sucursalDestino.trim()) next.sucursalDestino = previous.domicilio
      if (name === 'entrega' && value === 'A domicilio' && !next.domicilio.trim()) next.domicilio = previous.sucursalDestino
      return next
    })
  }
  return <>
    <main className={`app-shell ${canPrint ? '' : 'print-blocked'}`}>
      <div className={`workspace ${hasExtracted ? '' : 'paste-first'}`}>
        <div className="editor">
          <section className="panel">
            <div className="section-heading"><span className="step">1</span><h1 className="paste-title">Pega la información del pedido</h1></div>
            <p className="description">Después podrás definir el destino y afinar todos los detalles.</p>
            <label htmlFor="source" className="sr-only">Información del pedido</label>
            <textarea id="source" className="source-input" value={raw} placeholder={'Pega aquí la información completa del pedido…\n\nNombre: María González\nDirección: sucursal Renca av. Arturo Prat'} onChange={e => setRaw(e.target.value)} onPaste={e => {
              e.preventDefault()
              const text = e.clipboardData.getData('text')
              setRaw(text)
              extract(text)
            }} />
            <div className="source-footer"><p>Al pegar un nuevo pedido se reemplazan los datos anteriores.</p><button className="button secondary" disabled={!raw.trim()} onClick={() => extract(raw)}>{hasExtracted ? 'Extraer de nuevo' : 'Continuar'}</button></div>
            <button className="button secondary manual-button" onClick={() => {
              setRaw('')
              setData({ ...empty })
              setHasExtracted(true)
              setMessage('Etiqueta manual: selecciona el destino y escribe directamente sobre la etiqueta.')
            }}>Crear etiqueta manual</button>
            <p role="status" className="status">{message}</p>
          </section>
          {hasExtracted && <section className="panel">
            <fieldset className="delivery-choice">
              <legend>¿Dónde se entrega?</legend>
              <div className="delivery-options">
                {[['A domicilio', 'A domicilio', 'Calle, número y departamento o casa'], ['Retiro en sucursal', 'A sucursal Starken', 'Referencia de la sucursal de destino']].map(([value, title, help]) => <label className={`delivery-option ${data.entrega === value ? 'selected' : ''}`} key={value}>
                  <input type="radio" name="entrega" value={value} checked={data.entrega === value} onChange={change} />
                  <span><strong>{title}</strong><small>{help}</small></span>
                </label>)}
              </div>
            </fieldset>
            {!data.entrega && <p className="status">No pudimos determinar el tipo de entrega. Selecciona una opción.</p>}
            <label className="sale-total-control">
              <span>Total de la venta (no se imprime)</span>
              <input name="totalVenta" inputMode="numeric" value={data.totalVenta} onChange={change} placeholder="Ej. 55000" aria-describedby="receipt-help" />
            </label>
            <p className="status" id="receipt-help" role="status">{parsePesos(data.totalVenta) === null
              ? 'Ingresa o confirma el total para determinar si corresponde la marca.'
              : receiptRequired ? '◆ Adjuntar boleta o factura aparte. En la etiqueta solo aparecerá el símbolo.' : 'No corresponde marca: el total no supera $50.000.'}</p>
          </section>}
        </div>
        {hasExtracted && <aside className="preview-column">
          <div className="preview-heading"><h2>Edita tu etiqueta</h2><span>10 × 15 cm</span></div>
          <p className="label-edit-help">Haz clic sobre cualquier dato para escribir o corregirlo.</p>
          <article ref={labelRef} className="shipping-label" aria-label="Vista previa de la etiqueta de 10 por 15 centímetros">
            <div ref={contentRef} className="label-content">
              <div className="label-header"><span>DESPACHO STARKEN</span>{receiptRequired && <span className="receipt-marker" aria-label="Documento aparte">◆</span>}<strong><LabelField name="preventa" value={data.preventa} placeholder="Número de despacho" onChange={change} /></strong></div>
              <div className={`delivery-banner ${isBranch ? 'branch-banner' : ''}`}>{deliveryTitle}</div>
              <div className="recipient">
                <span className="label-caption">DESTINATARIO</span>
                <h3><LabelField name="nombres" value={data.nombres} placeholder="Nombre del destinatario" onChange={change} /></h3>
                <div className={!data.rut ? 'empty-label-field' : ''}><span className="label-caption">RUT</span><LabelField name="rut" value={data.rut} placeholder="RUT (opcional)" onChange={change} /></div>
              </div>
              <div className="destination">
                <span className="label-caption">COMUNA / CIUDAD</span>
                <p className="destination-commune font-bold"><LabelField name="comuna" value={data.comuna} placeholder="Comuna / ciudad" onChange={change} /></p>
                <span className="label-caption">{isBranch ? 'SUCURSAL DE DESTINO' : 'DIRECCIÓN DE ENTREGA'}</span>
                <p className="destination-address font-bold text-2xl"><LabelField name={isBranch ? 'sucursalDestino' : 'domicilio'} value={isBranch ? data.sucursalDestino : data.domicilio} placeholder={isBranch ? 'Dirección o referencia de la sucursal' : 'Calle y número'} onChange={change} /></p>
                {isHome && <div className={!data.unidad ? 'empty-label-field' : ''}><span className="label-caption">DEPTO. / OF. / CASA</span><strong><LabelField name="unidad" value={data.unidad} placeholder="Departamento / oficina / casa" onChange={change} /></strong></div>}
              </div>
              <div className="contact">
                <div className={`phone-number ${data.telefono ? '' : 'empty-label-field'}`}><span className="label-caption">TELÉFONO</span><LabelField name="telefono" value={data.telefono} placeholder="Teléfono" onChange={change} /></div>
                <div className={data.correo ? '' : 'empty-label-field'}><span className="label-caption">CORREO</span><LabelField name="correo" value={data.correo} placeholder="Correo (opcional)" onChange={change} /></div>
              </div>
              <div className={`notes ${data.indicaciones ? '' : 'empty-label-field'}`}><span className="label-caption">INDICACIONES</span><LabelField name="indicaciones" value={data.indicaciones} placeholder="Indicaciones adicionales (opcional)" onChange={change} /></div>
            </div>
          </article>
          <button className="button primary" disabled={!canPrint} onClick={() => { if (canPrint) window.print() }}>Imprimir etiqueta</button>
          {!canPrint && <p className="print-help" role="status">Para imprimir, selecciona el tipo de entrega y completa el destinatario y el destino.</p>}
          <p className="print-help">Papel de 100 × 150 mm y escala 100 %. Si tu navegador agrega título o numeración, desactiva «Encabezados y pies de página» al imprimir.</p>
        </aside>}
      </div>
    </main>
    {!canPrint && <p className="print-incomplete">Etiqueta pendiente: pega un pedido o crea una etiqueta manual, selecciona domicilio o sucursal y completa el destinatario y el destino antes de imprimir.</p>}
  </>
}
export default App
