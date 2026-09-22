import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRecipient } from './recipient.js'

const sample = String.raw`# PREVENTA #35214
## Cliente: Andreas Fingerhuth
**Detalle**
**Despacho**
**Pago**
**Notificaciones**
**Historial**
| **Producto** | **Cantidad** | **Descuento** | **Total** |
| LENTES POLARIZADOS RAPALA URBAN VISIONGEAR 282A | 45RAUVG282A | 1 | -$ 4.400 | $ 39.590 |
**$ 44.480**
person**Datos del cliente**
**Nombre**Andreas Fingerhuth
**Documento de Identidad**13883319-4
**Giro**Sin Giro
**Número**+56971095824
local\_shipping**Envío**
**Correo**afingerhuth\@gmail.com
**Teléfono**+56971095824
**Tipo de pedido**Despacho a domicilio. DESPACHO 24HRS HABILES. ENTREGAS:18 A 22HRS
**Sucursal**Casa Matriz
**Región**Región Metropolitana
**Comuna**Providencia
**Dirección**Las Dalias 2821
**Dep.Ofi.Casa**403
**Rango de despacho**-
**Quién recibe**-
**Número**-
note\_add**Información adicional**
**Archivo adjunto**-`

test('extracts the supplied Markdown order and prefers the street over the branch', () => {
 const data = parseRecipient(sample)
 assert.equal(data.preventa, '35214')
 assert.equal(data.nombres, 'Andreas Fingerhuth')
 assert.equal(data.rut, '13.883.319-4')
 assert.equal(data.telefono, '+56971095824')
 assert.equal(data.correo, 'afingerhuth@gmail.com')
 assert.equal(data.domicilio, 'Las Dalias 2821')
 assert.equal(data.unidad, '403')
 assert.equal(data.comuna, 'Providencia')
 assert.equal(data.entrega, 'A domicilio')
 assert.equal(data.indicaciones, '')
})
test('uses the receiver identity and following phone, without purchaser RUT', () => {
 const data = parseRecipient(sample.replace('**Quién recibe**-\n**Número**-', '**Quién recibe**Ana Pérez\n**Número**+56912345678'))
 assert.equal(data.nombres, 'Ana Pérez'); assert.equal(data.rut, ''); assert.equal(data.telefono, '+56912345678')
})
test('reads receiver RUT and multi-line notes without attachments', () => {
 const data = parseRecipient(sample.replace('**Quién recibe**-\n**Número**-', '**Quién recibe**Ana Pérez\n**RUT**11222333-4\n**Número**+56912345678').replace('**Información adicional**', '**Información adicional**Entregar en conserjería.\nLlamar antes de llegar.'))
 assert.equal(data.rut, '11.222.333-4')
 assert.equal(data.indicaciones, 'Entregar en conserjería.\nLlamar antes de llegar.')
})
test('reads receiver identity on a single line', () => {
 const data = parseRecipient('Quién recibe: Ana Pérez, RUT: 11.222.333-4, Teléfono: +56912345678')
 assert.equal(data.nombres,'Ana Pérez'); assert.equal(data.rut,'11.222.333-4'); assert.equal(data.telefono,'+56912345678')
})
test('supports plain text and does not consume the next label as a value', () => {
 const data = parseRecipient('Nombre\nTeléfono\n+56912345678\nDirección: Calle 123\nDep.Ofi.Casa: 4\nNotas adicionales:\nPortón azul\nSegundo piso\nArchivo adjunto: -')
 assert.equal(data.nombres,undefined); assert.equal(data.domicilio,'Calle 123'); assert.equal(data.unidad,'4'); assert.equal(data.indicaciones,'Portón azul\nSegundo piso')
 assert.deepEqual(parseRecipient('Texto sin etiquetas'), {})
})
