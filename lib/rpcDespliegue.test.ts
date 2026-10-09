/**
 * La verificación de despliegue (supabase/tests/remoto/verificar_despliegue.sql)
 * comprueba que cada RPC que llama la app exista y sea ejecutable con sesión.
 * Si se agrega una RPC en la app y no en esa lista, el chequeo no la cubriría.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..')

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

it('verificar_despliegue.sql lista exactamente las RPC que usa la app', () => {
  const enApp = new Set<string>()
  for (const dir of ['lib', 'app', 'components', 'hooks']) {
    for (const f of archivos(join(RAIZ, dir))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\.rpc\(\s*'([a-z_]+)'/g)) enApp.add(m[1])
    }
  }

  const sql = readFileSync(join(RAIZ, 'supabase/tests/remoto/verificar_despliegue.sql'), 'utf8')
  const lista = /rpc_app text\[\] := array\[([^\]]+)\]/.exec(sql)
  expect(lista).not.toBeNull()
  const enSql = new Set([...lista![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))

  expect([...enSql].sort()).toEqual([...enApp].sort())
  expect(enApp.size).toBeGreaterThan(10)
})
