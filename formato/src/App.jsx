import {useState, useCallback} from 'react'
import './App.css'

function App() {
    const [rawPaste, setRawPaste] = useState('')
    const [flags, setFlags] = useState({
        porPagar: false,
        pagado: false,
        agencia: false,
        domicilio: false,
        cuentaCorriente: false,
    })

    const [formData, setFormData] = useState({
        rut: '',
        nombres: '',
        domicilio: '',
        comuna: '',
        telefono: '',
        correo: '',
        indicaciones: '',
        preventa: ''
    })

    const normalize = (s = '') =>
        s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
    const clean = (s = '') => (s || '').trim()

    // Da formato XX.XXX.XXX-Y si ya trae DV
    const formatRut = (rut) => {
        const raw = (rut || '').replace(/[^0-9kK]/g, '').toUpperCase()
        if (raw.length < 2) return clean(rut)
        const cuerpo = raw.slice(0, -1)
        const dv = raw.slice(-1)
        const withDots = cuerpo
            .split('').reverse().join('')
            .match(/.{1,3}/g).join('.')
            .split('').reverse().join('')
        return `${withDots}-${dv}`
    }

    // Palabras/etiquetas que vienen en tu bloque
    const LABELS = {
        nombres: ['nombre', 'nombres', 'cliente'],
        rut: ['documento de identidad', 'rut', 'r.u.t'],
        telefono: ['telefono', 'teléfono', 'numero', 'número'],
        correo: ['correo', 'email', 'e-mail'],
        comuna: ['comuna', 'ciudad'],
        domicilio: ['direccion', 'dirección'],
        indicaciones: ['indicaciones', 'observaciones'],
        region: ['region', 'región'], // por si luego quieres usarla
        tipoPedido: ['tipo de pedido'],
        sucursal: ['sucursal'],
        preventa: ['preventa'],
    }

    const SKIP_LINES = new Set([
        'person',
        'local_shipping',
        'envio',
        'envío',
        'datos del cliente',
        'rango de despacho',
        'quien recibe',
        'quién recibe',
        '-', // valores vacíos
    ])

    const isKnownLabel = (line) => {
        const n = normalize(line)
        for (const list of Object.values(LABELS)) {
            if (list.some(l => n === l)) return true
        }
        return false
    }

    const mapLabelToField = (line) => {
        const n = normalize(line)
        for (const [field, list] of Object.entries(LABELS)) {
            if (list.some(l => n === l)) return field
        }
        return null
    }

    // Parser específico para tu formato: "Etiqueta" en una línea, "Valor" en la siguiente
    const parseStackedPairs = (text) => {
        const lines = text
            .split(/\r?\n/)
            .map(l => clean(l))
            .filter(l => l !== '')

        const result = {...formData}
        const used = new Set()

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const nline = normalize(line)

            if (SKIP_LINES.has(nline)) continue
            if (!isKnownLabel(line)) continue

            // busca el siguiente valor no vacío ni etiqueta ni palabra a saltar
            let j = i + 1
            while (j < lines.length) {
                const candidate = lines[j]
                const nc = normalize(candidate)
                if (candidate === '' || SKIP_LINES.has(nc) || isKnownLabel(candidate)) {
                    j++
                    continue
                }
                const field = mapLabelToField(line)
                if (field) {
                    let value = candidate
                    if (field === 'rut') value = formatRut(candidate)
                    if (field === 'telefono') {
                        // normaliza teléfono chileno si viene duplicado con +56
                        const t = candidate.replace(/[^\d+]/g, '')
                        value = t
                    }
                    if (!used.has(field)) {
                        result[field] = value
                        used.add(field)
                    } else {
                        // si "Número" aparece de nuevo, sólo llena si teléfono está vacío
                        if (field === 'telefono' && !result.telefono) {
                            result.telefono = candidate.replace(/[^\d+]/g, '')
                        }
                    }
                }
                break
            }
            i = Math.max(i, j - 1)
        }

        // Rescata banderas/courier desde el texto completo
        const n = normalize(text)
        const newFlags = {
            porPagar: /\bpor\s*pagar\b/.test(n),
            pagado: /\bpagado\b/.test(n) && !/\bpor\s*pagar\b/.test(n),
            domicilio: /\bdespacho\s*a\s*domicilio\b/.test(n) || /\bdomicilio\b/.test(n),
            agencia: /\bsucursal\b/.test(n) || /\bstarken\b/.test(n) || /\bchilexpress\b/.test(n) || /\bcorreos\b/.test(n),
            cuentaCorriente: false,
        }

        // --- PREVENTA ---
        // Soporta: "PREVENTA #27967", "Pre-venta N° 27967", "Preventa: 27967", etc.
        // Probamos sobre el texto original para no perder símbolos como # o °.
        const preventaRegex = /\bpre\s*[-\s]*venta\b.*?(?:n[°ºo]?\.?|num(?:ero)?\.?|#|:)?\s*(\d{3,})/i
        const mPre = text.match(preventaRegex)
        if (mPre && !result.preventa) {
            result.preventa = mPre[1]
        }

        // Extrae email y RUT/telefono por si faltaron
        if (!result.correo) {
            const mail = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
            if (mail) result.correo = mail[0]
        }
        if (!result.rut) {
            const rutMatch = text.match(/\b(\d{1,3}(?:[.\s]?\d{3}){1,2}-[0-9kK])\b/)
            if (rutMatch) result.rut = formatRut(rutMatch[1])
        }
        if (!result.telefono) {
            const tel = text.replace(/[\s()-]/g, '').match(/(?:\+?56)?\d{9,11}\b/)
            if (tel) result.telefono = tel[0]
        }

        return {result, newFlags}
    }

    const handlePaste = useCallback((e) => {
        e.preventDefault()
        const pasted = (e.clipboardData || window.clipboardData).getData('text')
        setRawPaste(pasted)

        const {result, newFlags} = parseStackedPairs(pasted)
        setFormData(prev => ({...prev, ...result}))
        setFlags(prev => ({...prev, ...newFlags}))
    }, [])

    const handleChange = (e) => {
        const {name, value} = e.target
        setFormData(prev => ({...prev, [name]: value}))
    }
    const handleFlagChange = (e) => {
        const {name, checked} = e.target
        setFlags(prev => ({...prev, [name]: checked}))
    }

    const handlePrint = ()=>{
        window.print()
    }

    return (
        <>
            <section className={'grid grid-cols-5 m-auto gap-y-4 gap-4'}>

                <div className={'text-start px-2 grid grid-cols-1 gap-4'}>


                    {/* PASTE AREA */}
                    <form className={'border-2 rounded-sm px-2 my-2'}>
                        <label htmlFor="pegarAqui" className="block text-sm font-medium my-2">Pega aquí el
                            texto</label>
                        <textarea
                            id="pegarAqui"
                            name="pegarAqui"
                            className="w-full border p-2 rounded min-h-[220px]"
                            placeholder="Pega el bloque con 'Nombre' en una línea y el valor en la siguiente…"
                            onPaste={handlePaste}
                            value={rawPaste}
                            onChange={(e) => setRawPaste(e.target.value)}
                        />

                    </form>
                </div>

                {/* EDITABLE */}
                <div className={'pdfPrint col-span-3 border-2 rounded-sm text-left p-6 aspect-3/2'}>
                    <ul className={'p-2 text-4xl text-left'}>

                        <li className={''}>
                            <label className="">
                                <span className=" ">DESPACHO #</span>
                                <input className=" rounded font-semibold"
                                       name="nombres" value={formData.preventa} onChange={handleChange}
                                       placeholder="Numero Preventa"/>
                            </label>
                        </li>

                        <li>

                            <label className="">
                                <span className=" text-xl">NOMBRES:</span>
                                <input className="col-span-4 rounded p-2 font-semibold"
                                       name="nombres" value={formData.nombres} onChange={handleChange}
                                       placeholder="Nombre Apellido"/>
                            </label>
                        </li>

                        <li>

                            <label className="">
                                <span className="text-xl ">RUT:</span>
                                <input className="col-span-4 rounded p-2 font-semibold"
                                       name="rut" value={formData.rut} onChange={handleChange}
                                       placeholder="12.345.678-9"/>
                            </label>
                        </li>

                        <li>
                            <label className="">
                                <span className="text-xl ">TELÉFONO:</span>
                                <input className="col-span-4 rounded p-2 font-semibold"
                                       name="telefono" value={formData.telefono} onChange={handleChange}
                                       placeholder="+56 9 12345678"/>
                            </label>
                        </li>

                        <li>
                            <label className="">
                                <span className="text-xl ">CORREO:</span><br/>
                                <input className="w-full font-semibold"
                                       name="correo" type="email" value={formData.correo} onChange={handleChange}
                                       placeholder="correo@dominio.com"/>
                            </label>
                        </li>

                        <li>

                            <label className="">
                                <span className="text-xl ">COMUNA:</span>
                                <input className="col-span-4 rounded p-2 font-semibold"
                                       name="comuna" value={formData.comuna} onChange={handleChange}
                                       placeholder="Comuna"/>
                            </label>
                        </li>

                        <li>

                            <label className="">
                                <span className="text-xl ">DOMICILIO:</span>
                                <input className="col-span-4 rounded p-2 font-semibold"
                                       name="domicilio" value={formData.domicilio} onChange={handleChange}
                                       placeholder="Calle 123, Depto"/>
                            </label>
                        </li>
                    </ul>



                </div>
                <div>
                    <button onClick={handlePrint} type={'button'} className={'p-4 border-2 bg-amber-400 hover:bg-blue-500 rounded-lg px-2 py-1'}>
                        IMPRIMIR
                    </button>
                </div>
            </section>
        </>
    )
}

export default App
