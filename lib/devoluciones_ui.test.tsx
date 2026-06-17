import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Mock Supabase (both relative and absolute paths used by different imports)
jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: { devolucion_id: 'dev-1' }, error: null }),
  },
}))
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: { devolucion_id: 'dev-1' }, error: null }),
  },
}))

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    Ionicons: (props: { name?: string; [key: string]: unknown }) =>
      React.createElement(Text, props, props.name),
  }
})

// Mock expo-router
const mockUseLocalSearchParams = jest.fn(() => ({ venta: 'venta-uuid-1', numero: '42' }))
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
}

jest.mock('expo-router', () => {
  const React = require('react')
  const StackScreen = (props: { name?: string; options?: unknown }) =>
    React.createElement('View', { testID: `stack-screen-${props.name}` })
  const Stack = (props: { children?: React.ReactNode; screenOptions?: unknown }) =>
    React.createElement('View', null, props.children)
  Stack.Screen = StackScreen
  return {
    useLocalSearchParams: () => mockUseLocalSearchParams(),
    useRouter: () => mockRouter,
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb()
      }, [cb])
    },
    Redirect: jest.fn(({ href }: { href: string }) => `Redirected to ${href}`),
    Stack,
  }
})

// Mock auth — useRequireModulo returns null (granted) by default
import { useRequireModulo } from '../lib/auth'
jest.mock('../lib/auth', () => ({
  useAuth: jest.fn(),
  useRequireModulo: jest.fn(() => null),
}))

// Mock devoluciones data functions
import * as apiDevoluciones from './devoluciones'
jest.mock('./devoluciones', () => {
  // Keep the pure logic functions, mock only the async data functions
  const real = jest.requireActual('./devoluciones')
  return {
    ...real,
    buscarVentaParaDevolucion: jest.fn(),
    registrarDevolucion: jest.fn(),
  }
})
jest.mock('../lib/devoluciones', () => {
  const real = jest.requireActual('../lib/devoluciones')
  return {
    ...real,
    buscarVentaParaDevolucion: jest.fn(),
    registrarDevolucion: jest.fn(),
  }
})

// Mock inventario
import * as apiInventario from './inventario'
jest.mock('./inventario', () => ({
  listarCalzado: jest.fn(() => Promise.resolve([])),
  guardarCalzado: jest.fn(),
}))
jest.mock('../lib/inventario', () => ({
  listarCalzado: jest.fn(() => Promise.resolve([])),
  guardarCalzado: jest.fn(),
}))

// Import screens AFTER all mocks
import DevolucionesLayout from '../app/(app)/devoluciones/_layout'
import DevolucionesIndex from '../app/(app)/devoluciones/index'
import NuevaDevolucionScreen from '../app/(app)/devoluciones/nueva'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VENTA_CON_CALZADO_Y_GRANJA = {
  venta_id: 'venta-uuid-1',
  numero: 42,
  fecha: '2026-06-15T10:00:00Z',
  cliente_nombre: 'Carlos Pérez',
  estado: 'completada',
  items: [
    {
      venta_item_id: 'item-calzado-1',
      tipo_producto: 'calzado' as const,
      descripcion: 'Tenis Nike Pro',
      talla: '40',
      color: 'Blanco',
      cantidad_vendida: 2,
      cantidad_ya_devuelta: 0,
      precio_unitario: 150000,
    },
    {
      venta_item_id: 'item-granja-1',
      tipo_producto: 'varios' as const,
      descripcion: 'Crema para cuero',
      talla: null,
      color: null,
      cantidad_vendida: 1,
      cantidad_ya_devuelta: 0,
      precio_unitario: 25000,
    },
  ],
}

