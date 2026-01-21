import ReactDOM from 'react-dom'

interface PreloadLCPImageProps {
  mobileSrc: string
  desktopSrc: string
}

export function PreloadLCPImage({ mobileSrc, desktopSrc }: PreloadLCPImageProps) {
  ReactDOM.preload(mobileSrc, {
    as: 'image',
    type: 'image/webp',
    fetchPriority: 'high',
  })
  ReactDOM.preload(desktopSrc, {
    as: 'image',
    type: 'image/webp',
    fetchPriority: 'high',
    media: '(min-width: 768px)',
  })

  return null
}
