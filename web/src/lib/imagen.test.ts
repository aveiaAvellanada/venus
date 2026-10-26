import { desplazar, medidaReducida, recorteCuadrado } from './imagen'

describe('recorte cuadrado de la foto del zapato', () => {
  it('centrado y sin zoom: el cuadrado más grande que cabe', () => {
    expect(recorteCuadrado(4000, 3000, { zoom: 1, x: 0, y: 0 })).toEqual({ x: 500, y: 0, lado: 3000 })
    expect(recorteCuadrado(3000, 4000, { zoom: 1, x: 0, y: 0 })).toEqual({ x: 0, y: 500, lado: 3000 })
  })

  it('el desplazamiento llega hasta el borde y no se sale', () => {
    expect(recorteCuadrado(4000, 3000, { zoom: 1, x: 1, y: 0 })).toEqual({ x: 1000, y: 0, lado: 3000 })
    expect(recorteCuadrado(4000, 3000, { zoom: 1, x: -5, y: 0 })).toEqual({ x: 0, y: 0, lado: 3000 })
  })

  it('el zoom achica el cuadrado alrededor del centro elegido', () => {
    expect(recorteCuadrado(4000, 3000, { zoom: 2, x: 0, y: 0 })).toEqual({ x: 1250, y: 750, lado: 1500 })
    expect(recorteCuadrado(4000, 3000, { zoom: 2, x: 0, y: -1 })).toEqual({ x: 1250, y: 0, lado: 1500 })
    // El zoom no baja de 1 ni pasa del máximo.
    expect(recorteCuadrado(1000, 1000, { zoom: 0.2, x: 0, y: 0 }).lado).toBe(1000)
    expect(recorteCuadrado(1000, 1000, { zoom: 99, x: 0, y: 0 }).lado).toBe(250)
  })

  it('arrastrar a la derecha mueve el recorte a la izquierda, sin salirse', () => {
    // 1 px de pantalla = 0,1 px de foto; hay 1000 px libres (500 a cada lado).
    expect(desplazar(0, 25, 0.1, 1000)).toBeCloseTo(-0.5)
    expect(desplazar(0, -500, 0.1, 1000)).toBe(1)
    expect(desplazar(0.3, 10, 0.1, 0)).toBe(0)
  })

  it('reduce sin agrandar', () => {
    expect(medidaReducida(4000, 3000, 1000)).toEqual({ ancho: 1000, alto: 750 })
    expect(medidaReducida(500, 400, 1000)).toEqual({ ancho: 500, alto: 400 })
  })
})
