"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

interface LegacyGeometryJson {
  metadata?: {
    formatVersion?: number
  }
  vertices: number[]
  faces: number[]
}

export interface EnclosureViewerProps {
  modelUrl?: string
  modelFile?: File | null
  modelKind?: EnclosureModelKind
  className?: string
  background?: string
  baseColor?: string
  accentColor?: string
  distinguishSide?: EnclosureDistinguishSide
  viewPreset?: EnclosureViewPreset
  showGrid?: boolean
  showAxes?: boolean
  wireframe?: boolean
  autoRotate?: boolean
  autoRotateSpeed?: number
  hiddenMeshIds?: string[]
  onMeshListChange?: (meshes: EnclosureMeshEntry[]) => void
}

export type EnclosureViewPreset = "isometric" | "front" | "back" | "left" | "right" | "top"
export type EnclosureModelKind = "legacy-json" | "glb" | "gltf" | "stp"

export interface EnclosureMeshEntry {
  id: string
  name: string
  triangleCount: number
  visible: boolean
}

export interface EnclosureCameraPreset {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

export type EnclosureDistinguishSide =
  | "none"
  | "left-right"
  | "front-back"
  | "top-bottom"
  | "left"
  | "right"
  | "front"
  | "back"
  | "top"
  | "bottom"

export interface EnclosureViewerHandle {
  resetView: () => void
  getCameraPreset: () => EnclosureCameraPreset | null
  applyCameraPreset: (preset: EnclosureCameraPreset) => void
}

interface OcctImportResult {
  success: boolean
  root?: OcctStepNode
  meshes?: OcctStepMesh[]
}

interface OcctStepNode {
  name?: string
  meshes?: number[]
  children?: OcctStepNode[]
}

interface OcctStepMesh {
  name?: string
  color?: [number, number, number]
  attributes?: {
    position?: {
      array?: number[]
    }
    normal?: {
      array?: number[]
    }
  }
  index?: {
    array?: number[]
  }
}

interface OcctModule {
  ReadStepFile: (content: Uint8Array, params: unknown) => OcctImportResult
}

let occtModulePromise: Promise<OcctModule> | null = null

async function loadOcctModule(): Promise<OcctModule> {
  if (!occtModulePromise) {
    occtModulePromise = (async () => {
      const moduleValue = (await import("occt-import-js")) as unknown as {
        default?: (options?: { locateFile?: (path: string) => string }) => Promise<OcctModule>
      }

      const createModule = moduleValue.default
      if (typeof createModule !== "function") {
        throw new Error("occt-import-js factory was not found")
      }

      return createModule({
        locateFile: (fileName: string) => `/api/threejs/occt/${encodeURIComponent(fileName)}`,
      })
    })()
  }

  return occtModulePromise
}

function parseLegacyGeometry(data: LegacyGeometryJson): THREE.BufferGeometry {
  const { vertices, faces } = data
  const triangleIndices: number[] = []

  let index = 0
  while (index < faces.length) {
    const type = faces[index++]

    const isQuad = (type & 1) !== 0
    const hasMaterial = (type & 2) !== 0
    const hasFaceUv = (type & 4) !== 0
    const hasFaceVertexUv = (type & 8) !== 0
    const hasFaceNormal = (type & 16) !== 0
    const hasFaceVertexNormal = (type & 32) !== 0
    const hasFaceColor = (type & 64) !== 0
    const hasFaceVertexColor = (type & 128) !== 0

    if (isQuad) {
      const a = faces[index++]
      const b = faces[index++]
      const c = faces[index++]
      const d = faces[index++]

      // Triangulate quad faces while preserving winding.
      triangleIndices.push(a, b, d)
      triangleIndices.push(b, c, d)
    } else {
      const a = faces[index++]
      const b = faces[index++]
      const c = faces[index++]
      triangleIndices.push(a, b, c)
    }

    if (hasMaterial) index += 1
    if (hasFaceUv) index += 1
    if (hasFaceVertexUv) index += isQuad ? 4 : 3
    if (hasFaceNormal) index += 1
    if (hasFaceVertexNormal) index += isQuad ? 4 : 3
    if (hasFaceColor) index += 1
    if (hasFaceVertexColor) index += isQuad ? 4 : 3
  }

  const positions = new Float32Array(triangleIndices.length * 3)
  for (let i = 0; i < triangleIndices.length; i += 1) {
    const vertexIndex = triangleIndices[i] * 3
    const targetIndex = i * 3
    positions[targetIndex] = vertices[vertexIndex]
    positions[targetIndex + 1] = vertices[vertexIndex + 1]
    positions[targetIndex + 2] = vertices[vertexIndex + 2]
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  return geometry
}

function applyViewPreset(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  radius: number,
  preset: EnclosureViewPreset,
) {
  if (preset === "front") {
    camera.position.set(0, radius * 0.2, radius)
  } else if (preset === "back") {
    camera.position.set(0, radius * 0.2, -radius)
  } else if (preset === "left") {
    camera.position.set(-radius, radius * 0.2, 0)
  } else if (preset === "right") {
    camera.position.set(radius, radius * 0.2, 0)
  } else if (preset === "top") {
    camera.position.set(0, radius, 0.01)
  } else {
    camera.position.set(radius * 0.9, radius * 0.65, radius * 0.9)
  }

  controls.target.set(0, 0, 0)
  controls.update()
}

function shouldAccentVertex(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  cz: number,
  side: EnclosureDistinguishSide,
): boolean {
  if (side === "left-right") return x < cx
  if (side === "front-back") return z >= cz
  if (side === "top-bottom") return y >= cy
  if (side === "left") return x < cx
  if (side === "right") return x >= cx
  if (side === "front") return z >= cz
  if (side === "back") return z < cz
  if (side === "top") return y >= cy
  if (side === "bottom") return y < cy
  return false
}

function applyVertexColorMode(
  geometry: THREE.BufferGeometry,
  baseColor: string,
  accentColor: string,
  distinguishSide: EnclosureDistinguishSide,
): boolean {
  if (distinguishSide === "none") {
    geometry.deleteAttribute("color")
    return false
  }

  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  const positions = geometry.getAttribute("position")
  if (!bbox || !positions) {
    geometry.deleteAttribute("color")
    return false
  }

  const cx = (bbox.min.x + bbox.max.x) / 2
  const cy = (bbox.min.y + bbox.max.y) / 2
  const cz = (bbox.min.z + bbox.max.z) / 2

  const base = new THREE.Color(baseColor)
  const accent = new THREE.Color(accentColor)
  const colors = new Float32Array(positions.count * 3)

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    const color = shouldAccentVertex(x, y, z, cx, cy, cz, distinguishSide) ? accent : base

    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  return true
}

function applyVertexColorModeWorld(
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  baseColor: string,
  accentColor: string,
  distinguishSide: EnclosureDistinguishSide,
  center: THREE.Vector3,
): boolean {
  if (distinguishSide === "none") {
    geometry.deleteAttribute("color")
    return false
  }

  const positions = geometry.getAttribute("position")
  if (!positions) {
    geometry.deleteAttribute("color")
    return false
  }

  const base = new THREE.Color(baseColor)
  const accent = new THREE.Color(accentColor)
  const colors = new Float32Array(positions.count * 3)
  const worldPosition = new THREE.Vector3()

  for (let i = 0; i < positions.count; i += 1) {
    worldPosition.set(positions.getX(i), positions.getY(i), positions.getZ(i)).applyMatrix4(worldMatrix)
    const color = shouldAccentVertex(
      worldPosition.x,
      worldPosition.y,
      worldPosition.z,
      center.x,
      center.y,
      center.z,
      distinguishSide,
    )
      ? accent
      : base

    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  return true
}

function applyMaterialOverrides(
  material: THREE.Material,
  options: {
    baseColor: string
    wireframe: boolean
    useVertexColors: boolean
  },
): THREE.Material {
  // Always start from controlled defaults instead of imported texture/material colors.
  const normalized = material as Partial<THREE.MeshStandardMaterial>
  const next = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.useVertexColors ? "#ffffff" : options.baseColor),
    wireframe: options.wireframe,
    vertexColors: options.useVertexColors,
    metalness: typeof normalized.metalness === "number" ? normalized.metalness : 0.22,
    roughness: typeof normalized.roughness === "number" ? normalized.roughness : 0.48,
    transparent: typeof normalized.transparent === "boolean" ? normalized.transparent : false,
    opacity: typeof normalized.opacity === "number" ? normalized.opacity : 1,
    side: typeof normalized.side === "number" ? normalized.side : THREE.FrontSide,
  })

