import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lockBodyScroll } from './bodyScrollLock'

function restoreGlobal(
  name: 'window' | 'document',
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor)
  } else {
    delete (globalThis as Record<string, unknown>)[name]
  }
}

test('compensates a classic scrollbar while the body is locked', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const style = {
    position: '',
    top: '',
    left: '',
    right: '',
    width: '',
    overflow: '',
    paddingRight: '4px',
  }
  const scrollCalls: Array<[number, number]> = []

  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        scrollY: 120,
        innerWidth: 1024,
        getComputedStyle: () => ({ paddingRight: '4px' }),
        scrollTo: (x: number, y: number) => scrollCalls.push([x, y]),
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { style },
        documentElement: { clientWidth: 1009 },
      },
    })

    const unlock = lockBodyScroll()

    assert.equal(style.paddingRight, '19px')
    unlock()
    assert.equal(style.paddingRight, '4px')
    assert.deepEqual(scrollCalls, [[0, 120]])
  } finally {
    restoreGlobal('window', originalWindow)
    restoreGlobal('document', originalDocument)
  }
})
