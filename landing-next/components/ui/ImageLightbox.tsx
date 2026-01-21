'use client'

import { memo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ImageLightboxProps {
  isOpen: boolean
  imageSrc: string
  imageAlt: string
  onClose: () => void
}

const OVERLAY_TRANSITION = { duration: 0.2 }
const OVERLAY_INITIAL = { opacity: 0 }
const OVERLAY_ANIMATE = { opacity: 1 }
const IMAGE_INITIAL = { scale: 0.9, opacity: 0 }
const IMAGE_ANIMATE = { scale: 1, opacity: 1 }

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={OVERLAY_INITIAL}
          animate={OVERLAY_ANIMATE}
          exit={OVERLAY_INITIAL}
          transition={OVERLAY_TRANSITION}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={imageAlt}
        >
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="w-8 h-8" />
          </button>

          <motion.img
            initial={IMAGE_INITIAL}
            animate={IMAGE_ANIMATE}
            exit={IMAGE_INITIAL}
            transition={OVERLAY_TRANSITION}
            src={imageSrc}
            alt={imageAlt}
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg"
            onClick={handleImageClick}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
})