  return next
}

function applyObjectVisuals(
  object: THREE.Object3D,
  options: {
    baseColor: string
    accentColor: string
    distinguishSide: EnclosureDistinguishSide
    wireframe: boolean
    center: THREE.Vector3
  },
) {
  object.updateWorldMatrix(true, true)

  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    const geometry = node.geometry
    if (!geometry) return

    const useVertexColors = applyVertexColorModeWorld(
      geometry,
      node.matrixWorld,
      options.baseColor,
      options.accentColor,
      options.distinguishSide,
      options.center,
    )

    if (Array.isArray(node.material)) {
      node.material = node.material.map((material) =>
        applyMaterialOverrides(material, {
          baseColor: options.baseColor,
          wireframe: options.wireframe,
          useVertexColors,
        }),
      )
    } else {
      node.material = applyMaterialOverrides(node.material, {
        baseColor: options.baseColor,
        wireframe: options.wireframe,
        useVertexColors,
      })
    }
  })
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      if (node.geometry) {
        node.geometry.dispose()
      }

      if (Array.isArray(node.material)) {
        node.material.forEach((material) => material.dispose())
      } else if (node.material) {
        node.material.dispose()
      }
    }
  })
}

function buildStepObject(result: OcctImportResult): THREE.Object3D {
  if (!result.success || !result.root || !Array.isArray(result.meshes) || result.meshes.length === 0) {
    throw new Error("STEP import did not produce any meshes")
  }

  const createdMeshes: Array<THREE.Mesh | null> = result.meshes.map((meshData) => {
    const positions = meshData.attributes?.position?.array
    if (!positions || positions.length === 0) {
      return null
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))

    const normals = meshData.attributes?.normal?.array
    if (normals && normals.length === positions.length) {
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))
    } else {
      geometry.computeVertexNormals()
    }

    const indices = meshData.index?.array
    if (indices && indices.length > 0) {
      geometry.setIndex(indices)
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#8b929b"),
      metalness: 0.2,
      roughness: 0.6,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = meshData.name ?? "STEP Part"
    return mesh
  })

  const buildNode = (node: OcctStepNode): THREE.Group => {
    const group = new THREE.Group()
    group.name = node.name ?? "STEP Node"

    for (const meshIndex of node.meshes ?? []) {
      const existing = createdMeshes[meshIndex]
      if (!existing) continue
      const clone = existing.clone()
      clone.geometry = existing.geometry.clone()
      if (Array.isArray(existing.material)) {
        clone.material = existing.material.map((material) => material.clone())
      } else {
        clone.material = existing.material.clone()
      }
      group.add(clone)
    }

    for (const child of node.children ?? []) {
      group.add(buildNode(child))
    }

    return group
  }

  return buildNode(result.root)
}

