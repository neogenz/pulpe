export function lockBodyScroll(): () => void {
  const { style } = document.body
  const scrollY = window.scrollY
  const previous = {
    position: style.position,
    top: style.top,
    left: style.left,
    right: style.right,
    width: style.width,
    overflow: style.overflow,
  }
  let unlocked = false

  style.position = 'fixed'
  style.top = `-${scrollY}px`
  style.left = '0'
  style.right = '0'
  style.width = '100%'
  style.overflow = 'hidden'

  return () => {
    if (unlocked) return
    unlocked = true
    style.position = previous.position
    style.top = previous.top
    style.left = previous.left
    style.right = previous.right
    style.width = previous.width
    style.overflow = previous.overflow
    window.scrollTo(0, scrollY)
  }
}
