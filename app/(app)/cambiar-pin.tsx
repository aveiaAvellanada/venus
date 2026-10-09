import { useRouter } from 'expo-router'
import { FormularioCambiarPin } from '../../components/FormularioCambiarPin'
import { useToast } from '../../components/ui'

export default function CambiarPin() {
  const router = useRouter()
  const { mostrar } = useToast()
  return (
    <FormularioCambiarPin
      onCancelar={() => router.back()}
      onListo={() => {
        mostrar('Tu PIN quedó cambiado.')
        router.back()
      }}
    />
  )
}