const VENTA_SOLO_CALZADO = {
  venta_id: 'venta-uuid-2',
  numero: 43,
  fecha: '2026-06-15T11:00:00Z',
  cliente_nombre: null,
  estado: 'completada',
  items: [
    {
      venta_item_id: 'item-calzado-2',
      tipo_producto: 'calzado' as const,
      descripcion: 'Botas de caucho',
      talla: '42',
      color: 'Negro',
      cantidad_vendida: 1,
      cantidad_ya_devuelta: 0,
      precio_unitario: 80000,
    },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const matchText = (children: unknown, text: string): boolean => {
  if (typeof children === 'string') return children.trim() === text.trim()
  if (typeof children === 'number') return String(children) === text.trim()
  if (Array.isArray(children)) {
    if (children.every((c) => typeof c === 'string' || typeof c === 'number')) {
      return children.join('').trim() === text.trim()
    }
    return children.some((c) => matchText(c, text))
  }
  return false
}

const findAllByText = (root: renderer.ReactTestInstance, text: string) =>
  root.findAll((el: renderer.ReactTestInstance) => el.type === 'Text' && matchText(el.props.children, text))

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Devoluciones UI — tests de integración', () => {
  let tree: renderer.ReactTestRenderer | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    // Restore defaults after clearAllMocks resets all mock implementations
    ;(useRequireModulo as jest.Mock).mockReturnValue(null)
    mockUseLocalSearchParams.mockReturnValue({ venta: 'venta-uuid-1', numero: '42' })
    // Default: venta returns null (tests that need a venta set their own mock)
    ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(null)
    ;(apiDevoluciones.registrarDevolucion as jest.Mock).mockResolvedValue({
      devolucion_id: 'dev-default',
    })
  })

  afterEach(async () => {
    if (tree) {
      try {
        await act(async () => {
          tree!.unmount()
        })
      } catch {
        // Ignore unmount errors
      }
      tree = null
    }
  })

  // ── Test 1: Gating ────────────────────────────────────────────────────────

  describe('1. Gating de módulo', () => {
    test('DevolucionesLayout llama a useRequireModulo con "devoluciones"', async () => {
      const mockRequireModulo = useRequireModulo as jest.Mock

      await act(async () => {
        tree = renderer.create(<DevolucionesLayout />)
      })

      expect(mockRequireModulo).toHaveBeenCalledWith('devoluciones')
    })

    test('NuevaDevolucionScreen llama a useRequireModulo con "devoluciones"', async () => {
      const mockRequireModulo = useRequireModulo as jest.Mock
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_CON_CALZADO_Y_GRANJA
      )

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      expect(mockRequireModulo).toHaveBeenCalledWith('devoluciones')
    })

    test('DevolucionesIndex llama a useRequireModulo con "devoluciones"', async () => {
      const mockRequireModulo = useRequireModulo as jest.Mock

      await act(async () => {
        tree = renderer.create(<DevolucionesIndex />)
      })

      expect(mockRequireModulo).toHaveBeenCalledWith('devoluciones')
    })

    test('Cuando useRequireModulo retorna un elemento, la pantalla no renderiza el contenido', async () => {
      const mockRequireModulo = useRequireModulo as jest.Mock
      // Simula que el modulo no está autorizado → devuelve un elemento Redirect
      const redirectEl = React.createElement('Text', null, 'Sin acceso')
      mockRequireModulo.mockReturnValue(redirectEl)

      await act(async () => {
        tree = renderer.create(<DevolucionesIndex />)
      })

      // El input de búsqueda NO debe aparecer porque el guard cortó el render
      const root = tree!.root
      const inputs = root.findAll((el: renderer.ReactTestInstance) => el.props.testID === 'input-numero-venta')
      expect(inputs.length).toBe(0)
    })
  })

  // ── Test 2: Granja sin cambio ─────────────────────────────────────────────

  describe('2. Granja no admite cambio de producto', () => {
    test('En modo "cambio", un item de tipo Granja muestra aviso de bloqueo y NO el selector de reemplazo', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_CON_CALZADO_Y_GRANJA
      )

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Cambiar tipo a "cambio"
      const btnCambio = root.findByProps({ testID: 'btn-tipo-cambio' })
      await act(async () => {
        btnCambio.props.onPress()
      })

      // El item de Granja debe mostrar el aviso de bloqueo
      const granjaItemContainer = root.findByProps({ testID: 'item-devolucion-item-granja-1' })
      const warningTexts = granjaItemContainer.findAll(
        (el: renderer.ReactTestInstance) =>
          el.type === 'Text' &&
          matchText(
            el.props.children,
            'Los productos de Granja no aplican para cambio de producto.'
          )
      )
      expect(warningTexts.length).toBeGreaterThan(0)

      // No debe haber botón de buscar reemplazo para el item de Granja
      const buscarReemplazoGranja = root.findAll(
        (el: renderer.ReactTestInstance) =>
          el.props.testID === 'btn-buscar-reemplazo-item-granja-1'
      )
      expect(buscarReemplazoGranja.length).toBe(0)
    })

    test('En modo "cambio", el item de calzado SÍ muestra el selector de reemplazo', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_CON_CALZADO_Y_GRANJA
      )

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Cambiar tipo a "cambio"
      const btnCambio = root.findByProps({ testID: 'btn-tipo-cambio' })
      await act(async () => {
        btnCambio.props.onPress()
      })

      // El item de calzado SÍ debe mostrar el botón de buscar reemplazo
      const buscarReemplazoCalzado = root.findAll(
        (el: renderer.ReactTestInstance) =>
          el.props.testID === 'btn-buscar-reemplazo-item-calzado-1'
      )
      expect(buscarReemplazoCalzado.length).toBeGreaterThan(0)
    })

    test('En modos "total" y "parcial", los items de Granja no muestran el aviso de bloqueo', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_CON_CALZADO_Y_GRANJA
      )

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Modo "total" (por defecto): no debe haber aviso de bloqueo
      const warningTotal = root.findAll(
        (el: renderer.ReactTestInstance) =>
          el.type === 'Text' &&
          matchText(
            el.props.children,
            'Los productos de Granja no aplican para cambio de producto.'
          )
      )
      expect(warningTotal.length).toBe(0)

      // Cambiar a "parcial" — tampoco debe aparecer aviso de bloqueo
      const btnParcial = root.findByProps({ testID: 'btn-tipo-parcial' })
      await act(async () => {
        btnParcial.props.onPress()
      })

      const warningParcial = root.findAll(
        (el: renderer.ReactTestInstance) =>
          el.type === 'Text' &&
          matchText(
            el.props.children,
            'Los productos de Granja no aplican para cambio de producto.'
          )
      )
      expect(warningParcial.length).toBe(0)
    })
  })

  // ── Test 3: Cambio más caro pide cobro ────────────────────────────────────

  describe('3. Cambio más caro muestra método de cobro (no de reembolso)', () => {
    test('Con reemplazo más caro, aparece "Método de cobro adicional *" y NO "Método de reembolso *"', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_SOLO_CALZADO
      )

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Seleccionar tipo "cambio"
      const btnCambio = root.findByProps({ testID: 'btn-tipo-cambio' })
      await act(async () => {
        btnCambio.props.onPress()
      })

      // Abrir el modal de búsqueda de reemplazo
      const buscarBtn = root.findByProps({ testID: 'btn-buscar-reemplazo-item-calzado-2' })
      await act(async () => {
        buscarBtn.props.onPress()
      })

      // Simular búsqueda con resultados
      const productoReemplazo = {
        id: 'pc-reemplazo-1',
        descripcion: 'Botas premium',
        talla: '42',
        color: 'Café',
        referencia: 'BPR-42',
        stock_actual: 5,
        precio_minimo: 90000,
        precio_maximo: 130000,
        categoria: 'Botas caucho',
        stock_minimo: 2,
        created_at: '2026-06-01T00:00:00Z',
      }
      ;(apiInventario.listarCalzado as jest.Mock).mockResolvedValue([productoReemplazo])

      const inputBuscar = root.findByProps({ testID: 'input-buscar-reemplazo' })
      await act(async () => {
        inputBuscar.props.onChangeText('Botas')
      })

      // Seleccionar el producto de reemplazo
      const resultadoBtn = root.findByProps({ testID: 'resultado-reemplazo-pc-reemplazo-1' })
      await act(async () => {
        resultadoBtn.props.onPress()
      })

      // Ingresar precio de reemplazo mayor al original (80000 → 120000)
      const precioInput = root.findByProps({ testID: 'input-precio-reemplazo-item-calzado-2' })
      await act(async () => {
        precioInput.props.onChangeText('120000')
      })

      // Verificar que aparece "Método de cobro adicional *"
      const cobroLabel = findAllByText(root, 'Método de cobro adicional *')
      expect(cobroLabel.length).toBeGreaterThan(0)

      // Verificar que NO aparece "Método de reembolso *"
      const reembolsoLabel = findAllByText(root, 'Método de reembolso *')
      expect(reembolsoLabel.length).toBe(0)
    })

    test('Con reemplazo más barato, aparece "Método de reembolso *" y NO "Método de cobro adicional *"', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_SOLO_CALZADO
      )

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Seleccionar tipo "cambio"
      const btnCambio = root.findByProps({ testID: 'btn-tipo-cambio' })
      await act(async () => {
        btnCambio.props.onPress()
      })

      // Abrir el modal de búsqueda
      const buscarBtn = root.findByProps({ testID: 'btn-buscar-reemplazo-item-calzado-2' })
      await act(async () => {
        buscarBtn.props.onPress()
      })

      const productoReemplazo = {
        id: 'pc-reemplazo-2',
        descripcion: 'Chanclas básicas',
        talla: '42',
        color: 'Azul',
        referencia: null,
        stock_actual: 10,
        precio_minimo: 30000,
        precio_maximo: 50000,
        categoria: 'Chanclas',
        stock_minimo: 1,
        created_at: '2026-06-01T00:00:00Z',
      }
      ;(apiInventario.listarCalzado as jest.Mock).mockResolvedValue([productoReemplazo])

      const inputBuscar = root.findByProps({ testID: 'input-buscar-reemplazo' })
      await act(async () => {
        inputBuscar.props.onChangeText('Chanclas')
      })

      const resultadoBtn = root.findByProps({ testID: 'resultado-reemplazo-pc-reemplazo-2' })
      await act(async () => {
        resultadoBtn.props.onPress()
      })

      // Precio de reemplazo menor al original (80000 → 50000)
      const precioInput = root.findByProps({ testID: 'input-precio-reemplazo-item-calzado-2' })
      await act(async () => {
        precioInput.props.onChangeText('50000')
      })

      // Verificar que aparece "Método de reembolso *"
      const reembolsoLabel = findAllByText(root, 'Método de reembolso *')
      expect(reembolsoLabel.length).toBeGreaterThan(0)

      // Verificar que NO aparece "Método de cobro adicional *"
      const cobroLabel = findAllByText(root, 'Método de cobro adicional *')
      expect(cobroLabel.length).toBe(0)
    })
  })

  // ── Test 4: Payload correcto en registrarDevolucion ───────────────────────

  describe('4. Payload correcto al confirmar devolución', () => {
    test('Devolución total: registrarDevolucion recibe tipo_devolucion, monto_devuelto y items correctos', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_SOLO_CALZADO
      )
      ;(apiDevoluciones.registrarDevolucion as jest.Mock).mockResolvedValue({
        devolucion_id: 'dev-new-1',
      })

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Tipo "total" ya está seleccionado por defecto.
      // Ingresar motivo
      const motivoInput = root.findByProps({ testID: 'input-motivo' })
      await act(async () => {
        motivoInput.props.onChangeText('Producto defectuoso')
      })

      // Seleccionar método de reembolso (monto_devuelto = 80000 > 0 para total)
      const btnEfectivo = root.findByProps({ testID: 'btn-metodo-reembolso-efectivo' })
      await act(async () => {
        btnEfectivo.props.onPress()
      })

      // Confirmar
      const btnConfirmar = root.findByProps({ testID: 'btn-confirmar-devolucion' })
      await act(async () => {
        btnConfirmar.props.onPress()
      })

      expect(apiDevoluciones.registrarDevolucion).toHaveBeenCalledWith(
        expect.objectContaining({
          venta_id: 'venta-uuid-2',
          tipo_devolucion: 'total',
          monto_devuelto: 80000,
          monto_cobrado: 0,
          items: expect.arrayContaining([
            expect.objectContaining({
              venta_item_id: 'item-calzado-2',
              cantidad: 1,
            }),
          ]),
        })
      )
    })

    test('Devolución parcial: registrarDevolucion recibe cantidad ajustada por el usuario', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_CON_CALZADO_Y_GRANJA
      )
      ;(apiDevoluciones.registrarDevolucion as jest.Mock).mockResolvedValue({
        devolucion_id: 'dev-new-2',
      })

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Seleccionar tipo "parcial"
      const btnParcial = root.findByProps({ testID: 'btn-tipo-parcial' })
      await act(async () => {
        btnParcial.props.onPress()
      })

      // Cambiar cantidad del calzado a 1 (de 2 disponibles)
      const cantidadInput = root.findByProps({ testID: 'input-cantidad-item-calzado-1' })
      await act(async () => {
        cantidadInput.props.onChangeText('1')
      })

      // Poner cantidad 0 en el item de Granja para no incluirlo
      const cantidadGranjaInput = root.findByProps({ testID: 'input-cantidad-item-granja-1' })
      await act(async () => {
        cantidadGranjaInput.props.onChangeText('0')
      })

      // Motivo
      const motivoInput = root.findByProps({ testID: 'input-motivo' })
      await act(async () => {
        motivoInput.props.onChangeText('Solo devuelvo uno')
      })

      // Método de reembolso (calzado 1 unidad = 150000)
      const btnEfectivo = root.findByProps({ testID: 'btn-metodo-reembolso-efectivo' })
      await act(async () => {
        btnEfectivo.props.onPress()
      })

      // Confirmar
      const btnConfirmar = root.findByProps({ testID: 'btn-confirmar-devolucion' })
      await act(async () => {
        btnConfirmar.props.onPress()
      })

      expect(apiDevoluciones.registrarDevolucion).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_devolucion: 'parcial',
          monto_devuelto: 150000,
          monto_cobrado: 0,
          items: expect.arrayContaining([
            expect.objectContaining({
              venta_item_id: 'item-calzado-1',
              cantidad: 1,
            }),
          ]),
        })
      )
    })

    test('Cambio más caro: registrarDevolucion recibe cambio_talla_color_id, precio_reemplazo y monto_cobrado', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_SOLO_CALZADO
      )
      ;(apiDevoluciones.registrarDevolucion as jest.Mock).mockResolvedValue({
        devolucion_id: 'dev-new-3',
      })

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Seleccionar tipo "cambio"
      const btnCambio = root.findByProps({ testID: 'btn-tipo-cambio' })
      await act(async () => {
        btnCambio.props.onPress()
      })

      // Abrir modal de búsqueda de reemplazo
      const buscarBtn = root.findByProps({ testID: 'btn-buscar-reemplazo-item-calzado-2' })
      await act(async () => {
        buscarBtn.props.onPress()
      })

      // Simular resultados de búsqueda
      const productoReemplazo = {
        id: 'pc-reemplazo-3',
        descripcion: 'Botas premium deluxe',
        talla: '42',
        color: 'Marrón',
        referencia: 'BPD-42',
        stock_actual: 3,
        precio_minimo: 100000,
        precio_maximo: 150000,
        categoria: 'Botas caucho',
        stock_minimo: 1,
        created_at: '2026-06-01T00:00:00Z',
      }
      ;(apiInventario.listarCalzado as jest.Mock).mockResolvedValue([productoReemplazo])

      const inputBuscar = root.findByProps({ testID: 'input-buscar-reemplazo' })
      await act(async () => {
        inputBuscar.props.onChangeText('Botas premium')
      })

      // Seleccionar producto de reemplazo
      const resultadoBtn = root.findByProps({ testID: 'resultado-reemplazo-pc-reemplazo-3' })
      await act(async () => {
        resultadoBtn.props.onPress()
      })

      // Precio de reemplazo: 120000 (original 80000 → diferencia = +40000)
      const precioInput = root.findByProps({ testID: 'input-precio-reemplazo-item-calzado-2' })
      await act(async () => {
        precioInput.props.onChangeText('120000')
      })

      // Motivo
      const motivoInput = root.findByProps({ testID: 'input-motivo' })
      await act(async () => {
        motivoInput.props.onChangeText('Cambio por talla')
      })

      // Seleccionar método de cobro (cliente paga diferencia)
      const btnCobro = root.findByProps({ testID: 'btn-metodo-cobro-nequi' })
      await act(async () => {
        btnCobro.props.onPress()
      })

      // Confirmar
      const btnConfirmar = root.findByProps({ testID: 'btn-confirmar-devolucion' })
      await act(async () => {
        btnConfirmar.props.onPress()
      })

      // monto_cobrado = (120000 - 80000) * 1 = 40000
      expect(apiDevoluciones.registrarDevolucion).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_devolucion: 'cambio',
          monto_devuelto: 0,
          monto_cobrado: 40000,
          items: expect.arrayContaining([
            expect.objectContaining({
              venta_item_id: 'item-calzado-2',
              cantidad: 1,
              cambio_talla_color_id: 'pc-reemplazo-3',
              precio_reemplazo: 120000,
            }),
          ]),
        })
      )
    })

    test('Sin motivo, la confirmación no llama a registrarDevolucion', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_SOLO_CALZADO
      )

      await act(async () => {
        tree = renderer.create(<NuevaDevolucionScreen />)
      })

      const root = tree!.root

      // Intentar confirmar sin motivo
      const btnConfirmar = root.findByProps({ testID: 'btn-confirmar-devolucion' })
      await act(async () => {
        btnConfirmar.props.onPress()
      })

      expect(apiDevoluciones.registrarDevolucion).not.toHaveBeenCalled()
    })
  })

  // ── Test 5: Pantalla index — búsqueda y navegación ────────────────────────

  describe('5. Index — buscar venta', () => {
    test('Muestra "Buscar venta" y el input de número de venta', async () => {
      await act(async () => {
        tree = renderer.create(<DevolucionesIndex />)
      })

      const root = tree!.root
      const titulo = findAllByText(root, 'Buscar venta')
      expect(titulo.length).toBeGreaterThan(0)

      const input = root.findByProps({ testID: 'input-numero-venta' })
      expect(input).toBeTruthy()
    })

    test('Al buscar y encontrar la venta, navega a /devoluciones/nueva con los params', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(
        VENTA_SOLO_CALZADO
      )

      await act(async () => {
        tree = renderer.create(<DevolucionesIndex />)
      })

      const root = tree!.root

      // Ingresar número de venta
      const input = root.findByProps({ testID: 'input-numero-venta' })
      await act(async () => {
        input.props.onChangeText('43')
      })

      // Presionar buscar
      const btnBuscar = root.findByProps({ testID: 'btn-buscar-venta' })
      await act(async () => {
        btnBuscar.props.onPress()
      })

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/devoluciones/nueva',
          params: expect.objectContaining({
            venta: 'venta-uuid-2',
            numero: '43',
          }),
        })
      )
    })

    test('Venta no encontrada muestra "Venta no encontrada."', async () => {
      ;(apiDevoluciones.buscarVentaParaDevolucion as jest.Mock).mockResolvedValue(null)

      await act(async () => {
        tree = renderer.create(<DevolucionesIndex />)
      })

      const root = tree!.root

      const input = root.findByProps({ testID: 'input-numero-venta' })
      await act(async () => {
        input.props.onChangeText('999')
      })

      const btnBuscar = root.findByProps({ testID: 'btn-buscar-venta' })
      await act(async () => {
        btnBuscar.props.onPress()
      })

      const noEncontrada = findAllByText(root, 'Venta no encontrada.')
      expect(noEncontrada.length).toBeGreaterThan(0)
    })
  })
})
