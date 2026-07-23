'use client'

import {
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ImageLightboxContext } from './ImageLightboxContext'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface ImageLightboxProviderProps {
  children: ReactNode
}

function subscribeToNothing() {
  return () => undefined
}

function getLightboxRoot() {
  return document.getElementById('lightbox-root')
}

export function ImageLightboxProvider({ children }: ImageLightboxProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  // Only access DOM after hydration (null on the server snapshot)
  const lightboxRoot = useSyncExternalStore(
    subscribeToNothing,
    getLightboxRoot,
    () => null
  )

  const openLightbox = useCallback((src: string, alt: string) => {
    setImageSrc(src)
    setImageAlt(alt)
    setIsOpen(true)
  }, [])

  const closeLightbox = useCallback(() => {
    setIsOpen(false)
  }, [])

  const contextValue = useMemo(
    () => ({ openLightbox, closeLightbox }),
    [openLightbox, closeLightbox]
  )

  return (
    <ImageLightboxContext.Provider value={contextValue}>
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
