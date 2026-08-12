'use client'

import {useThemeCtx} from '@/app/providers/ThemeContext'
import {useEffect, useRef} from 'react'
import * as THREE from 'three'

interface Props {
  style?: React.CSSProperties
}

export function DottedSurface({style}: Props) {
  const {isDark} = useThemeCtx()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const SEPARATION = 130
    const AMOUNTX = 46
    const AMOUNTY = 46

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000)
    camera.position.set(0, 355, 1220)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true})
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0)
    containerRef.current.appendChild(renderer.domElement)

    // Dot color: deep indigo on light, soft lavender on dark
    const [r, g, b] = isDark
      ? [0.65, 0.71, 0.99]  // #a5b4fc lavender
      : [0.25, 0.27, 0.75]  // deeper indigo, clearly visible on #EEEFF8

    const positions: number[] = []
    const colors: number[] = []
    const geometry = new THREE.BufferGeometry()

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        positions.push(
          ix * SEPARATION - (AMOUNTX * SEPARATION) / 2,
          0,
          iy * SEPARATION - (AMOUNTY * SEPARATION) / 2,
        )
        colors.push(r, g, b)
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      transparent: true,
      opacity: isDark ? 0.65 : 0.70,
      sizeAttenuation: true,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    let count = 0
    let animationId: number

    const animate = () => {
      animationId = requestAnimationFrame(animate)

      const posAttr = geometry.attributes.position
      const pos = posAttr.array as Float32Array

      let i = 0
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          pos[i * 3 + 1] =
            Math.sin((ix + count) * 0.3) * 30 +
            Math.sin((iy + count) * 0.5) * 30
          i++
        }
      }

      posAttr.needsUpdate = true
      renderer.render(scene, camera)
      count += 0.04
    }

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
      scene.traverse((obj) => {
        if (obj instanceof THREE.Points) {
          obj.geometry.dispose()
          ;(obj.material as THREE.Material).dispose()
        }
      })
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [isDark])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
