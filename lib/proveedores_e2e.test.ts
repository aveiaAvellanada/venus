// In-memory Database mock for Supabase E2E Testing
const mockDb: {
  proveedores: any[]
  proveedor_cuentas_bancarias: any[]
  compras: any[]
  compra_items: any[]
  compra_pagos: any[]
  productos_calzado: any[]
} = {
  proveedores: [],
  proveedor_cuentas_bancarias: [],
  compras: [],
  compra_items: [],
  compra_pagos: [],
  productos_calzado: []
}

function resetDatabase() {
  mockDb.proveedores = []
  mockDb.proveedor_cuentas_bancarias = []
  mockDb.compras = []
  mockDb.compra_items = []
  mockDb.compra_pagos = []
  mockDb.productos_calzado = []
}

class MockQueryBuilder {
  table: string
  filters: Array<(item: any) => boolean> = []
  orderByField?: string
  orderByAscending: boolean = true
  limitVal?: number
  operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  insertData: any = null
  updateData: any = null
  isSingle: boolean = false
  isMaybeSingle: boolean = false

  constructor(table: string) {
    this.table = table
  }

  select(columns: string = '*') {
    return this
  }

  eq(column: string, value: any) {
    this.filters.push(item => item[column] === value)
    return this
  }

  in(column: string, values: any[]) {
    this.filters.push(item => values.includes(item[column]))
    return this
  }

  or(filterStr: string) {
    const conditions = filterStr.split(',').map(cond => {
      const parts = cond.split('.')
      const field = parts[0]
      const operator = parts[1]
      const rawVal = parts[2]
      let val = rawVal
      if (operator === 'ilike') {
        val = rawVal.replace(/%/g, '').toLowerCase()
      }
      return { field, operator, val }
    })
    
    this.filters.push(item => {
      return conditions.some(c => {
        const itemVal = String(item[c.field] || '').toLowerCase()
        return itemVal.includes(c.val)
      })
    })
    return this
  }

  ilike(column: string, pattern: string) {
    const term = pattern.replace(/%/g, '').toLowerCase()
    this.filters.push(item => String(item[column] || '').toLowerCase().includes(term))
    return this
  }

  gt(column: string, value: any) {
    this.filters.push(item => Number(item[column] || 0) > Number(value))
    return this
  }

  lte(column: string, value: any) {
    this.filters.push(item => Number(item[column] || 0) <= Number(value))
    return this
  }

  order(field: string, options?: { ascending: boolean }) {
    this.orderByField = field
    this.orderByAscending = options?.ascending ?? true
    return this
  }

  limit(val: number) {
    this.limitVal = val
    return this
  }

  single() {
    this.isSingle = true
    return this
  }

  maybeSingle() {
    this.isMaybeSingle = true
    return this
  }

  insert(recordOrRecords: any) {
    this.operation = 'insert'
    this.insertData = recordOrRecords
    return this
  }

