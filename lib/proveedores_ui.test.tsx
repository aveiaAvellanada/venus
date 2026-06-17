import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Linking, Alert, TextInput, Switch } from 'react-native'
import ProveedoresIndex from '../app/(app)/proveedores/index'
import ProveedorDetailScreen from '../app/(app)/proveedores/[id]'
import ProveedorEditorScreen from '../app/(app)/proveedores/editor'
import { useAuth } from './auth'
import * as api from './proveedores'

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    Ionicons: (props: any) => React.createElement(Text, props, props.name),
  }
})

// Mock Expo Router
const mockUseLocalSearchParams = jest.fn(() => ({ id: 'test-prov-id' } as any))
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => mockRouter,
  useFocusEffect: (cb: any) => {
    const React = require('react')
    React.useEffect(() => {
      cb()
    }, [cb])
  },
  Redirect: jest.fn(({ href }) => `Redirected to ${href}`),
}))

// Mock Auth
const mockUseAuth = useAuth as jest.Mock
jest.mock('../lib/auth', () => ({
  useAuth: jest.fn(),
  useRequireModulo: jest.fn(() => null),
}))

// Mock Providers API
jest.mock('../lib/proveedores', () => ({
  listarProveedores: jest.fn(),
  obtenerProveedorPorId: jest.fn(),
  listarCuentasBancarias: jest.fn(),
  obtenerWhatsAppLink: jest.fn((tel, msg) => {
    if (!tel) return ''
    const cleanPhone = tel.replace(/\D/g, '')
    const formattedPhone = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg || '')}`
  }),
  obtenerDeudaProveedor: jest.fn(),
  listarCompras: jest.fn(),
  listarPagosProveedor: jest.fn(),
  crearCuentaBancaria: jest.fn(),
  eliminarCuentaBancaria: jest.fn(),
  registrarPagoProveedor: jest.fn(),
  crearProveedor: jest.fn(),
  actualizarProveedor: jest.fn(),
}))

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => {
  const mockLinking = {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  }
  return {
    __esModule: true,
    default: mockLinking,
    ...mockLinking,
  }
})

describe('Proveedores Module Component Tests', () => {
  const matchText = (children: any, text: string): boolean => {
    if (typeof children === 'string') {
      return children.trim() === text.trim()
    }
    if (typeof children === 'number') {
      return String(children) === text.trim()
    }
    if (Array.isArray(children)) {
      if (children.every(c => typeof c === 'string' || typeof c === 'number')) {
        return children.join('').trim() === text.trim()
      }
      return children.some(c => matchText(c, text))
    }
    return false
  }

  const getButtonsByText = (root: any, text: string) => {
    const textNodes = root.findAll((el: any) => matchText(el.props.children, text))
    return textNodes.map((node: any) => {
      let current = node
      while (current && (!current.props || !current.props.onPress)) {
        current = current.parent
      }
      return current
    }).filter(Boolean)
  }

  const getButtonByText = (root: any, text: string) => {
    const buttons = getButtonsByText(root, text)
    if (buttons.length === 0) throw new Error(`Button with text "${text}" not found`)
    return buttons[0]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocalSearchParams.mockReturnValue({ id: 'test-prov-id' })
    
    // Set default auth to dueno (owner)
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'owner-id' } },
      perfil: { id: 'owner-id', nombre: 'Andrés Artunduaga', rol: 'dueno', activo: true },
      cargando: false,
    })

    // Prevent mock leaks by setting default resolved values
    ;(api.obtenerDeudaProveedor as jest.Mock).mockResolvedValue(0)
    ;(api.listarCompras as jest.Mock).mockResolvedValue([])
    ;(api.listarPagosProveedor as jest.Mock).mockResolvedValue([])
  })

  describe('Providers Listing Screen', () => {
    test('renders providers list from database', async () => {
      const mockProviders = [
        { id: '1', nombre: 'Calzado Bucaramanga', nit_cedula: '123', telefono: '555-1', ciudad: 'Bucaramanga', activo: true },
        { id: '2', nombre: 'Distribuciones Cali', nit_cedula: '456', telefono: '555-2', ciudad: 'Cali', activo: true },
      ];
      
      (api.listarProveedores as jest.Mock).mockResolvedValue(mockProviders)

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedoresIndex />)
      })

      const root = tree.root
      const firstProviderText = root.findAll((el: any) => el.props.children === 'Calzado Bucaramanga')
      const secondProviderText = root.findAll((el: any) => el.props.children === 'Distribuciones Cali')

      expect(firstProviderText.length).toBeGreaterThan(0)
      expect(secondProviderText.length).toBeGreaterThan(0)
    })

    test('triggers reload when search query changes', async () => {
      (api.listarProveedores as jest.Mock).mockResolvedValue([])

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedoresIndex />)
      })

      const root = tree.root
      const searchInput = root.findByType(TextInput)

      // Initial call on mount
      expect(api.listarProveedores).toHaveBeenCalledWith({ buscar: undefined, activo: true })

      // Update search query
      await act(async () => {
        searchInput.props.onChangeText('Bucaramanga')
      })

      // Verification of new call
      expect(api.listarProveedores).toHaveBeenLastCalledWith({ buscar: 'Bucaramanga', activo: true })
    })

    test('triggers reload when toggling active/inactive tabs', async () => {
      (api.listarProveedores as jest.Mock).mockResolvedValue([])

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedoresIndex />)
      })

      const root = tree.root
      
      // Find the inactive tab button using helper
      const inactivosButton = getButtonByText(root, 'Inactivos')

      expect(inactivosButton).toBeDefined()

      // Toggle to inactive
      await act(async () => {
        inactivosButton.props.onPress()
      })

      expect(api.listarProveedores).toHaveBeenLastCalledWith({ buscar: undefined, activo: false })

      // Find active button to switch back
      const activosButton = getButtonByText(root, 'Activos')
      
      await act(async () => {
        activosButton.props.onPress()
      })

      expect(api.listarProveedores).toHaveBeenLastCalledWith({ buscar: undefined, activo: true })
    })
  })

  describe('Provider Detail Screen - Gating and Access Control', () => {
    test('displays financial data (debt, purchases) if user is owner (dueno)', async () => {
      // Setup owner profile
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'owner-id' } },
        perfil: { id: 'owner-id', nombre: 'Andrés Owner', rol: 'dueno', activo: true },
        cargando: false,
      });

      // Mock detail loads
      (api.obtenerProveedorPorId as jest.Mock).mockResolvedValue({
        id: 'test-prov-id',
        nombre: 'Provider 1',
        nit_cedula: '900-1',
        telefono: '3151234567',
        ciudad: 'Florencia',
        activo: true,
        notas: '',
      });
      (api.listarCuentasBancarias as jest.Mock).mockResolvedValue([]);
      
      // Mock financial fetches
      (api.obtenerDeudaProveedor as jest.Mock).mockResolvedValue(450000);
      (api.listarCompras as jest.Mock).mockResolvedValue([
        { id: 'c1', condicion_pago: 'credito', saldo_pendiente: 450000, total: 500000, estado: 'completada', created_at: '2026-06-10' },
      ]);
      (api.listarPagosProveedor as jest.Mock).mockResolvedValue([
        { id: 'p1', monto: 50000, fecha: '2026-06-11', notas: 'Primer abono' },
      ]);

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedorDetailScreen />)
      })
      // Flush microtasks
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Check endpoints were called
      expect(api.obtenerDeudaProveedor).toHaveBeenCalledWith('test-prov-id')
      expect(api.listarCompras).toHaveBeenCalled()
      expect(api.listarPagosProveedor).toHaveBeenCalledWith('test-prov-id')

      // Check financial panel exists in tree
      const root = tree.root
      const financialPanel = root.findAllByProps({ testID: 'financial-panel' })
      expect(financialPanel.length).toBeGreaterThan(0)

      // Verify debt text
      const debtText = root.findAll((el: any) => {
        if (el.type === 'Text') {
          const children = el.props.children
          if (Array.isArray(children)) {
            return children.join('').includes('450.000')
          }
          return typeof children === 'string' && children.includes('450.000')
        }
        return false
      })
      expect(debtText.length).toBeGreaterThan(0)
    })

    test('completely hides financial data and bypasses DB requests if user is admin (Sandra)', async () => {
      // Setup admin profile
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'admin-id' } },
        perfil: { id: 'admin-id', nombre: 'Sandra Admin', rol: 'admin', activo: true },
        cargando: false,
      });

      // Mock detail loads
      (api.obtenerProveedorPorId as jest.Mock).mockResolvedValue({
        id: 'test-prov-id',
        nombre: 'Provider 1',
        nit_cedula: '900-1',
        telefono: '3151234567',
        ciudad: 'Florencia',
        activo: true,
        notas: '',
      });
      (api.listarCuentasBancarias as jest.Mock).mockResolvedValue([]);

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedorDetailScreen />)
      })

      // Verify that NO calls to financial endpoints were made
      expect(api.obtenerDeudaProveedor).not.toHaveBeenCalled()
      expect(api.listarCompras).not.toHaveBeenCalled()
      expect(api.listarPagosProveedor).not.toHaveBeenCalled()

      // Verify financial panel is hidden
      const root = tree.root
      const financialPanel = root.findAllByProps({ testID: 'financial-panel' })
      expect(financialPanel.length).toBe(0)
    })
  })

  describe('WhatsApp Link Integration', () => {
    test('triggers Linking.openURL with the formatted WhatsApp URL', async () => {
      // Mock detail loads
      (api.obtenerProveedorPorId as jest.Mock).mockResolvedValue({
        id: 'test-prov-id',
        nombre: 'Provider 1',
        nit_cedula: '900-1',
        telefono: '3151234567',
        ciudad: 'Florencia',
        activo: true,
        notas: '',
      });
      (api.listarCuentasBancarias as jest.Mock).mockResolvedValue([]);

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedorDetailScreen />)
      })

      const root = tree.root
      const whatsappBtn = root.findByProps({ testID: 'whatsapp-btn' })

      await act(async () => {
        whatsappBtn.props.onPress()
      })

      // Verify Linking.openURL was called with the correct formatting
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/573151234567')
      )
    })
  })

  describe('Provider Editor Screen', () => {
    beforeEach(() => {
      mockUseLocalSearchParams.mockReturnValue({}) // default is creation mode
    })

    test('displays alert validation error when saving with empty nombre', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedorEditorScreen />)
      })

      const root = tree.root
      const saveBtn = root.findByProps({ testID: 'btn-guardar' })

      await act(async () => {
        saveBtn.props.onPress()
      })

      expect(alertSpy).toHaveBeenCalledWith('Campo obligatorio', 'El nombre del proveedor es requerido.')
      expect(api.crearProveedor).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })

    test('submits correctly when saving with only mandatory fields', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      ;(api.crearProveedor as jest.Mock).mockResolvedValue({ id: 'new-id' })

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedorEditorScreen />)
      })

      const root = tree.root
      const nombreInput = root.findByProps({ testID: 'input-nombre' })
      const saveBtn = root.findByProps({ testID: 'btn-guardar' })

      await act(async () => {
        nombreInput.props.onChangeText('Nuevo Proveedor')
      })

      await act(async () => {
        saveBtn.props.onPress()
      })

      expect(api.crearProveedor).toHaveBeenCalledWith({
        nombre: 'Nuevo Proveedor',
        nit_cedula: null,
        telefono: null,
        ciudad: null,
        notas: null,
        activo: true,
      })
      expect(alertSpy).toHaveBeenCalledWith('Éxito', 'El proveedor ha sido registrado correctamente.', expect.any(Array))
      
      alertSpy.mockRestore()
    })

    test('loads existing provider data, maps fields, and updates on save', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      mockUseLocalSearchParams.mockReturnValue({ id: 'edit-prov-id' })
      
      ;(api.obtenerProveedorPorId as jest.Mock).mockResolvedValue({
        id: 'edit-prov-id',
        nombre: 'Proveedor Existente',
        nit_cedula: '12345',
        telefono: '3120000000',
        ciudad: 'Neiva',
        activo: true,
        notas: 'Email: test@test.com\nNotas internas del proveedor',
      })
      ;(api.actualizarProveedor as jest.Mock).mockResolvedValue({})

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedorEditorScreen />)
      })

      // Flush microtasks to allow the loading of provider data
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      const root = tree.root
      const nombreInput = root.findByProps({ testID: 'input-nombre' })
      const nitInput = root.findByProps({ testID: 'input-nit' })
      const telefonoInput = root.findByProps({ testID: 'input-telefono' })
      const ciudadInput = root.findByProps({ testID: 'input-ciudad' })
      const emailInput = root.findByProps({ testID: 'input-email' })
      const notasInput = root.findByProps({ testID: 'input-notas' })
      const activeSwitch = root.findByProps({ testID: 'switch-activo' })
      const saveBtn = root.findByProps({ testID: 'btn-guardar' })

      // Verify that values loaded correctly
      expect(nombreInput.props.value).toBe('Proveedor Existente')
      expect(nitInput.props.value).toBe('12345')
      expect(telefonoInput.props.value).toBe('3120000000')
      expect(ciudadInput.props.value).toBe('Neiva')
      expect(emailInput.props.value).toBe('test@test.com')
      expect(notasInput.props.value).toBe('Notas internas del proveedor')
      expect(activeSwitch.props.value).toBe(true)

      // Edit fields
      await act(async () => {
        nombreInput.props.onChangeText('Proveedor Editado')
        emailInput.props.onChangeText('nuevo@test.com')
        activeSwitch.props.onValueChange(false)
      })

      // Save changes
      await act(async () => {
        saveBtn.props.onPress()
      })

      expect(api.actualizarProveedor).toHaveBeenCalledWith('edit-prov-id', {
        nombre: 'Proveedor Editado',
        nit_cedula: '12345',
        telefono: '3120000000',
        ciudad: 'Neiva',
        notas: 'Email: nuevo@test.com\nNotas internas del proveedor',
        activo: false,
      })
      expect(alertSpy).toHaveBeenCalledWith('Éxito', 'El proveedor ha sido actualizado correctamente.', expect.any(Array))

      alertSpy.mockRestore()
    })
  })

  describe('Register Payment Modal Logic', () => {
    let root: any
    let alertSpy: any
    let payRowBtn: any

    beforeEach(async () => {
      alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      
      // Setup owner profile
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'owner-id' } },
        perfil: { id: 'owner-id', nombre: 'Andrés Owner', rol: 'dueno', activo: true },
        cargando: false,
      });

      // Mock detail loads
      (api.obtenerProveedorPorId as jest.Mock).mockResolvedValue({
        id: 'test-prov-id',
        nombre: 'Provider 1',
        nit_cedula: '900-1',
        telefono: '3151234567',
        ciudad: 'Florencia',
        activo: true,
        notas: '',
      });
      (api.listarCuentasBancarias as jest.Mock).mockResolvedValue([]);
      (api.obtenerDeudaProveedor as jest.Mock).mockResolvedValue(450000);
      (api.listarCompras as jest.Mock).mockResolvedValue([
        { id: 'c1', condicion_pago: 'credito', saldo_pendiente: 450000, total: 500000, estado: 'completada', created_at: '2026-06-10' },
      ]);
      (api.listarPagosProveedor as jest.Mock).mockResolvedValue([]);

      let tree: any
      await act(async () => {
        tree = renderer.create(<ProveedorDetailScreen />)
      })
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      root = tree.root

      // Find the payment button on the purchase row using helper
      payRowBtn = getButtonByText(root, 'Registrar Pago')
    })

    afterEach(() => {
      alertSpy.mockRestore()
    })

    test('opens modal when clicking pay button on purchase row', async () => {
      expect(payRowBtn).toBeDefined()

      await act(async () => {
        payRowBtn.props.onPress()
      })

      // Once pressed, the modal inputs should be available
      const amountInput = root.findByProps({ placeholder: 'Monto en COP' })
      expect(amountInput).toBeDefined()
    })

    test('displays alert for negative value or zero payment', async () => {
      // Open modal
      await act(async () => {
        payRowBtn.props.onPress()
      })

      const amountInput = root.findByProps({ placeholder: 'Monto en COP' })
      
      // Find modal submit button: the one that isn't the row button
      const allPayButtons = getButtonsByText(root, 'Registrar Pago')
      const modalSaveBtn = allPayButtons.find((btn: any) => btn !== payRowBtn)
      expect(modalSaveBtn).toBeDefined()

      // Test negative value
      await act(async () => {
        amountInput.props.onChangeText('-50000')
      })
      await act(async () => {
        modalSaveBtn.props.onPress()
      })

      expect(alertSpy).toHaveBeenCalledWith('Monto inválido', 'El monto debe ser un número mayor a cero.')
      expect(api.registrarPagoProveedor).not.toHaveBeenCalled()

      // Test zero
      alertSpy.mockClear()
      await act(async () => {
        amountInput.props.onChangeText('0')
      })
      await act(async () => {
        modalSaveBtn.props.onPress()
      })

      expect(alertSpy).toHaveBeenCalledWith('Monto inválido', 'El monto debe ser un número mayor a cero.')
      expect(api.registrarPagoProveedor).not.toHaveBeenCalled()
    })

    test('displays alert when payment amount exceeds pending balance', async () => {
      // Open modal
      await act(async () => {
        payRowBtn.props.onPress()
      })

      const amountInput = root.findByProps({ placeholder: 'Monto en COP' })
      
      const allPayButtons = getButtonsByText(root, 'Registrar Pago')
      const modalSaveBtn = allPayButtons.find((btn: any) => btn !== payRowBtn)

      // Purchase pending balance is 450000, let's pay 500000
      await act(async () => {
        amountInput.props.onChangeText('500000')
      })
      await act(async () => {
        modalSaveBtn.props.onPress()
      })

      expect(alertSpy).toHaveBeenCalledWith('Monto excedido', 'El monto del pago supera el saldo pendiente de la compra.')
      expect(api.registrarPagoProveedor).not.toHaveBeenCalled()
    })

    test('registers payment successfully when input is valid', async () => {
      // Open modal
      await act(async () => {
        payRowBtn.props.onPress()
      })

      const amountInput = root.findByProps({ placeholder: 'Monto en COP' })
      const notesInput = root.findByProps({ placeholder: 'Comprobante, Nequi ref, etc.' })
      
      const allPayButtons = getButtonsByText(root, 'Registrar Pago')
      const modalSaveBtn = allPayButtons.find((btn: any) => btn !== payRowBtn)

      // Enter valid payment: 200000
      await act(async () => {
        amountInput.props.onChangeText('200000')
        notesInput.props.onChangeText('Abono parcial ref 9876')
      })

      ;(api.registrarPagoProveedor as jest.Mock).mockResolvedValue({})

      await act(async () => {
        modalSaveBtn.props.onPress()
      })

      expect(api.registrarPagoProveedor).toHaveBeenCalledWith({
        compra_id: 'c1',
        registrado_por: 'owner-id',
        monto: 200000,
        notas: 'Abono parcial ref 9876',
      })
      expect(alertSpy).toHaveBeenCalledWith('Éxito', 'Pago registrado correctamente.')
    })
  })
})
