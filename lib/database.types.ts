export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cierres_caja: {
        Row: {
          apertura_at: string | null
          cerrado_por: string | null
          cierre_at: string | null
          created_at: string
          diferencia: number | null
          diferencia_nota: string | null
          efectivo_contado: number | null
          estado: string
          fecha: string
          id: string
          modo: string
          total_daviplata: number
          total_efectivo: number
          total_general: number
          total_nequi: number
          total_ventas: number
          updated_at: string
        }
        Insert: {
          apertura_at?: string | null
          cerrado_por?: string | null
          cierre_at?: string | null
          created_at?: string
          diferencia?: number | null
          diferencia_nota?: string | null
          efectivo_contado?: number | null
          estado?: string
          fecha: string
          id?: string
          modo?: string
          total_daviplata?: number
          total_efectivo?: number
          total_general?: number
          total_nequi?: number
          total_ventas?: number
          updated_at?: string
        }
        Update: {
          apertura_at?: string | null
          cerrado_por?: string | null
          cierre_at?: string | null
          created_at?: string
          diferencia?: number | null
          diferencia_nota?: string | null
          efectivo_contado?: number | null
          estado?: string
          fecha?: string
          id?: string
          modo?: string
          total_daviplata?: number
          total_efectivo?: number
          total_general?: number
          total_nequi?: number
          total_ventas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cierres_caja_cerrado_por_fkey"
            columns: ["cerrado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clima_registro: {
        Row: {
          created_at: string
          descripcion: string | null
          fecha: string
          humedad: number | null
          id: string
          llovio: boolean | null
          precipitacion_mm: number | null
          temperatura_max: number | null
          temperatura_min: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          fecha: string
          humedad?: number | null
          id?: string
          llovio?: boolean | null
          precipitacion_mm?: number | null
          temperatura_max?: number | null
          temperatura_min?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          fecha?: string
          humedad?: number | null
          id?: string
          llovio?: boolean | null
          precipitacion_mm?: number | null
          temperatura_max?: number | null
          temperatura_min?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      compra_documentos: {
        Row: {
          compra_id: string | null
          created_at: string
          id: string
          nombre_archivo: string | null
          proveedor_id: string | null
          subido_por: string | null
          tipo: string
          url: string
        }
        Insert: {
          compra_id?: string | null
          created_at?: string
          id?: string
          nombre_archivo?: string | null
          proveedor_id?: string | null
          subido_por?: string | null
          tipo: string
          url: string
        }
        Update: {
          compra_id?: string | null
          created_at?: string
          id?: string
          nombre_archivo?: string | null
          proveedor_id?: string | null
          subido_por?: string | null
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "compra_documentos_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_documentos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_documentos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_items: {
        Row: {
          cantidad: number
          color: string | null
          compra_id: string
          costo_unitario: number | null
          created_at: string
          descripcion: string
          id: string
          producto_calzado_id: string | null
          referencia: string | null
          subtotal: number | null
          talla: string | null
          updated_at: string
        }
        Insert: {
          cantidad: number
          color?: string | null
          compra_id: string
          costo_unitario?: number | null
          created_at?: string
          descripcion: string
          id?: string
          producto_calzado_id?: string | null
          referencia?: string | null
          subtotal?: number | null
          talla?: string | null
          updated_at?: string
        }
        Update: {
          cantidad?: number
          color?: string | null
          compra_id?: string
          costo_unitario?: number | null
          created_at?: string
          descripcion?: string
          id?: string
          producto_calzado_id?: string | null
          referencia?: string | null
          subtotal?: number | null
          talla?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compra_items_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_items_producto_calzado_id_fkey"
            columns: ["producto_calzado_id"]
            isOneToOne: false
            referencedRelation: "productos_calzado"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          condicion_pago: string | null
          created_at: string
          estado: string
          fecha_vencimiento: string | null
          id: string
          monto_pagado: number
          notas: string | null
          proveedor_id: string
          registrada_por: string | null
          revisada_por: string | null
          saldo_pendiente: number
          total: number | null
          updated_at: string
        }
        Insert: {
          condicion_pago?: string | null
          created_at?: string
          estado?: string
          fecha_vencimiento?: string | null
          id?: string
          monto_pagado?: number
          notas?: string | null
          proveedor_id: string
          registrada_por?: string | null
          revisada_por?: string | null
          saldo_pendiente?: number
          total?: number | null
          updated_at?: string
        }
        Update: {
          condicion_pago?: string | null
          created_at?: string
          estado?: string
          fecha_vencimiento?: string | null
          id?: string
          monto_pagado?: number
          notas?: string | null
          proveedor_id?: string
          registrada_por?: string | null
          revisada_por?: string | null
          saldo_pendiente?: number
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_registrada_por_fkey"
            columns: ["registrada_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_revisada_por_fkey"
            columns: ["revisada_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_config: {
        Row: {
          activo: boolean
          created_at: string
          dias_trabajo_semana: number | null
          empleado_id: string
          fecha_inicio: string | null
          id: string
          sueldo_mensual: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          dias_trabajo_semana?: number | null
          empleado_id: string
          fecha_inicio?: string | null
          id?: string
          sueldo_mensual: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          dias_trabajo_semana?: number | null
          empleado_id?: string
          fecha_inicio?: string | null
          id?: string
          sueldo_mensual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_config_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_dias_trabajados: {
        Row: {
          automatico: boolean
          created_at: string
          empleado_id: string
          fecha: string
          id: string
          nota: string | null
          registrado_por: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          automatico?: boolean
          created_at?: string
          empleado_id: string
          fecha: string
          id?: string
          nota?: string | null
          registrado_por?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          automatico?: boolean
          created_at?: string
          empleado_id?: string
          fecha?: string
          id?: string
          nota?: string | null
          registrado_por?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_dias_trabajados_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_dias_trabajados_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_pagos: {
        Row: {
          created_at: string
          dias_trabajados: number | null
          empleado_id: string
          fecha_pago: string
          id: string
          monto: number
          nota: string | null
          periodo_fin: string | null
          periodo_inicio: string | null
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_trabajados?: number | null
          empleado_id: string
          fecha_pago: string
          id?: string
          monto: number
          nota?: string | null
          periodo_fin?: string | null
          periodo_inicio?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_trabajados?: number | null
          empleado_id?: string
          fecha_pago?: string
          id?: string
          monto?: number
          nota?: string | null
          periodo_fin?: string | null
          periodo_inicio?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_pagos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_pagos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_fijos: {
        Row: {
          activo: boolean
          alerta_dias_antes: number
          beneficiario: string | null
          created_at: string
          dia_pago: number | null
          id: string
          monto_aproximado: number
          nombre: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alerta_dias_antes?: number
          beneficiario?: string | null
          created_at?: string
          dia_pago?: number | null
          id?: string
          monto_aproximado: number
          nombre: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alerta_dias_antes?: number
          beneficiario?: string | null
          created_at?: string
          dia_pago?: number | null
          id?: string
          monto_aproximado?: number
          nombre?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gastos_fijos_pagos: {
        Row: {
          comprobante_url: string | null
          created_at: string
          fecha_pago: string
          gasto_fijo_id: string
          id: string
          monto_pagado: number
          periodo: string | null
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          comprobante_url?: string | null
          created_at?: string
          fecha_pago: string
          gasto_fijo_id: string
          id?: string
          monto_pagado: number
          periodo?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          comprobante_url?: string | null
          created_at?: string
          fecha_pago?: string
          gasto_fijo_id?: string
          id?: string
          monto_pagado?: number
          periodo?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_fijos_pagos_gasto_fijo_id_fkey"
            columns: ["gasto_fijo_id"]
            isOneToOne: false
            referencedRelation: "gastos_fijos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_fijos_pagos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_variables: {
        Row: {
          categoria: string
          comprobante_url: string | null
          created_at: string
          descripcion: string
          fecha: string
          id: string
          monto: number
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string
          comprobante_url?: string | null
          created_at?: string
          descripcion: string
          fecha?: string
          id?: string
          monto: number
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          comprobante_url?: string | null
          created_at?: string
          descripcion?: string
          fecha?: string
          id?: string
          monto?: number
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_variables_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_precios_calzado: {
        Row: {
          costo_compra: number | null
          created_at: string
          id: string
          motivo: string | null
          precio_venta: number | null
          producto_id: string
          registrado_por: string | null
        }
        Insert: {
          costo_compra?: number | null
          created_at?: string
          id?: string
          motivo?: string | null
          precio_venta?: number | null
          producto_id: string
          registrado_por?: string | null
        }
        Update: {
          costo_compra?: number | null
          created_at?: string
          id?: string
          motivo?: string | null
          precio_venta?: number | null
          producto_id?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_precios_calzado_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_calzado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_calzado_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_precios_varios: {
        Row: {
          costo_compra: number | null
          created_at: string
          id: string
          motivo: string | null
          precio_venta: number | null
          producto_id: string
          registrado_por: string | null
        }
        Insert: {
          costo_compra?: number | null
          created_at?: string
          id?: string
          motivo?: string | null
          precio_venta?: number | null
          producto_id: string
          registrado_por?: string | null
        }
        Update: {
          costo_compra?: number | null
          created_at?: string
          id?: string
          motivo?: string | null
          precio_venta?: number | null
          producto_id?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_precios_varios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_varios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_varios_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      metodos_pago_venta: {
        Row: {
          created_at: string
          es_anticipo: boolean
          id: string
          metodo: string
          monto: number
          venta_id: string
        }
        Insert: {
          created_at?: string
          es_anticipo?: boolean
          id?: string
          metodo: string
          monto: number
          venta_id: string
        }
        Update: {
          created_at?: string
          es_anticipo?: boolean
          id?: string
          metodo?: string
          monto?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metodos_pago_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_calzado: {
        Row: {
          activo: boolean
          categoria: string
          color: string | null
          created_at: string
          descripcion: string
          foto_url: string | null
          id: string
          precio_venta: number
          proveedor_id: string | null
          referencia: string | null
          stock_actual: number
          stock_minimo: number
          talla: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          color?: string | null
          created_at?: string
          descripcion: string
          foto_url?: string | null
          id?: string
          precio_venta: number
          proveedor_id?: string | null
          referencia?: string | null
          stock_actual?: number
          stock_minimo?: number
          talla?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          color?: string | null
          created_at?: string
          descripcion?: string
          foto_url?: string | null
          id?: string
          precio_venta?: number
          proveedor_id?: string | null
          referencia?: string | null
          stock_actual?: number
          stock_minimo?: number
          talla?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_calzado_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_varios: {
        Row: {
          activo: boolean
          created_at: string
          foto_url: string | null
          id: string
          nombre: string
          precio_venta: number
          stock_actual: number
          stock_minimo: number
          unidad_medida: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          nombre: string
          precio_venta: number
          stock_actual?: number
          stock_minimo?: number
          unidad_medida: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          nombre?: string
          precio_venta?: number
          stock_actual?: number
          stock_minimo?: number
          unidad_medida?: string
          updated_at?: string
        }
        Relationships: []
      }
      proveedor_cuentas_bancarias: {
        Row: {
          banco: string
          created_at: string
          id: string
          numero_cuenta: string
          proveedor_id: string
          tipo_cuenta: string
          titular: string | null
          updated_at: string
        }
        Insert: {
          banco: string
          created_at?: string
          id?: string
          numero_cuenta: string
          proveedor_id: string
          tipo_cuenta: string
          titular?: string | null
          updated_at?: string
        }
        Update: {
          banco?: string
          created_at?: string
          id?: string
          numero_cuenta?: string
          proveedor_id?: string
          tipo_cuenta?: string
          titular?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_cuentas_bancarias_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          ciudad: string | null
          created_at: string
          id: string
          nit_cedula: string | null
          nombre: string
          notas: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          ciudad?: string | null
          created_at?: string
          id?: string
          nit_cedula?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          ciudad?: string | null
          created_at?: string
          id?: string
          nit_cedula?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          nombre: string
          rol: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id: string
          nombre: string
          rol: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          rol?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      venta_items: {
        Row: {
          cantidad: number
          color: string | null
          created_at: string
          descripcion_snapshot: string
          id: string
          precio_unitario: number
          producto_calzado_id: string | null
          producto_varios_id: string | null
          subtotal: number
          talla: string | null
          tipo_producto: string
          venta_id: string
        }
        Insert: {
          cantidad: number
          color?: string | null
          created_at?: string
          descripcion_snapshot: string
          id?: string
          precio_unitario: number
          producto_calzado_id?: string | null
          producto_varios_id?: string | null
          subtotal: number
          talla?: string | null
          tipo_producto: string
          venta_id: string
        }
        Update: {
          cantidad?: number
          color?: string | null
          created_at?: string
          descripcion_snapshot?: string
          id?: string
          precio_unitario?: number
          producto_calzado_id?: string | null
          producto_varios_id?: string | null
          subtotal?: number
          talla?: string | null
          tipo_producto?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_items_producto_calzado_id_fkey"
            columns: ["producto_calzado_id"]
            isOneToOne: false
            referencedRelation: "productos_calzado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_producto_varios_id_fkey"
            columns: ["producto_varios_id"]
            isOneToOne: false
            referencedRelation: "productos_varios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          cambio: number
          cancelacion_motivo: string | null
          cliente_apellido: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          correccion_at: string | null
          correccion_motivo: string | null
          corregida: boolean
          corregida_por: string | null
          created_at: string
          efectivo_recibido: number | null
          estado: string
          id: string
          monto_pagado: number
          nota: string | null
          numero: number
          saldo_pendiente: number
          total: number
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cambio?: number
          cancelacion_motivo?: string | null
          cliente_apellido?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          correccion_at?: string | null
          correccion_motivo?: string | null
          corregida?: boolean
          corregida_por?: string | null
          created_at?: string
          efectivo_recibido?: number | null
          estado?: string
          id?: string
          monto_pagado?: number
          nota?: string | null
          numero?: never
          saldo_pendiente?: number
          total: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cambio?: number
          cancelacion_motivo?: string | null
          cliente_apellido?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          correccion_at?: string | null
          correccion_motivo?: string | null
          corregida?: boolean
          corregida_por?: string | null
          created_at?: string
          efectivo_recibido?: number | null
          estado?: string
          id?: string
          monto_pagado?: number
          nota?: string | null
          numero?: never
          saldo_pendiente?: number
          total?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_corregida_por_fkey"
            columns: ["corregida_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      registrar_venta: {
        Args: {
          p_cliente_apellido?: string
          p_cliente_nombre?: string
          p_cliente_telefono?: string
          p_efectivo_recibido?: number
          p_items: Json
          p_pagos: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
