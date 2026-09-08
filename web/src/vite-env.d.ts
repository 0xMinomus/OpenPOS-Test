/// <reference types="vite/client" />

interface Window {
  offline?: { isElectron: boolean; close: () => void }
}
