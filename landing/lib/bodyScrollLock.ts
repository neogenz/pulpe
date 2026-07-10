export function lockBodyScroll(): () => void {
  const { style } = document.body
  const scrollY = window.scrollY
  const scrollbarWidth = Math.max(
    0,
    window.innerWidth - document.documentElement.clientWidth
  )
  const bodyPaddingRight = Number.parseFloat(
    window.getComputedStyle(document.body).paddingRight
  ) || 0
  const previous = {
    position: style.position,
    top: style.top,
    left: style.left,
    right: style.right,
    width: style.width,
    overflow: style.overflow,
    paddingRight: style.paddingRight,
  }
  let unlocked = false

  style.position = 'fixed'
  style.top = `-${scrollY}px`
  style.left = '0'
  style.right = '0'
  style.width = '100%'
  style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`
  }

  return () => {
    if (unlocked) return
    unlocked = true
    style.position = previous.position
    style.top = previous.top
    style.left = previous.left
    style.right = previous.right
    style.width = previous.width
    style.overflow = previous.overflow
    style.paddingRight = previous.paddingRight
    window.scrollTo(0, scrollY)
  }
}