function collectMeshes(root: THREE.Object3D, hiddenMeshIds: Set<string>): EnclosureMeshEntry[] {
  const entries: EnclosureMeshEntry[] = []
  let meshCounter = 0

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    meshCounter += 1

    const geometry = node.geometry
    const triangleCount = geometry.index
      ? Math.floor(geometry.index.count / 3)
      : Math.floor(geometry.getAttribute("position").count / 3)

    const existingId = typeof node.userData.enclosureMeshId === "string" ? node.userData.enclosureMeshId : ""
    const nextId = existingId || `${node.name || "mesh"}-${meshCounter}`
    node.userData.enclosureMeshId = nextId
    node.visible = !hiddenMeshIds.has(nextId)

    entries.push({
      id: nextId,
      name: node.name || `Mesh ${meshCounter}`,
      triangleCount,
      visible: node.visible,
    })
  })

  return entries
}

export const EnclosureViewer = forwardRef<EnclosureViewerHandle, EnclosureViewerProps>(function EnclosureViewer(
  {
    modelUrl = "/api/threejs/enclosure",
    modelFile = null,
    modelKind = "legacy-json",
    className,
    background = "#f6f8fa",
    baseColor = "#8b929b",
    accentColor = "#3b82f6",
    distinguishSide = "none",
    viewPreset = "isometric",
    showGrid = true,
    showAxes = false,
    wireframe = false,
    autoRotate = true,
    autoRotateSpeed = 0.8,
    hiddenMeshIds = [],
    onMeshListChange,
  }: EnclosureViewerProps,
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resetViewRef = useRef<() => void>(() => undefined)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const loadedObjectRef = useRef<THREE.Object3D | null>(null)
  const hiddenMeshIdsRef = useRef<Set<string>>(new Set(hiddenMeshIds))

  useEffect(() => {
    hiddenMeshIdsRef.current = new Set(hiddenMeshIds)

    const loaded = loadedObjectRef.current
    if (!loaded) return

    const nextEntries = collectMeshes(loaded, hiddenMeshIdsRef.current)
    onMeshListChange?.(nextEntries)
  }, [hiddenMeshIds, onMeshListChange])

  useImperativeHandle(ref, () => ({
    resetView: () => {
      resetViewRef.current()
    },
    getCameraPreset: () => {
      const camera = cameraRef.current
      const controls = controlsRef.current
      if (!camera || !controls) return null

      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
        fov: camera.fov,
      }
    },
    applyCameraPreset: (preset: EnclosureCameraPreset) => {
      const camera = cameraRef.current
      const controls = controlsRef.current
      if (!camera || !controls) return

      camera.position.set(preset.position[0], preset.position[1], preset.position[2])
      camera.fov = preset.fov
      camera.updateProjectionMatrix()

      controls.target.set(preset.target[0], preset.target[1], preset.target[2])
      controls.update()
    },
  }))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(background)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000)
    camera.position.set(900, 520, 900)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.autoRotate = autoRotate
    controls.autoRotateSpeed = autoRotateSpeed
    controls.target.set(0, 300, 0)
    controlsRef.current = controls

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.72)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.75)
    keyLight.position.set(1200, 900, 950)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.38)
    fillLight.position.set(-800, 350, -650)
    scene.add(fillLight)

    const grid = new THREE.GridHelper(1400, 18, 0xd0d7de, 0xe5e7eb)
    ;(grid.material as THREE.Material).opacity = 0.4
    ;(grid.material as THREE.Material).transparent = true
    grid.position.y = -20
    if (showGrid) {
      scene.add(grid)
    }

    const axes = new THREE.AxesHelper(420)
    if (showAxes) {
      scene.add(axes)
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor),
      metalness: 0.22,
      roughness: 0.48,
      wireframe,
    })

    let disposed = false
    let frameId = 0
    let mesh: THREE.Mesh | null = null
    let loadedObject: THREE.Object3D | null = null

    async function loadModel() {
      try {
        setError(null)
        if (modelKind === "legacy-json") {
          const response = await fetch(modelUrl)
          if (!response.ok) {
            throw new Error(`Unable to load model (${response.status})`)
          }

          const raw = (await response.json()) as LegacyGeometryJson
          const geometry = parseLegacyGeometry(raw)
          const usesVertexColors = applyVertexColorMode(geometry, baseColor, accentColor, distinguishSide)
          material.vertexColors = usesVertexColors
          mesh = new THREE.Mesh(geometry, material)

          geometry.computeBoundingBox()
          const bbox = geometry.boundingBox
          if (bbox) {
            const center = new THREE.Vector3()
            bbox.getCenter(center)
            mesh.position.sub(center)

            const size = new THREE.Vector3()
            bbox.getSize(size)
            const maxSide = Math.max(size.x, size.y, size.z)
            const fitDistance = maxSide * 1.7
            applyViewPreset(camera, controls, fitDistance, viewPreset)

            resetViewRef.current = () => {
              applyViewPreset(camera, controls, fitDistance, "isometric")
            }
          }

          scene.add(mesh)
          onMeshListChange?.([
            {
              id: "legacy-mesh",
              name: "Legacy Enclosure",
              triangleCount: Math.floor(geometry.getAttribute("position").count / 3),
              visible: true,
            },
          ])
          return
        }

        if (modelKind === "stp") {
          let sourceBytes: Uint8Array
          if (modelFile) {
            sourceBytes = new Uint8Array(await modelFile.arrayBuffer())
          } else {
            const response = await fetch(modelUrl)
            if (!response.ok) {
              throw new Error(`Unable to load STEP model (${response.status})`)
            }
            sourceBytes = new Uint8Array(await response.arrayBuffer())
          }

          const occt = await loadOcctModule()
          const parsed = occt.ReadStepFile(sourceBytes, {
            linearUnit: "millimeter",
            linearDeflectionType: "bounding_box_ratio",
            linearDeflection: 0.001,
            angularDeflection: 0.5,
          })

          loadedObject = buildStepObject(parsed)
        } else {
          const gltfLoader = new GLTFLoader()
          const gltf = await gltfLoader.loadAsync(modelUrl)
          loadedObject = gltf.scene
        }

        loadedObjectRef.current = loadedObject

        const initialBounds = new THREE.Box3().setFromObject(loadedObject)
        const initialCenter = initialBounds.getCenter(new THREE.Vector3())
        loadedObject.position.sub(initialCenter)
        loadedObject.updateWorldMatrix(true, true)

        const centeredBounds = new THREE.Box3().setFromObject(loadedObject)
        const size = centeredBounds.getSize(new THREE.Vector3())
        const centeredScenePoint = centeredBounds.getCenter(new THREE.Vector3())

        applyObjectVisuals(loadedObject, {
          baseColor,
          accentColor,
          distinguishSide,
          wireframe,
          center: centeredScenePoint,
        })

        const maxSide = Math.max(size.x, size.y, size.z)
        const fitDistance = maxSide * 1.7
        applyViewPreset(camera, controls, fitDistance, viewPreset)
        resetViewRef.current = () => {
          applyViewPreset(camera, controls, fitDistance, "isometric")
        }

        const meshEntries = collectMeshes(loadedObject, hiddenMeshIdsRef.current)
        onMeshListChange?.(meshEntries)

        scene.add(loadedObject)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Failed to load enclosure model"
        setError(message)
        onMeshListChange?.([])
      }
    }

    function resize() {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width <= 0 || height <= 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const observer = new ResizeObserver(() => resize())
    observer.observe(container)
    resize()

    frameId = window.requestAnimationFrame(function animate() {
      if (disposed) return
      controls.update()
      renderer.render(scene, camera)
      frameId = window.requestAnimationFrame(animate)
    })

    void loadModel()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      observer.disconnect()

      if (mesh) {
        scene.remove(mesh)
        mesh.geometry.dispose()
      }

      if (loadedObject) {
        scene.remove(loadedObject)
        disposeObject(loadedObject)
      }

      loadedObjectRef.current = null
      cameraRef.current = null
      controlsRef.current = null
      onMeshListChange?.([])

      material.dispose()
      controls.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [
    accentColor,
    autoRotate,
    autoRotateSpeed,
    background,
    baseColor,
    distinguishSide,
    modelKind,
    modelFile,
    modelUrl,
    onMeshListChange,
    showAxes,
    showGrid,
    viewPreset,
    wireframe,
  ])

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full rounded-md border border-border" />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
})
