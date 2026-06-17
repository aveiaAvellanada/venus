export function diasEsperadosMes(diasTrabajoSemana: number | null, anio: number, mes: number): number {
  const dts = diasTrabajoSemana ?? 6
  const diasDelMes = new Date(anio, mes, 0).getDate() // mes 1-12 → último día de ese mes
  return Math.round((dts * diasDelMes) / 7)
}

export function montoSugeridoPago(sueldoMensual: number, diasTrabajados: number, diasEsperados: number): number {
  if (diasEsperados <= 0) return Math.round(sueldoMensual)
  return Math.round((sueldoMensual * Math.min(diasTrabajados, diasEsperados)) / diasEsperados)
}
