import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'

interface CanvasTrailProps {
  className?: string
  /** Number of trail lines (default: 30) */
  trails?: number
  /** Color hue offset (default: 140 = green, matches primary) */
  hueOffset?: number
  /** Line opacity (0-1, default: 0.03) */
  opacity?: number
}

interface Node {
  x: number
  y: number
  vx: number
  vy: number
}

interface Line {
  spring: number
  friction: number
  nodes: Node[]
  update: () => void
  draw: (ctx: CanvasRenderingContext2D) => void
}

const CONFIG = {
  friction: 0.5,
  size: 50,
  dampening: 0.025,
  tension: 0.99,
}

/**
 * Interactive canvas trail effect that follows mouse/touch.
 * Creates smooth, colorful trailing lines.
 */
export function CanvasTrail({
  className,
  trails = 30,
  hueOffset = 140,
  opacity = 0.03,
}: CanvasTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const linesRef = useRef<Line[]>([])
  const posRef = useRef({ x: 0, y: 0 })
  const hueRef = useRef(hueOffset)
  const runningRef = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function createNode(): Node {
      return { x: 0, y: 0, vx: 0, vy: 0 }
    }

    function createLine(spring: number): Line {
      const nodes: Node[] = []
      for (let i = 0; i < CONFIG.size; i++) {
        const node = createNode()
        node.x = posRef.current.x
        node.y = posRef.current.y
        nodes.push(node)
      }

      const friction = CONFIG.friction + 0.01 * Math.random() - 0.005

      return {
        spring: spring + 0.1 * Math.random() - 0.05,
        friction,
        nodes,
        update() {
          let springForce = this.spring
          const firstNode = this.nodes[0]

          firstNode.vx += (posRef.current.x - firstNode.x) * springForce
          firstNode.vy += (posRef.current.y - firstNode.y) * springForce

          for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i]
            if (i > 0) {
              const prevNode = this.nodes[i - 1]
              node.vx += (prevNode.x - node.x) * springForce
              node.vy += (prevNode.y - node.y) * springForce
              node.vx += prevNode.vx * CONFIG.dampening
              node.vy += prevNode.vy * CONFIG.dampening
            }
            node.vx *= this.friction
            node.vy *= this.friction
            node.x += node.vx
            node.y += node.vy
            springForce *= CONFIG.tension
          }
        },
        draw(ctx: CanvasRenderingContext2D) {
          let x = this.nodes[0].x
          let y = this.nodes[0].y

          ctx.beginPath()
          ctx.moveTo(x, y)

          for (let i = 1; i < this.nodes.length - 2; i++) {
            const curr = this.nodes[i]
            const next = this.nodes[i + 1]
            x = 0.5 * (curr.x + next.x)
            y = 0.5 * (curr.y + next.y)
            ctx.quadraticCurveTo(curr.x, curr.y, x, y)
          }

          const lastTwo = this.nodes.length - 2
          const secondLast = this.nodes[lastTwo]
          const last = this.nodes[lastTwo + 1]
          ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y)
          ctx.stroke()
          ctx.closePath()
        },
      }
    }

    function initLines() {
      linesRef.current = []
      for (let i = 0; i < trails; i++) {
        linesRef.current.push(createLine(0.45 + (i / trails) * 0.025))
      }
    }

    function resizeCanvas() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function render() {
      if (!runningRef.current || !ctx || !canvas) return

      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'lighter'

      hueRef.current += 0.5
      ctx.strokeStyle = `hsla(${Math.round(hueRef.current) % 360}, 70%, 50%, ${opacity})`
      ctx.lineWidth = 8

      for (const line of linesRef.current) {
        line.update()
        line.draw(ctx)
      }

      animationRef.current = requestAnimationFrame(render)
    }

    function handleMove(e: MouseEvent | TouchEvent) {
      if ('touches' in e && e.touches.length > 0) {
        posRef.current.x = e.touches[0].clientX
        posRef.current.y = e.touches[0].clientY
      } else if ('clientX' in e) {
        posRef.current.x = e.clientX
        posRef.current.y = e.clientY
      }
    }

    function handleFirstInteraction(e: MouseEvent | TouchEvent) {
      document.removeEventListener('mousemove', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
      handleMove(e)
      initLines()
      render()
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('touchmove', handleMove)
    }

    resizeCanvas()
    document.addEventListener('mousemove', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)
    window.addEventListener('resize', resizeCanvas)

    return () => {
      runningRef.current = false
      cancelAnimationFrame(animationRef.current)
      document.removeEventListener('mousemove', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('touchmove', handleMove)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [trails, opacity])

  return (
    <canvas
      ref={canvasRef}
      className={cn('pointer-events-none fixed inset-0 z-0', className)}
      aria-hidden="true"
    />
  )
}
