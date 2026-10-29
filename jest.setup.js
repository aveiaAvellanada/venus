// Setup global de jest: matchers/mocks de Reanimated
require('react-native-reanimated').setUpTests()

// Almacenamiento del teléfono en memoria (el caché y las ventas sin conexión lo usan).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Red: con conexión salvo que la prueba diga otra cosa (global.__red).
jest.mock('expo-network', () => {
  const estado = () => global.__red ?? { isConnected: true, isInternetReachable: true }
  return {
    useNetworkState: () => estado(),
    getNetworkStateAsync: async () => estado(),
    addNetworkStateListener: () => ({ remove: () => {} }),
  }
})
