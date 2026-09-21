/// <reference types="vite/client" />

import type { KeyHubApi } from '../../shared/types'

declare global {
  interface Window {
    keyHub: KeyHubApi
  }
}

export {}
