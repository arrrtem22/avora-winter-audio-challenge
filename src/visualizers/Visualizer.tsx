import { useRef, useEffect } from 'react'

export interface VisualizerProps {
  frequencyData: React.RefObject<Uint8Array>
  timeDomainData: React.RefObject<Uint8Array>
  isActive: boolean
  width: number
  height: number
}

// 3D Math Helpers
type Point3D = { x: number; y: number; z: number }
type Point2D = { x: number; y: number }

/**
 * Avora Audio Challenge - 3D Circular Spectrum
 * 
 * Implements a true 3D projection of frequency bars arranged in a circle.
 * - Maps frequency energy to bar height.
 * - Uses a perspective projection to render the 3D scene onto the 2D canvas.
 * - Sorts objects by depth (Painter's Algorithm) for correct occlusion.
 * - Uses simple flat shading for a clean, retro-futuristic look.
 */
export function Visualizer({
  frequencyData,
  timeDomainData,
  isActive,
  width,
  height,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Configuration
  const BAR_COUNT = 64
  const smoothedValues = useRef<number[]>(new Array(BAR_COUNT).fill(0))
  const rotationRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frameId: number

    // 3D Scene Config
    const VIEW_DISTANCE = 800
    const CAMERA_PITCH = 0.6 // Radians, tilt down
    const BASE_RADIUS = 150
    const BAR_WIDTH = 8
    const BAR_DEPTH = 8
    const MAX_BAR_HEIGHT = 200

    // Precompute basic colors
    const COLOR_BASE = { r: 130, g: 130, b: 240 } // Periwinkle
    const COLOR_TOP = `rgb(${COLOR_BASE.r + 20}, ${COLOR_BASE.g + 20}, ${COLOR_BASE.b + 15})`
    const COLOR_SIDE_1 = `rgb(${COLOR_BASE.r}, ${COLOR_BASE.g}, ${COLOR_BASE.b})`
    const COLOR_SIDE_2 = `rgb(${COLOR_BASE.r - 40}, ${COLOR_BASE.g - 40}, ${COLOR_BASE.b - 20})`

    /**
     * Projects a 3D point to 2D screen space
     */
    const project = (x: number, y: number, z: number): Point2D => {
      // 1. Camera Rotation (Pitch around X axis)
      // y' = y*cos(theta) - z*sin(theta)
      // z' = y*sin(theta) + z*cos(theta)
      const cosP = Math.cos(CAMERA_PITCH)
      const sinP = Math.sin(CAMERA_PITCH)
      
      const rx = x
      const ry = y * cosP - z * sinP
      const rz = y * sinP + z * cosP

      // 2. Perspective Projection
      // screenX = rx * (scale / (rz + distance))
      // We assume camera is at z = -distance (or we move world by +distance)
      // Standard: x' = x * (d / z)
      
      const depth = rz + VIEW_DISTANCE
      const scale = 500 // Field of View scalar
      
      if (depth <= 0) return { x: 0, y: 0 } // Behind camera clipping (simplified)

      const screenX = width / 2 + (rx * scale) / depth
      const screenY = height / 2 + (ry * scale) / depth

      return { x: screenX, y: screenY }
    }

    const draw = () => {
      // Setup
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, width, height)
      
      const fData = frequencyData.current
      const tData = timeDomainData.current // Not used heavily, but available
      const hasData = isActive && fData && fData.length > 0
      
      // Update Rotation
      rotationRef.current += 0.005

      // Process Audio Data
      for (let i = 0; i < BAR_COUNT; i++) {
        let target = 5 // Minimum height
        if (hasData) {
          // Logarithmic binning for better distribution
          // Map 0..1 (index) to 0..1 (log scale)
          // We focus on the lower-mid spectrum where the energy is
          const percent = i / BAR_COUNT
          // Use a quadratic curve to pick frequency bins: index = percent^2 * totalBins
          // This allocates more bars to low frequencies
          const rawIndex = Math.floor(Math.pow(percent, 1.5) * (fData.length * 0.6))
          const val = fData[rawIndex] || 0
          
          target = (val / 255) * MAX_BAR_HEIGHT
          if (target < 5) target = 5
        }
        
        // Smoothing
        smoothedValues.current[i] += (target - smoothedValues.current[i]) * 0.2
      }

      // Generate Geometry
      const bars = []

      for (let i = 0; i < BAR_COUNT; i++) {
        // Calculate position on the ring
        const angleStep = (Math.PI * 2) / BAR_COUNT
        // We want the spectrum to wrap smoothly or mirror. 
        // Let's do a mirror for symmetry: High at back (0), Low at front (PI)? 
        // Or simple linear wrap. The image shows a peak on the right.
        // Let's stick to linear wrap 0 -> 2PI.
        
        const theta = i * angleStep + rotationRef.current
        
        // World Coordinates (Center of the base of the bar)
        // Y is Up (-Y is down in 3D usually, but here Y+ is Up for our logic)
        // Let's say Ground is Y=0. Bar goes from 0 to Height.
        const wx = Math.cos(theta) * BASE_RADIUS
        const wz = Math.sin(theta) * BASE_RADIUS
        const wy = 0
        
        const h = smoothedValues.current[i]
        
        // Calculate distance to camera for sorting
        // Camera is at (0, high, -dist). 
        // Simple depth sort: just use Z coordinate after rotation (rz).
        // But since we sort before projection, we can approximate with rotated Z.
        // Rotated Z (rz) = y*sinP + z*cosP. Since y=0 mostly, it's z*cosP.
        // So sorting by wz is roughly correct, but technically we should sort by distance to camera.
        // Camera pos approx: (0, 300, -800)
        const distSq = (wx * wx) + (wz + VIEW_DISTANCE)**2 // Ignore Y for sort speed
        
        bars.push({
          index: i,
          h,
          wx,
          wz,
          theta, // Rotation of the bar itself
          distSq
        })
      }

      // Sort: Farthest first (Painter's Algorithm)
      bars.sort((a, b) => b.distSq - a.distSq)

      // Draw Bars
      bars.forEach(bar => {
        const { wx, wz, h, theta } = bar
        
        // Define local cube vertices (relative to bar center)
        // We need to rotate these vertices by 'theta' to align with the ring tangent/normal
        // Tangent alignment: Width along tangent, Depth along radius
        
        const hw = BAR_WIDTH / 2
        const hd = BAR_DEPTH / 2
        
        // 8 Corners of the bar (Base and Top)
        // Local unrotated coords:
        // FL (Front-Left), FR, BL, BR...
        // Actually, let's just rotate the 4 corners of the footprint
        const corners = [
          { x: -hw, z: -hd }, // FL
          { x: hw, z: -hd },  // FR
          { x: hw, z: hd },   // BR
          { x: -hw, z: hd },  // BL
        ]
        
        // Rotate corners by theta around Y axis
        // x' = x*cos(t) - z*sin(t)
        // z' = x*sin(t) + z*cos(t)
        const cosT = Math.cos(-theta) // Negative theta to face outward?
        const sinT = Math.sin(-theta)
        
        const worldCorners = corners.map(p => ({
          x: wx + (p.x * cosT - p.z * sinT),
          y: 0,
          z: wz + (p.x * sinT + p.z * cosT)
        }))
        
        // Base vertices (y=0)
        // Top vertices (y=h)
        // We assume Y is UP in 3D world.
        // Note: In Canvas Y is down. project() handles 3D->2D mapping.
        // Let's assume our 3D world Y+ is UP.
        
        const baseProjected = worldCorners.map(p => project(p.x, -p.y, p.z)) // Invert Y for canvas
        const topProjected = worldCorners.map(p => project(p.x, -(p.y + h), p.z))
        
        // Draw Faces
        // A bar is a convex hull. We only need to draw the faces.
        // Order: We should draw Back faces first? 
        // Since we are sorting bars, we just need to draw the visible faces of THIS bar correctly.
        // Since we are looking from above (Pitch > 0), the TOP face is always visible.
        // The side faces depend on rotation.
        
        // Helper to draw quad
        const drawQuad = (p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D, color: string) => {
          ctx.fillStyle = color
          ctx.strokeStyle = color
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.lineTo(p3.x, p3.y)
          ctx.lineTo(p4.x, p4.y)
          ctx.closePath()
          ctx.fill()
          ctx.stroke() // Mitigate anti-aliasing gaps
        }

        // We can simply draw all side faces then the top, relying on self-occlusion?
        // No, we must only draw visible faces or draw back-to-front.
        // For a vertical prism viewed from top-side:
        // Top is always visible.
        // Bottom is never visible.
        // Sides: Calculate normal or just draw all side faces?
        // Since it's convex, drawing back faces then front faces works.
        // But easier: check "winding order" or normal z.
        
        // Let's just calculate which sides are facing the camera.
        // Camera is at (0, Y, -Z).
        // Vector from Center to Camera.
        // Actually, simplest is to draw the "Inner" faces first, then "Outer"?
        // No, standard is: Draw Side Faces, then Top Face.
        // The Top Face always covers the inside of the prism.
        
        // Draw 4 Side Walls
        // We need to know which walls are behind.
        // Simple Hack: Draw all 4 walls, but dark ones first?
        // Better: Compute normals.
        // Or even simpler: Just draw them. The "Top" cap will cover the mess inside.
        // But the walls might overlap each other (e.g. front wall covers back wall).
        // So we MUST draw back walls first.
        // Which are back walls? The ones furthest from camera.
        
        // Get center of each wall
        const wallCenters = [0, 1, 2, 3].map(i => {
           const j = (i + 1) % 4
           const bx = (worldCorners[i].x + worldCorners[j].x) / 2
           const bz = (worldCorners[i].z + worldCorners[j].z) / 2
           // Distance to camera (approx)
           return { index: i, dist: (bx * bx) + (bz + VIEW_DISTANCE)**2 }
        })
        
        // Sort walls: Furthest first
        wallCenters.sort((a, b) => b.dist - a.dist)
        
        // Draw sorted walls
        wallCenters.forEach(({ index }) => {
           const next = (index + 1) % 4
           // Color logic: Shading based on index is easiest "fake" lighting
           // 0: Front/Left, 1: Front/Right, 2: Back/Right, 3: Back/Left (Relative to bar rotation)
           // Let's just alternate colors for definition
           const color = index % 2 === 0 ? COLOR_SIDE_1 : COLOR_SIDE_2
           
           drawQuad(
             baseProjected[index],
             baseProjected[next],
             topProjected[next],
             topProjected[index],
             color
           )
        })

        // Draw Top Cap
        drawQuad(
          topProjected[0],
          topProjected[1],
          topProjected[2],
          topProjected[3],
          COLOR_TOP
        )
      })

      // Text Overlay
      if (!isActive) {
        ctx.fillStyle = '#666'
        ctx.font = '12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('awaiting input...', width / 2, height - 40)
      }

      frameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isActive, frequencyData, timeDomainData, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  )
}