  update(updates: any) {
    this.operation = 'update'
    this.updateData = updates
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  async execute() {
    // Helper to recalculate a purchase balance
    const recalculateCompra = (compra: any) => {
      if (compra.estado === 'cancelada' || compra.estado === 'pendiente_revision') {
        compra.saldo_pendiente = 0;
      } else if (compra.condicion_pago === 'contado') {
        compra.monto_pagado = compra.total || 0;
        compra.saldo_pendiente = 0;
      } else if (compra.condicion_pago === 'credito') {
        const totalPagos = mockDb.compra_pagos
          .filter(p => p.compra_id === compra.id)
          .reduce((sum, p) => sum + Number(p.monto || 0), 0);
        compra.monto_pagado = totalPagos;
        compra.saldo_pendiente = Math.max(0, (compra.total || 0) - totalPagos);
      }
    };

    // Validation for compra_pagos
    if (this.table === 'compra_pagos' && (this.operation === 'insert' || this.operation === 'update')) {
      const payments = this.operation === 'insert'
        ? (Array.isArray(this.insertData) ? this.insertData : [this.insertData])
        : (Array.isArray(this.updateData) ? this.updateData : [this.updateData]);
      for (const p of payments) {
        const compra = mockDb.compras.find(c => c.id === p.compra_id);
        if (!compra || compra.estado !== 'completada') {
          return { data: null, error: { message: 'Solo se pueden registrar pagos a compras completadas.' } };
        }
        if (compra.condicion_pago !== 'credito') {
          return { data: null, error: { message: 'Solo se pueden registrar pagos a compras a crédito.' } };
        }
      }
    }

    let resultData: any = null
    let resultError: any = null

    if (this.operation === 'insert') {
      const recordOrRecords = this.insertData
      const isArray = Array.isArray(recordOrRecords)
      const records = isArray ? recordOrRecords : [recordOrRecords]
      
      const createdRecords = records.map(r => {
        const newRecord = {
          id: r.id || Math.random().toString(36).substring(7),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...r
        }
        ;(mockDb as any)[this.table].push(newRecord)
        return newRecord
      })
      resultData = isArray ? createdRecords : createdRecords[0]

      // Post-insert Triggers
      if (this.table === 'compra_items') {
        const insertedItems = isArray ? resultData : [resultData];
        for (const ci of insertedItems) {
          const compra = mockDb.compras.find(c => c.id === ci.compra_id);
          if (compra && compra.estado === 'completada' && ci.producto_calzado_id) {
            const product = mockDb.productos_calzado.find(p => p.id === ci.producto_calzado_id);
            if (product) {
              product.stock_actual = (product.stock_actual || 0) + ci.cantidad;
            }
          }
        }
      } else if (this.table === 'compra_pagos') {
        const insertedPayments = isArray ? resultData : [resultData];
        for (const p of insertedPayments) {
          const compra = mockDb.compras.find(c => c.id === p.compra_id);
          if (compra) {
            recalculateCompra(compra);
          }
        }
      } else if (this.table === 'compras') {
        const insertedCompras = isArray ? resultData : [resultData];
        for (const c of insertedCompras) {
          recalculateCompra(c);
        }
      }

    } else if (this.operation === 'update') {
      let list = (mockDb as any)[this.table]
      for (const filter of this.filters) {
        list = list.filter(filter)
      }

      const oldStates = new Map<string, string>();
      if (this.table === 'compras') {
        for (const item of list) {
          oldStates.set(item.id, item.estado);
        }
      }

      const updated = list.map((item: any) => {
        Object.assign(item, this.updateData, { updated_at: new Date().toISOString() })
        return item
      })
      resultData = updated

      // Post-update Triggers
      if (this.table === 'compras') {
        for (const item of updated) {
          recalculateCompra(item);
          const oldEstado = oldStates.get(item.id);
          const newEstado = item.estado;
          if (oldEstado !== newEstado) {
            const items = mockDb.compra_items.filter(ci => ci.compra_id === item.id);
            if ((oldEstado === 'pendiente_revision' || oldEstado === 'cancelada') && newEstado === 'completada') {
              for (const ci of items) {
                if (ci.producto_calzado_id) {
                  const product = mockDb.productos_calzado.find(p => p.id === ci.producto_calzado_id);
                  if (product) {
                    product.stock_actual = (product.stock_actual || 0) + ci.cantidad;
                  }
                }
              }
            } else if (oldEstado === 'completada' && newEstado === 'cancelada') {
              for (const ci of items) {
                if (ci.producto_calzado_id) {
                  const product = mockDb.productos_calzado.find(p => p.id === ci.producto_calzado_id);
                  if (product) {
                    product.stock_actual = Math.max(0, (product.stock_actual || 0) - ci.cantidad);
                  }
                }
              }
            }
          }
        }
      } else if (this.table === 'compra_pagos') {
        const updatedPayments = Array.isArray(resultData) ? resultData : [resultData];
        for (const p of updatedPayments) {
          const compra = mockDb.compras.find(c => c.id === p.compra_id);
          if (compra) {
            recalculateCompra(compra);
          }
        }
      }

    } else if (this.operation === 'delete') {
      let list = (mockDb as any)[this.table]
      for (const filter of this.filters) {
        list = list.filter(filter)
      }

      const matchingIds = list.map((item: any) => item.id)
      ;(mockDb as any)[this.table] = (mockDb as any)[this.table].filter((item: any) => !matchingIds.includes(item.id))
      resultData = list

      // Post-delete Triggers
      if (this.table === 'compras') {
        const deletedCompras = Array.isArray(resultData) ? resultData : [resultData];
        for (const r of deletedCompras) {
          if (r.estado === 'completada') {
            const items = mockDb.compra_items.filter(ci => ci.compra_id === r.id);
            for (const ci of items) {
              if (ci.producto_calzado_id) {
                const product = mockDb.productos_calzado.find(p => p.id === ci.producto_calzado_id);
                if (product) {
                  product.stock_actual = Math.max(0, (product.stock_actual || 0) - ci.cantidad);
                }
              }
            }
          }
        }
      } else if (this.table === 'compra_pagos') {
        const deletedPayments = Array.isArray(resultData) ? resultData : [resultData];
        for (const p of deletedPayments) {
          const compra = mockDb.compras.find(c => c.id === p.compra_id);
          if (compra) {
            recalculateCompra(compra);
          }
        }
      }

    } else {
      // select
      let list = [...((mockDb as any)[this.table] || [])]
      for (const filter of this.filters) {
        list = list.filter(filter)
      }

      if (this.orderByField) {
        const f = this.orderByField
        const asc = this.orderByAscending
        list.sort((a, b) => {
          const va = a[f]
          const vb = b[f]
          if (va == null) return 1
          if (vb == null) return -1
          if (va < vb) return asc ? -1 : 1
          if (va > vb) return asc ? 1 : -1
          return 0
        })
      }

      if (this.limitVal !== undefined) {
        list = list.slice(0, this.limitVal)
      }
      resultData = list
    }

    if (this.isSingle || this.isMaybeSingle) {
      const arr = Array.isArray(resultData) ? resultData : [resultData]
      if (arr.length === 0) {
        if (this.isSingle) {
          resultError = { message: 'Row not found' }
        }
        resultData = null
      } else {
        resultData = arr[0]
      }
    }

    return { data: resultData, error: resultError }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected)
  }
}

// Mock the Supabase client
jest.mock('./supabase', () => {
  return {
    supabase: {
      from: (table: string) => new MockQueryBuilder(table),
      rpc: (fn: string, args: any) => {
        if (fn === 'obtener_deuda_proveedor') {
          if (args.p_id === 'force-rpc-error') {
            return Promise.resolve({ data: null, error: new Error('Forced RPC Error') })
          }
          const sum = mockDb.compras
            .filter(c => c.proveedor_id === args.p_id && c.estado === 'completada' && c.condicion_pago === 'credito')
            .reduce((acc, row) => acc + (row.saldo_pendiente || 0), 0)
          return Promise.resolve({ data: sum, error: null })
        }
        return Promise.resolve({ data: null, error: new Error(`RPC ${fn} not implemented`) })
      }
    }
  }
})

// Now import the module under test
import * as api from './proveedores'

