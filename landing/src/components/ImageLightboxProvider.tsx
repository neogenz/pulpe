import { useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ImageLightboxContext } from '../contexts/ImageLightboxContext'
import { ImageLightbox } from './ui/ImageLightbox'

interface ImageLightboxProviderProps {
  children: ReactNode
}

export function ImageLightboxProvider({ children }: ImageLightboxProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState('')
  const [imageAlt, setImageAlt] = useState('')

  const openLightbox = useCallback((src: string, alt: string) => {
    setImageSrc(src)
    setImageAlt(alt)
    setIsOpen(true)
  }, [])

  const closeLightbox = useCallback(() => {
    setIsOpen(false)
  }, [])

  const lightboxRoot = document.getElementById('lightbox-root')

  return (
    <ImageLightboxContext.Provider value={{ openLightbox, closeLightbox }}>
      {children}
      {lightboxRoot &&
        createPortal(
          <ImageLightbox
            isOpen={isOpen}
            imageSrc={imageSrc}
            imageAlt={imageAlt}
            onClose={closeLightbox}
          />,
          lightboxRoot
        )}
    </ImageLightboxContext.Provider>
  )
}
