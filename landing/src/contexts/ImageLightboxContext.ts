import { createContext } from 'react'

interface ImageLightboxContextValue {
  openLightbox: (src: string, alt: string) => void
  closeLightbox: () => void
}

export const ImageLightboxContext = createContext<ImageLightboxContextValue | null>(null)
