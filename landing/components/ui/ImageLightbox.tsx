'use client'

import { memo, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ImageLightboxProps {
  isOpen: boolean
  imageSrc: string
  imageAlt: string
  onClose: () => void
}

export const ImageLightbox = memo(function ImageLightbox({
  isOpen,
  imageSrc,
  imageAlt,
  onClose,
}: ImageLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<Element | null>(null)

  useEffect(() => {
    if (!isOpen) return

    previousActiveElement.current = document.activeElement
    closeButtonRef.current?.focus()
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, onClose])

  const handleImageClick = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    []
  )

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-200',
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={imageAlt}
      aria-hidden={!isOpen}
    >
      <button
        ref={closeButtonRef}
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
        aria-label="Fermer"
        tabIndex={isOpen ? 0 : -1}
      >
        <X className="w-8 h-8" />
      </button>

      {imageSrc && (
        <img
          src={imageSrc}
          alt={imageAlt}
          className={cn(
            'max-w-[95vw] max-h-[95vh] object-contain rounded-lg transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
          )}
          onClick={handleImageClick}
        />
      )}
    </div>
  )
})