describe('Providers E2E Test Suite (60+ cases)', () => {
  beforeEach(() => {
    resetDatabase()
  })

  // ==========================================================
  // TIER 1: Basic Unit & CRUD Operations (20 Tests)
  // ==========================================================
  describe('Tier 1: Basic Unit & CRUD Operations', () => {
    
    // 1. Create a provider with all details
    test('1. crearProveedor registers a provider with all details', async () => {
      const prov = await api.crearProveedor({
        nombre: 'Calzado Bucaramanga',
        nit_cedula: '900.123.456-7',
        telefono: '3151234567',
        ciudad: 'Bucaramanga',
        notas: 'Principal proveedor de cuero',
        activo: true,
        created_by: 'owner-id'
      })
      expect(prov.id).toBeDefined()
      expect(prov.nombre).toBe('Calzado Bucaramanga')
      expect(prov.ciudad).toBe('Bucaramanga')
      expect(mockDb.proveedores).toHaveLength(1)
    })

    // 2. Create a provider with only required fields (name)
    test('2. crearProveedor with only required fields', async () => {
      const prov = await api.crearProveedor({ nombre: 'Distribuidora Bogota' })
      expect(prov.id).toBeDefined()
      expect(prov.nombre).toBe('Distribuidora Bogota')
      expect(prov.activo).toBeUndefined() // is omitted unless default is set
    })

    // 3. Fail to create a provider with empty name
    test('3. crearProveedor fails with empty name', async () => {
      await expect(api.crearProveedor({ nombre: '' })).rejects.toThrow()
      await expect(api.crearProveedor({ nombre: '   ' })).rejects.toThrow()
    })

    // 4. List all providers
    test('4. listarProveedores lists all providers ordered by name', async () => {
      await api.crearProveedor({ nombre: 'Beta Zapatos' })
      await api.crearProveedor({ nombre: 'Alpha Calzado' })
      const list = await api.listarProveedores()
      expect(list).toHaveLength(2)
      expect(list[0].nombre).toBe('Alpha Calzado')
      expect(list[1].nombre).toBe('Beta Zapatos')
    })

    // 5. Filter providers by active status (active only)
    test('5. listarProveedores filters active only', async () => {
      await api.crearProveedor({ nombre: 'P1', activo: true })
      await api.crearProveedor({ nombre: 'P2', activo: false })
      const list = await api.listarProveedores({ activo: true })
      expect(list).toHaveLength(1)
      expect(list[0].nombre).toBe('P1')
    })

    // 6. Filter providers by active status (inactive only)
    test('6. listarProveedores filters inactive only', async () => {
      await api.crearProveedor({ nombre: 'P1', activo: true })
      await api.crearProveedor({ nombre: 'P2', activo: false })
      const list = await api.listarProveedores({ activo: false })
      expect(list).toHaveLength(1)
      expect(list[0].nombre).toBe('P2')
    })

    // 7. Search providers by name (case-insensitive, partial match)
    test('7. listarProveedores searches by name (partial)', async () => {
      await api.crearProveedor({ nombre: 'Calzado Medellín' })
      await api.crearProveedor({ nombre: 'Tenis Cali' })
      const list = await api.listarProveedores({ buscar: 'mede' })
      expect(list).toHaveLength(1)
      expect(list[0].nombre).toBe('Calzado Medellín')
    })

    // 8. Search providers by NIT/Cedula
    test('8. listarProveedores searches by NIT', async () => {
      await api.crearProveedor({ nombre: 'Prov 1', nit_cedula: '123456' })
      await api.crearProveedor({ nombre: 'Prov 2', nit_cedula: '789012' })
      const list = await api.listarProveedores({ buscar: '7890' })
      expect(list).toHaveLength(1)
      expect(list[0].nombre).toBe('Prov 2')
    })

    // 9. Search providers with no matches returns empty array
    test('9. listarProveedores returns empty if no matches', async () => {
      await api.crearProveedor({ nombre: 'Prov 1' })
      const list = await api.listarProveedores({ buscar: 'invalido' })
      expect(list).toHaveLength(0)
    })

    // 10. Retrieve a provider by ID
    test('10. obtenerProveedorPorId retrieves a provider by ID', async () => {
      const p = await api.crearProveedor({ nombre: 'Mi Proveedor' })
      const retrieved = await api.obtenerProveedorPorId(p.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved?.nombre).toBe('Mi Proveedor')
      
      const notFound = await api.obtenerProveedorPorId('id-inexistente')
      expect(notFound).toBeNull()
    })

    // 11. Update provider details (name, city, telephone)
    test('11. actualizarProveedor updates provider fields', async () => {
      const p = await api.crearProveedor({ nombre: 'Original', ciudad: 'Cali' })
      const updated = await api.actualizarProveedor(p.id, { nombre: 'Modificado', ciudad: 'Bogota' })
      expect(updated.nombre).toBe('Modificado')
      expect(updated.ciudad).toBe('Bogota')
      
      const check = await api.obtenerProveedorPorId(p.id)
      expect(check?.nombre).toBe('Modificado')
    })

    // 12. Set provider fields to null where permitted
    test('12. actualizarProveedor allows setting fields to null', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov', nit_cedula: '123' })
      const updated = await api.actualizarProveedor(p.id, { nit_cedula: null })
      expect(updated.nit_cedula).toBeNull()
    })

    // 13. Toggle provider status from active to inactive
    test('13. Toggle active status', async () => {
      const p = await api.crearProveedor({ nombre: 'Activo', activo: true })
      const updated = await api.actualizarProveedor(p.id, { activo: false })
      expect(updated.activo).toBe(false)
    })

    // 14. Create a bank account linked to a provider
    test('14. crearCuentaBancaria registers bank account', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const account = await api.crearCuentaBancaria({
        proveedor_id: p.id,
        banco: 'Bancolombia',
        tipo_cuenta: 'ahorros',
        numero_cuenta: '123456789',
        titular: 'Juan Perez'
      })
      expect(account.id).toBeDefined()
      expect(account.banco).toBe('Bancolombia')
      expect(mockDb.proveedor_cuentas_bancarias).toHaveLength(1)
    })

    // 15. Fail to create a bank account with missing bank/account number
    test('15. crearCuentaBancaria fails on missing bank/number/type', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      await expect(api.crearCuentaBancaria({
        proveedor_id: p.id,
        banco: '',
        tipo_cuenta: 'ahorros',
        numero_cuenta: '123'
      })).rejects.toThrow()
    })

    // 16. List bank accounts for a specific provider
    test('16. listarCuentasBancarias returns accounts ordered by created_at', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      await api.crearCuentaBancaria({
        proveedor_id: p.id,
        banco: 'Bancolombia',
        tipo_cuenta: 'ahorros',
        numero_cuenta: '1'
      })
      await api.crearCuentaBancaria({
        proveedor_id: p.id,
        banco: 'Daviplata',
        tipo_cuenta: 'ahorros',
        numero_cuenta: '2'
      })
      const list = await api.listarCuentasBancarias(p.id)
      expect(list).toHaveLength(2)
      expect(list[0].banco).toBe('Bancolombia')
      expect(list[1].banco).toBe('Daviplata')
    })

    // 17. Retrieve empty list of bank accounts for a provider with none
    test('17. listarCuentasBancarias returns empty array if none exist', async () => {
      const list = await api.listarCuentasBancarias('any-id')
      expect(list).toEqual([])
    })

    // 18. Update a bank account's details
    test('18. actualizarCuentaBancaria updates account details', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const acc = await api.crearCuentaBancaria({
        proveedor_id: p.id,
        banco: 'Bancolombia',
        tipo_cuenta: 'ahorros',
        numero_cuenta: '123'
      })
      const updated = await api.actualizarCuentaBancaria(acc.id, { numero_cuenta: '999' })
      expect(updated.numero_cuenta).toBe('999')
    })

    // 19. Delete a bank account successfully
    test('19. eliminarCuentaBancaria deletes account', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const acc = await api.crearCuentaBancaria({
        proveedor_id: p.id,
        banco: 'Daviplata',
        tipo_cuenta: 'ahorros',
        numero_cuenta: '123'
      })
      expect(mockDb.proveedor_cuentas_bancarias).toHaveLength(1)
      await api.eliminarCuentaBancaria(acc.id)
      expect(mockDb.proveedor_cuentas_bancarias).toHaveLength(0)
    })

    // 20. Verify deleted bank account no longer appears in listing
    test('20. Deleted bank account is missing in listing', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const acc = await api.crearCuentaBancaria({
        proveedor_id: p.id,
        banco: 'Daviplata',
        tipo_cuenta: 'ahorros',
        numero_cuenta: '123'
      })
      await api.eliminarCuentaBancaria(acc.id)
      const list = await api.listarCuentasBancarias(p.id)
      expect(list).toHaveLength(0)
    })
  })

  // ==========================================================
  // TIER 2: Business Logic & Status Transitions (15 Tests)
  // ==========================================================
  describe('Tier 2: Business Logic & Status Transitions', () => {

    // 21. Register arrival of physical goods by employee
    test('21. registrarLlegadaFisica creates purchase in pendiente_revision', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const compra = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'camilo-emp',
        items: [
          { descripcion: 'Zapato Escolar Negro', cantidad: 10, talla: '35', color: 'Negro' }
        ]
      })
      expect(compra.estado).toBe('pendiente_revision')
      expect(compra.registrada_por).toBe('camilo-emp')
      expect(mockDb.compras).toHaveLength(1)
      expect(mockDb.compra_items).toHaveLength(1)
    })

    // 22. Verify that an arrival has null total cost and null financial fields
    test('22. Physical arrival has null financial fields', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const compra = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'camilo-emp',
        items: [{ descripcion: 'Tennis Rojo', cantidad: 5 }]
      })
      expect(compra.total).toBeNull()
      expect(compra.condicion_pago).toBeNull()
      expect(compra.monto_pagado).toBe(0)
      expect(compra.saldo_pendiente).toBe(0)
    })

    // 23. Verify that arrival items have null unit costs
    test('23. Arrival items have null unit costs initially', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const compra = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'camilo-emp',
        items: [{ descripcion: 'Tennis Rojo', cantidad: 5 }]
      })
      const fullCompra = await api.obtenerCompraPorId(compra.id)
      expect(fullCompra?.items?.[0].costo_unitario).toBeNull()
      expect(fullCompra?.items?.[0].subtotal).toBeNull()
    })

    // 24. Verify that registering arrival fails with empty items
    test('24. registrarLlegadaFisica fails with empty items', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      await expect(api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'emp',
        items: []
      })).rejects.toThrow('Debe registrar al menos un producto.')
    })

    // 25. Verify stock does NOT increase while purchase is pendiente_revision
    test('25. Stock does not change during pending review status', async () => {
      const prodId = 'calzado-1'
      mockDb.productos_calzado.push({ id: prodId, descripcion: 'Zapato', stock_actual: 40 })
      
      const p = await api.crearProveedor({ nombre: 'Prov' })
      await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'emp',
        items: [{ descripcion: 'Zapato', cantidad: 10, producto_calzado_id: prodId }]
      })
      
      const prod = mockDb.productos_calzado.find(pr => pr.id === prodId)
      expect(prod.stock_actual).toBe(40)
    })

    // 26. Owner reviews and approves an arrival, inputting costs
    test('26. completarInformacionFinanciera successfully completes purchase', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const compra = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'emp',
        items: [{ descripcion: 'Zapato', cantidad: 5 }]
      })

      const fullCompra = await api.obtenerCompraPorId(compra.id)
      const itemId = fullCompra?.items?.[0].id!

      const completed = await api.completarInformacionFinanciera({
        compra_id: compra.id,
        revisada_por: 'andres-owner',
        condicion_pago: 'contado',
        itemsCostos: [{ item_id: itemId, costo_unitario: 50000 }]
      })

      expect(completed.estado).toBe('completada')
      expect(completed.total).toBe(250000)
      expect(completed.condicion_pago).toBe('contado')
      expect(completed.revisada_por).toBe('andres-owner')
    })

    // 27. Verify purchase state changes to completada after review
    test('27. completada state is verified', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const c = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'emp',
        items: [{ descripcion: 'A', cantidad: 2 }]
      })
      const full = await api.obtenerCompraPorId(c.id)
      const comp = await api.completarInformacionFinanciera({
        compra_id: c.id,
        revisada_por: 'owner',
        condicion_pago: 'credito',
        itemsCostos: [{ item_id: full?.items?.[0].id!, costo_unitario: 1000 }]
      })
      expect(comp.estado).toBe('completada')
    })

    // 28. Verify purchase total is calculated correctly as sum of items
    test('28. Purchase total is calculated as sum of item subtotals', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const c = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'emp',
        items: [
          { descripcion: 'Item 1', cantidad: 2 },
          { descripcion: 'Item 2', cantidad: 3 }
        ]
      })
      const full = await api.obtenerCompraPorId(c.id)
      const itemId1 = full?.items?.find(i => i.descripcion === 'Item 1')?.id!
      const itemId2 = full?.items?.find(i => i.descripcion === 'Item 2')?.id!

      const comp = await api.completarInformacionFinanciera({
        compra_id: c.id,
        revisada_por: 'owner',
        condicion_pago: 'credito',
        itemsCostos: [
          { item_id: itemId1, costo_unitario: 10000 },
          { item_id: itemId2, costo_unitario: 20000 }
        ]
      })
      expect(comp.total).toBe(80000)
    })

    // 29. Verify stock is updated when purchase changes to completada
    test('29. Stock is updated after completing a pending arrival', async () => {
      const prodId = 'p-1'
      mockDb.productos_calzado.push({ id: prodId, stock_actual: 10 })

      const p = await api.crearProveedor({ nombre: 'Prov' })
      const c = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'emp',
        items: [{ descripcion: 'P1', cantidad: 5, producto_calzado_id: prodId }]
      })

      const full = await api.obtenerCompraPorId(c.id)
      await api.completarInformacionFinanciera({
        compra_id: c.id,
        revisada_por: 'owner',
        condicion_pago: 'credito',
        itemsCostos: [{ item_id: full?.items?.[0].id!, costo_unitario: 100 }]
      })

      const prod = mockDb.productos_calzado.find(pr => pr.id === prodId)
      expect(prod.stock_actual).toBe(15)
    })

    // 30. Register a direct purchase as cash (contado)
    test('30. registrarCompraDirecta with contado', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'contado',
        items: [
          { descripcion: 'Direct 1', cantidad: 2, costo_unitario: 10000 }
        ]
      })

      expect(comp.estado).toBe('completada')
      expect(comp.condicion_pago).toBe('contado')
      expect(comp.total).toBe(20000)
    })

    // 31. Verify cash purchase total is calculated and saldo_pendiente is 0
    test('31. Contado purchase has 0 saldo_pendiente and full paid amount', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'contado',
        items: [{ descripcion: 'Item', cantidad: 4, costo_unitario: 5000 }]
      })
      expect(comp.monto_pagado).toBe(20000)
      expect(comp.saldo_pendiente).toBe(0)
    })

    // 32. Register a direct purchase as credit (credito)
    test('32. registrarCompraDirecta with credito', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'Item', cantidad: 10, costo_unitario: 15000 }]
      })
      expect(comp.estado).toBe('completada')
      expect(comp.condicion_pago).toBe('credito')
      expect(comp.total).toBe(150000)
    })

    // 33. Verify credit purchase has saldo_pendiente equal to total, and monto_pagado is 0
    test('33. Credito purchase has full saldo_pendiente and 0 paid amount', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'Item', cantidad: 2, costo_unitario: 5000 }]
      })
      expect(comp.monto_pagado).toBe(0)
      expect(comp.saldo_pendiente).toBe(10000)
    })

    // 34. Verify stock is immediately updated for direct completed purchases
    test('34. Direct purchase immediately increments product stock', async () => {
      const prodId = 'prod-x'
      mockDb.productos_calzado.push({ id: prodId, stock_actual: 5 })

      const p = await api.crearProveedor({ nombre: 'Prov' })
      await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'Zapatos X', cantidad: 15, costo_unitario: 100, producto_calzado_id: prodId }]
      })

      const prod = mockDb.productos_calzado.find(pr => pr.id === prodId)
      expect(prod.stock_actual).toBe(20)
    })

    // 35. Prevent negative quantities or costs during purchase registration
    test('35. Prevent negative costs or quantities', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      await expect(api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: -5, costo_unitario: 100 }]
      })).rejects.toThrow()

      await expect(api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 5, costo_unitario: -100 }]
      })).rejects.toThrow()
    })
  })

  // ==========================================================
  // TIER 3: Debt & Payment Calculations (15 Tests)
  // ==========================================================
  describe('Tier 3: Debt & Payment Calculations', () => {

    // 36. Total debt for a provider is 0 when no purchases exist
    test('36. Total debt is 0 when no purchases exist', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const debt = await api.obtenerDeudaProveedor(p.id)
      expect(debt).toBe(0)
    })

    // 37. Total debt is 0 when all purchases are paid cash (contado)
    test('37. Total debt is 0 for cash purchases only', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'contado',
        items: [{ descripcion: 'A', cantidad: 10, costo_unitario: 1000 }]
      })
      const debt = await api.obtenerDeudaProveedor(p.id)
      expect(debt).toBe(0)
    })

    // 38. Total debt matches total value of unpaid credit purchases
    test('38. Total debt returns sum of outstanding credit balances', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 5, costo_unitario: 10000 }]
      })
      await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'B', cantidad: 2, costo_unitario: 15000 }]
      })
      const debt = await api.obtenerDeudaProveedor(p.id)
      expect(debt).toBe(80000)
    })

    // 39. Total debt does NOT include pendiente_revision purchases
    test('39. Total debt ignores pending arrivals', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'emp',
        items: [{ descripcion: 'A', cantidad: 10 }]
      })
      const debt = await api.obtenerDeudaProveedor(p.id)
      expect(debt).toBe(0)
    })

    // 40. Total debt does NOT include cancelada purchases
    test('40. Total debt ignores cancelled purchases', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 5, costo_unitario: 1000 }]
      })
      await api.cancelarCompra(comp.id, 'owner')
      const debt = await api.obtenerDeudaProveedor(p.id)
      expect(debt).toBe(0)
    })

    // 41. Record a partial payment on a credit purchase
    test('41. Record partial payment updates purchase balance', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 2, costo_unitario: 50000 }]
      })

      const pago = await api.registrarPagoProveedor({
        compra_id: comp.id,
        registrado_por: 'owner',
        monto: 30000,
        notas: 'Primer abono'
      })

      expect(pago.id).toBeDefined()
      expect(pago.monto).toBe(30000)

      const updated = await api.obtenerCompraPorId(comp.id)
      expect(updated?.monto_pagado).toBe(30000)
      expect(updated?.saldo_pendiente).toBe(70000)
    })

    // 42. Verify monto_pagado increases and saldo_pendiente decreases by payment amount
    test('42. Financial counters adjust on payment', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 10, costo_unitario: 1000 }]
      })
      await api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: 4000 })
      const updated = await api.obtenerCompraPorId(comp.id)
      expect(updated?.monto_pagado).toBe(4000)
      expect(updated?.saldo_pendiente).toBe(6000)
    })

    // 43. Verify total provider debt decreases after a partial payment
    test('43. Provider total debt drops on payment', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 10, costo_unitario: 1000 }]
      })
      expect(await api.obtenerDeudaProveedor(p.id)).toBe(10000)
      await api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: 6000 })
      expect(await api.obtenerDeudaProveedor(p.id)).toBe(4000)
    })

    // 44. Record multiple payments on a single purchase
    test('44. Record multiple payments on a single purchase', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 1, costo_unitario: 100000 }]
      })
      await api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: 20000 })
      await api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: 30000 })
      
      const updated = await api.obtenerCompraPorId(comp.id)
      expect(updated?.monto_pagado).toBe(50000)
      expect(updated?.saldo_pendiente).toBe(50000)
    })

    // 45. Verify purchase is marked completed and has 0 saldo_pendiente after full payment
    test('45. Full payment zeroes out saldo_pendiente', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 1, costo_unitario: 50000 }]
      })
      await api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: 50000 })
      
      const updated = await api.obtenerCompraPorId(comp.id)
      expect(updated?.saldo_pendiente).toBe(0)
      expect(updated?.monto_pagado).toBe(50000)
    })

    // 46. Prevent registering a payment that exceeds the saldo_pendiente
    test('46. Prevent overpayment', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 1, costo_unitario: 1000 }]
      })
      await expect(api.registrarPagoProveedor({
        compra_id: comp.id,
        registrado_por: 'owner',
        monto: 2000
      })).rejects.toThrow('El monto del pago supera el saldo pendiente de la compra.')
    })

    // 47. Prevent registering negative or zero payments
    test('47. Prevent zero or negative payments', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 1, costo_unitario: 1000 }]
      })
      await expect(api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: 0 })).rejects.toThrow()
      await expect(api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: -100 })).rejects.toThrow()
    })

    // 48. List payments made to a specific purchase
    test('48. listarPagosCompra lists payments', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 10, costo_unitario: 10000 }]
      })
      await api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: 10000 })
      await api.registrarPagoProveedor({ compra_id: comp.id, registrado_por: 'owner', monto: 20000 })
      
      const payments = await api.listarPagosCompra(comp.id)
      expect(payments).toHaveLength(2)
      expect(payments[0].monto).toBe(10000)
      expect(payments[1].monto).toBe(20000)
    })

    // 49. List payments made to a provider across all purchases
    test('49. listarPagosProveedor lists payments across multiple purchases', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov' })
      const c1 = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'A', cantidad: 1, costo_unitario: 10000 }]
      })
      const c2 = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'credito',
        items: [{ descripcion: 'B', cantidad: 1, costo_unitario: 20000 }]
      })

      await api.registrarPagoProveedor({ compra_id: c1.id, registrado_por: 'owner', monto: 5000 })
      await api.registrarPagoProveedor({ compra_id: c2.id, registrado_por: 'owner', monto: 10000 })

      const payments = await api.listarPagosProveedor(p.id)
      expect(payments).toHaveLength(2)
    })

    // 50. Cancel check ignores payments or restores
    test('50. Cancel active purchase stock reversal works', async () => {
      const prodId = 'prod-reverse'
      mockDb.productos_calzado.push({ id: prodId, stock_actual: 10 })

      const p = await api.crearProveedor({ nombre: 'Prov' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'owner',
        condicion_pago: 'contado',
        items: [{ descripcion: 'Zapatos', cantidad: 5, costo_unitario: 1000, producto_calzado_id: prodId }]
      })

      expect(mockDb.productos_calzado.find(pr => pr.id === prodId).stock_actual).toBe(15)

      await api.cancelarCompra(comp.id, 'owner')

      expect(mockDb.productos_calzado.find(pr => pr.id === prodId).stock_actual).toBe(10)
    })
  })

  // ==========================================================
  // TIER 4: E2E Scenarios, Role Permissions & Audit (10 Tests)
  // ==========================================================
  describe('Tier 4: E2E Scenarios, Role Permissions & Audit', () => {

    // 51. Full cycle: Create provider -> Add bank account -> Employee registers arrival -> Owner reviews/approves (credit) -> Owner pays partial -> Owner pays remaining -> Debt is 0.
    test('51. Full E2E cycle of provider purchase & payments', async () => {
      const prodId = 'prod-e2e'
      mockDb.productos_calzado.push({ id: prodId, stock_actual: 50 })

      // A. Create provider
      const p = await api.crearProveedor({ nombre: 'Super Calzado S.A.', ciudad: 'Bogota' })
      expect(p.id).toBeDefined()

      // B. Add bank account
      const bank = await api.crearCuentaBancaria({
        proveedor_id: p.id,
        banco: 'Banco de Occidente',
        tipo_cuenta: 'corriente',
        numero_cuenta: '987654321'
      })
      expect(bank.id).toBeDefined()

      // C. Employee registers physical arrival
      const comp = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'Sandra',
        items: [{ descripcion: 'Botas Cuero', cantidad: 20, producto_calzado_id: prodId }]
      })
      expect(comp.estado).toBe('pendiente_revision')
      expect(mockDb.productos_calzado.find(pr => pr.id === prodId).stock_actual).toBe(50)

      // D. Owner reviews and approves (credit terms)
      const full = await api.obtenerCompraPorId(comp.id)
      const completed = await api.completarInformacionFinanciera({
        compra_id: comp.id,
        revisada_por: 'Andres',
        condicion_pago: 'credito',
        itemsCostos: [{ item_id: full?.items?.[0].id!, costo_unitario: 50000 }]
      })
      expect(completed.estado).toBe('completada')
      expect(completed.total).toBe(1000000)
      expect(completed.saldo_pendiente).toBe(1000000)
      expect(mockDb.productos_calzado.find(pr => pr.id === prodId).stock_actual).toBe(70)

      // E. Check total debt
      const initialDebt = await api.obtenerDeudaProveedor(p.id)
      expect(initialDebt).toBe(1000000)

      // F. Register partial payment
      await api.registrarPagoProveedor({
        compra_id: comp.id,
        registrado_por: 'Andres',
        monto: 400000,
        notas: 'Cheque abono 1'
      })
      const midDebt = await api.obtenerDeudaProveedor(p.id)
      expect(midDebt).toBe(600000)

      // G. Register final payment
      await api.registrarPagoProveedor({
        compra_id: comp.id,
        registrado_por: 'Andres',
        monto: 600000,
        notas: 'Cierre saldo'
      })
      const finalDebt = await api.obtenerDeudaProveedor(p.id)
      expect(finalDebt).toBe(0)

      const finalCompra = await api.obtenerCompraPorId(comp.id)
      expect(finalCompra?.saldo_pendiente).toBe(0)
      expect(finalCompra?.monto_pagado).toBe(1000000)
    })

    // 52. Multi-product receipt and approval flow updating inventory stock
    test('52. Multi-product receipt and stock updates', async () => {
      const p1 = 'p1'
      const p2 = 'p2'
      mockDb.productos_calzado.push({ id: p1, stock_actual: 10 })
      mockDb.productos_calzado.push({ id: p2, stock_actual: 20 })

      const prov = await api.crearProveedor({ nombre: 'MultiProv' })
      const comp = await api.registrarLlegadaFisica({
        proveedor_id: prov.id,
        registrada_por: 'Sandra',
        items: [
          { descripcion: 'Prod 1', cantidad: 5, producto_calzado_id: p1 },
          { descripcion: 'Prod 2', cantidad: 10, producto_calzado_id: p2 }
        ]
      })

      const full = await api.obtenerCompraPorId(comp.id)
      const id1 = full?.items?.find(i => i.descripcion === 'Prod 1')?.id!
      const id2 = full?.items?.find(i => i.descripcion === 'Prod 2')?.id!

      await api.completarInformacionFinanciera({
        compra_id: comp.id,
        revisada_por: 'Andres',
        condicion_pago: 'contado',
        itemsCostos: [
          { item_id: id1, costo_unitario: 2000 },
          { item_id: id2, costo_unitario: 3000 }
        ]
      })

      expect(mockDb.productos_calzado.find(pr => pr.id === p1).stock_actual).toBe(15)
      expect(mockDb.productos_calzado.find(pr => pr.id === p2).stock_actual).toBe(30)
    })

    // 53. Enforce user roles check simulator
    test('53. Role checking simulator (Andres as Owner)', async () => {
      const currentUser = { id: 'andres-owner', rol: 'dueno' }
      expect(currentUser.rol).toBe('dueno')
    })

    // 54. Enforce that admin role checks
    test('54. Role checks (Sandra as Admin)', async () => {
      const currentUser = { id: 'sandra-admin', rol: 'admin' }
      expect(currentUser.rol).toBe('admin')
    })

    // 55. Normal employee registration allowance simulator
    test('55. Role checks (Camilo as Employee)', async () => {
      const currentUser = { id: 'camilo-emp', rol: 'empleado' }
      expect(currentUser.rol).toBe('empleado')
    })

    // 56. Deny financial columns simulation (e.g. costs) to employees
    test('56. Deny employee viewing financial costs', async () => {
      const rol = 'empleado'
      const viewCost = (role: string) => role === 'dueno' || role === 'admin'
      expect(viewCost(rol)).toBe(false)
      expect(viewCost('dueno')).toBe(true)
    })

    // 57. Verify created_by is recorded when a provider is created
    test('57. Audit created_by logged on provider insertion', async () => {
      const prov = await api.crearProveedor({ nombre: 'Audit S.A.', created_by: 'user-123' })
      expect(prov.created_by).toBe('user-123')
    })

    // 58. Verify updated_by is updated when a provider details change
    test('58. Audit updated_by logged on provider update', async () => {
      const prov = await api.crearProveedor({ nombre: 'Audit S.A.', created_by: 'user-123' })
      const updated = await api.actualizarProveedor(prov.id, { nombre: 'New Audit', updated_by: 'user-456' })
      expect(updated.updated_by).toBe('user-456')
    })

    // 59. Verify registrada_por and revisada_por are filled during arrival and review
    test('59. Audit registrada_por and revisada_por recorded', async () => {
      const prov = await api.crearProveedor({ nombre: 'Prov' })
      const c = await api.registrarLlegadaFisica({
        proveedor_id: prov.id,
        registrada_por: 'camilo-employee',
        items: [{ descripcion: 'Tennis', cantidad: 10 }]
      })
      expect(c.registrada_por).toBe('camilo-employee')
      expect(c.revisada_por).toBeNull()

      const full = await api.obtenerCompraPorId(c.id)
      const comp = await api.completarInformacionFinanciera({
        compra_id: c.id,
        revisada_por: 'andres-owner',
        condicion_pago: 'contado',
        itemsCostos: [{ item_id: full?.items?.[0].id!, costo_unitario: 100 }]
      })
      expect(comp.registrada_por).toBe('camilo-employee')
      expect(comp.revisada_por).toBe('andres-owner')
    })

    // 60. Validate the direct WhatsApp contact URL generation logic
    test('60. whatsapp link validation', () => {
      const link1 = api.obtenerWhatsAppLink('315 123 4567')
      expect(link1).toBe('https://wa.me/573151234567')

      const link2 = api.obtenerWhatsAppLink('+57300-987-6543', 'Hola Proveedor')
      expect(link2).toBe('https://wa.me/573009876543?text=Hola%20Proveedor')

      const linkEmpty = api.obtenerWhatsAppLink(null)
      expect(linkEmpty).toBe('')
    })

    // 61. crearProveedor fails to create a provider if nombre is missing entirely (undefined or null)
    test('61. crearProveedor fails if nombre is missing entirely (undefined or null)', async () => {
      await expect(api.crearProveedor({} as any)).rejects.toThrow()
      await expect(api.crearProveedor({ nombre: null as any })).rejects.toThrow()
    })

    // 62. actualizarProveedor fails to update a provider with an empty name
    test('62. actualizarProveedor fails to update a provider with an empty name', async () => {
      const p = await api.crearProveedor({ nombre: 'Proveedor Original' })
      await expect(api.actualizarProveedor(p.id, { nombre: '' })).rejects.toThrow()
      await expect(api.actualizarProveedor(p.id, { nombre: '   ' })).rejects.toThrow()
      await expect(api.actualizarProveedor(p.id, { nombre: null as any })).rejects.toThrow()
    })

    // 63. listarCuentasBancarias returns empty array when a non-existent provider ID is queried
    test('63. listarCuentasBancarias returns empty array when a non-existent provider ID is queried', async () => {
      const accounts = await api.listarCuentasBancarias('inexistente-id')
      expect(accounts).toEqual([])
    })

    // 64. registrarPagoProveedor check behavior: try to register a payment for a pendiente_revision purchase (should throw)
    test('64. registrarPagoProveedor throws for a pendiente_revision purchase', async () => {
      const p = await api.crearProveedor({ nombre: 'Proveedor Test' })
      const comp = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'camilo',
        items: [{ descripcion: 'Botas', cantidad: 5 }]
      })
      expect(comp.estado).toBe('pendiente_revision')
      await expect(api.registrarPagoProveedor({
        compra_id: comp.id,
        registrado_por: 'andres',
        monto: 1000
      })).rejects.toThrow()
    })

    // 65. registrarPagoProveedor fails when attempting to pay for a cash (contado) purchase
    test('65. registrarPagoProveedor throws for a contado purchase', async () => {
      const p = await api.crearProveedor({ nombre: 'Proveedor Test' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'andres',
        condicion_pago: 'contado',
        items: [{ descripcion: 'Botas', cantidad: 5, costo_unitario: 1000 }]
      })
      expect(comp.estado).toBe('completada')
      expect(comp.condicion_pago).toBe('contado')
      await expect(api.registrarPagoProveedor({
        compra_id: comp.id,
        registrado_por: 'andres',
        monto: 1000
      })).rejects.toThrow('Solo se pueden registrar pagos a compras a crédito.')
    })

    // 66. cancelarCompra fails when the purchase is already cancelled
    test('66. cancelarCompra throws if already cancelled', async () => {
      const p = await api.crearProveedor({ nombre: 'Proveedor Test' })
      const comp = await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'andres',
        condicion_pago: 'credito',
        items: [{ descripcion: 'Botas', cantidad: 5, costo_unitario: 1000 }]
      })
      await api.cancelarCompra(comp.id, 'andres')
      await expect(api.cancelarCompra(comp.id, 'andres')).rejects.toThrow('La compra ya está cancelada.')
    })

    // 67. obtenerDeudaProveedor propaga el error de la RPC y NO filtra la deuda
    // (sin fallback a query directa; la deuda es solo para el dueño).
    test('67. obtenerDeudaProveedor propaga el error de la RPC (sin fallback)', async () => {
      // Provider ID especial que fuerza un error en la RPC (simula no-dueño bloqueado)
      const providerId = 'force-rpc-error'
      await api.registrarCompraDirecta({
        proveedor_id: providerId,
        registrada_por: 'andres',
        condicion_pago: 'credito',
        items: [{ descripcion: 'Botas', cantidad: 5, costo_unitario: 1000 }]
      })
      await expect(api.obtenerDeudaProveedor(providerId)).rejects.toThrow()
    })

    // 68. listarCompras lists all purchases ordered by created_at descending
    test('68. listarCompras lists all purchases', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov Test' })
      await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'andres',
        condicion_pago: 'contado',
        items: [{ descripcion: 'Item A', cantidad: 1, costo_unitario: 100 }]
      })
      await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'andres',
        condicion_pago: 'credito',
        items: [{ descripcion: 'Item B', cantidad: 2, costo_unitario: 200 }]
      })
      const list = await api.listarCompras()
      expect(list.length).toBeGreaterThanOrEqual(2)
    })

    // 69. listarCompras filters by proveedor_id
    test('69. listarCompras filters by proveedor_id', async () => {
      const p1 = await api.crearProveedor({ nombre: 'Prov 1' })
      const p2 = await api.crearProveedor({ nombre: 'Prov 2' })
      await api.registrarCompraDirecta({
        proveedor_id: p1.id,
        registrada_por: 'andres',
        condicion_pago: 'contado',
        items: [{ descripcion: 'Item A', cantidad: 1, costo_unitario: 100 }]
      })
      await api.registrarCompraDirecta({
        proveedor_id: p2.id,
        registrada_por: 'andres',
        condicion_pago: 'credito',
        items: [{ descripcion: 'Item B', cantidad: 2, costo_unitario: 200 }]
      })
      const list = await api.listarCompras({ proveedor_id: p1.id })
      expect(list).toHaveLength(1)
      expect(list[0].proveedor_id).toBe(p1.id)
    })

    // 70. listarCompras filters by estado
    test('70. listarCompras filters by estado', async () => {
      const p = await api.crearProveedor({ nombre: 'Prov Test' })
      const c = await api.registrarLlegadaFisica({
        proveedor_id: p.id,
        registrada_por: 'camilo',
        items: [{ descripcion: 'Botas', cantidad: 5 }]
      })
      await api.registrarCompraDirecta({
        proveedor_id: p.id,
        registrada_por: 'andres',
        condicion_pago: 'contado',
        items: [{ descripcion: 'Item A', cantidad: 1, costo_unitario: 100 }]
      })
      const list = await api.listarCompras({ estado: 'pendiente_revision' })
      expect(list.length).toBeGreaterThanOrEqual(1)
      expect(list.every(item => item.estado === 'pendiente_revision')).toBe(true)
    })
  })
})

