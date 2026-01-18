import { useContext } from 'react'
import { ImageLightboxContext } from '../contexts/ImageLightboxContext'

export function useImageLightbox() {
  const context = useContext(ImageLightboxContext)

  if (!context) {
    throw new Error('useImageLightbox must be used within an ImageLightboxProvider')
  }

  return context
}
