import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractSaleTotal, needsReceipt, parsePesos } from './saleTotal.js'

test('strictly greater than 50,000 pesos', () => {
 for (const value of ['49999', '50.000', '$50.000,00', '0']) assert.equal(needsReceipt(value), false)
 for (const value of ['50001', '$ 55.000', '150000']) assert.equal(needsReceipt(value), true)
 for (const value of ['', 'abc', '-50000', '50,000', '5.00']) assert.equal(parsePesos(value), null)
})
test('uses the order total, never the highest product value or subtotal', () => {
 const source = '| Producto | Total |\n| Producto caro | $ 90.000 |\nSubtotal: $ 90.000\nDescuento: $ 50.000\n**$ 40.000**\nperson**Datos del cliente**\n**Nombre**Ana'
 assert.equal(extractSaleTotal(source), 40000)
 assert.equal(extractSaleTotal('**Total de la venta**\n**$ 55.000**\nNombre: Ana'), 55000)
 assert.equal(extractSaleTotal('Total: $ 50.001\nNombre: Ana'), 50001)
})
test('missing or ambiguous totals require manual entry', () => {
 assert.equal(extractSaleTotal('| Producto | $ 90.000 |\nNombre: Ana'), null)
 assert.equal(extractSaleTotal('$ 40.000\n$ 60.000\nNombre: Ana'), null)
 assert.equal(extractSaleTotal('Total: $ 40.000\nTotal: $ 60.000'), null)
 assert.equal(extractSaleTotal('Nombre: Ana\nNotas: entregar $ 60.000'), null)
})
