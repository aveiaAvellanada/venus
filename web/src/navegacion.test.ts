import { NAVEGACION, SECCIONES, plano, seccionesQueCoinciden } from './navegacion'

describe('navegación del panel', () => {
  it('ids y rutas únicos', () => {
    expect(new Set(SECCIONES.map((s) => s.id)).size).toBe(SECCIONES.length)
    expect(new Set(SECCIONES.map((s) => s.ruta)).size).toBe(SECCIONES.length)
  })

  it('Inicio está lista en la fase 0 y va primero', () => {
    expect(NAVEGACION[0].secciones[0]).toMatchObject({ id: 'inicio', ruta: '/', lista: true, fase: 0 })
  })

  it('toda sección dice qué hace', () => {
    for (const s of SECCIONES) expect(s.descripcion.length).toBeGreaterThan(20)
  })

  it('busca sin tildes y por palabras alternativas', () => {
    expect(plano('Clásico')).toBe('clasico')
    expect(seccionesQueCoinciden('auditoria').map((s) => s.id)).toEqual(['historial'])
    expect(seccionesQueCoinciden('factura').map((s) => s.id)).toContain('compras')
    expect(seccionesQueCoinciden('   ')).toEqual([])
  })
})
