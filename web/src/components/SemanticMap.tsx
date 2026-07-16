import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { DeckGL, type DeckGLRef } from '@deck.gl/react'
import {
  COORDINATE_SYSTEM,
  OrbitViewport,
  OrbitView,
  OrthographicViewport,
  OrthographicView,
  type PickingInfo,
} from '@deck.gl/core'
import { LineLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { SimpleMeshLayer } from '@deck.gl/mesh-layers'
import { SphereGeometry } from '@luma.gl/engine'
import { LocateFixed } from 'lucide-react'
import type { ClusterSummary, MapMode, ThesisPoint } from '../types'
import { clusterColorRgb } from '../lib/colors'

interface SemanticMapProps {
  points: ThesisPoint[]
  fitPoints?: ThesisPoint[]
  highlightedIds?: ReadonlySet<string> | null
  clusters: ClusterSummary[]
  mode: MapMode
  selectedId: string | null
  selectedClusterId?: number | null
  yearCutoff?: number | null
  onSelect: (point: ThesisPoint | null) => void
  onClusterSelect?: (clusterId: number | null) => void
  ariaLabel: string
}

interface GridLine {
  source: [number, number, number]
  target: [number, number, number]
}

interface CommunityRingSegment extends GridLine {
  clusterId: number
}

const ROTATION_ORBIT = -32
const ROTATION_X = 27
const COMMUNITY_Z_OFFSET = 0.16
const COMMUNITY_RING_RADIUS = 0.205
const COMMUNITY_RING_STEPS = 28
const THESIS_SPHERE_SCALE = 0.048
const THESIS_SPHERE = new SphereGeometry({ id: 'thesis-sphere', radius: 1, nlat: 8, nlong: 12 })
const COMMUNITY_SPHERE = new SphereGeometry({
  id: 'community-sphere',
  radius: 1,
  nlat: 14,
  nlong: 18,
})

type MapObject = ThesisPoint | ClusterSummary

interface MapSize {
  width: number
  height: number
}

interface MapBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

interface FitPadding {
  top: number
  right: number
  bottom: number
  left: number
}

interface CameraViewState {
  target?: [number, number] | [number, number, number]
  zoom?: number
  rotationOrbit?: number
  rotationX?: number
}

function isClusterSummary(object: MapObject): object is ClusterSummary {
  return 'centroid' in object && 'count' in object
}

function buildGrid(): GridLine[] {
  const lines: GridLine[] = []
  const minX = 3.6
  const maxX = 11.9
  const minY = 0.3
  const maxY = 8.5
  const floor = 0.55
  for (let x = 4; x <= 12; x += 1) {
    lines.push({ source: [x, minY, floor], target: [x, maxY, floor] })
  }
  for (let y = 1; y <= 8; y += 1) {
    lines.push({ source: [minX, y, floor], target: [maxX, y, floor] })
  }
  return lines
}

const GRID_LINES = buildGrid()

function communityPosition(cluster: ClusterSummary): [number, number, number] {
  return [cluster.centroid[0], cluster.centroid[1], cluster.centroid[2] + COMMUNITY_Z_OFFSET]
}

function buildCommunityRings(clusters: ClusterSummary[]): CommunityRingSegment[] {
  const segments: CommunityRingSegment[] = []
  for (const cluster of clusters) {
    const [centerX, centerY, centerZ] = communityPosition(cluster)
    const ringPoint = (plane: 0 | 1 | 2, angle: number): [number, number, number] => {
      const horizontal = Math.cos(angle) * COMMUNITY_RING_RADIUS
      const vertical = Math.sin(angle) * COMMUNITY_RING_RADIUS
      if (plane === 0) return [centerX + horizontal, centerY + vertical, centerZ]
      if (plane === 1) return [centerX + horizontal, centerY, centerZ + vertical]
      return [centerX, centerY + horizontal, centerZ + vertical]
    }

    for (const plane of [0, 1, 2] as const) {
      for (let step = 0; step < COMMUNITY_RING_STEPS; step += 1) {
        const startAngle = step / COMMUNITY_RING_STEPS * Math.PI * 2
        const endAngle = (step + 1) / COMMUNITY_RING_STEPS * Math.PI * 2
        segments.push({
          clusterId: cluster.id,
          source: ringPoint(plane, startAngle),
          target: ringPoint(plane, endAngle),
        })
      }
    }
  }
  return segments
}

function boundsForPoints(points: ThesisPoint[]): MapBounds {
  if (points.length === 0) {
    return { minX: 3.6, maxX: 11.9, minY: 0.3, maxY: 8.5, minZ: 0.55, maxZ: 6.3 }
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  const expand = (min: number, max: number, minimumSpan: number): [number, number] => {
    const missing = Math.max(0, minimumSpan - (max - min)) / 2
    return [min - missing, max + missing]
  }
  ;[minX, maxX] = expand(minX, maxX, 0.7)
  ;[minY, maxY] = expand(minY, maxY, 0.7)
  ;[minZ, maxZ] = expand(minZ, maxZ, 0.7)
  return { minX, maxX, minY, maxY, minZ, maxZ }
}

function boundsCorners(bounds: MapBounds, mode: MapMode): [number, number, number][] {
  const zValues = mode === '3d' ? [bounds.minZ, bounds.maxZ] : [0]
  return [bounds.minX, bounds.maxX].flatMap((x) =>
    [bounds.minY, bounds.maxY].flatMap((y) =>
      zValues.map((z) => [x, y, z] as [number, number, number]),
    ),
  )
}

function mapPadding(size: MapSize, timelineVisible: boolean): FitPadding {
  const compact = size.width < 640
  return {
    top: compact ? 78 : 70,
    right: compact ? 22 : 34,
    bottom: timelineVisible ? (compact ? 126 : 104) : compact ? 24 : 34,
    left: compact ? 22 : 34,
  }
}

function tooltipPositionStyle(
  x: number,
  y: number,
  size: MapSize,
  preferredWidth: number,
): Partial<CSSStyleDeclaration> {
  const openLeft = x > size.width / 2
  const openAbove = y > size.height / 2
  const horizontalRoom = openLeft ? x - 24 : size.width - x - 24
  const verticalRoom = openAbove ? y - 24 : size.height - y - 24
  const maxWidth = Math.min(preferredWidth, Math.max(64, horizontalRoom))
  const maxHeight = Math.max(48, verticalRoom)
  const offsetX = openLeft ? 'calc(-100% - 12px)' : '12px'
  const offsetY = openAbove ? 'calc(-100% - 12px)' : '12px'
  return {
    transform: `translate(${x}px, ${y}px) translate(${offsetX}, ${offsetY})`,
    maxWidth: `${maxWidth}px`,
    maxHeight: `${maxHeight}px`,
    overflowY: 'auto',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-line',
    boxSizing: 'border-box',
    zIndex: '30',
  }
}

function fitView(bounds: MapBounds, size: MapSize, mode: MapMode, timelineVisible: boolean) {
  const width = Math.max(1, size.width)
  const height = Math.max(1, size.height)
  const padding = mapPadding(size, timelineVisible)
  const target: [number, number, number] = [
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2,
    mode === '3d' ? (bounds.minZ + bounds.maxZ) / 2 : 0,
  ]
  const corners = boundsCorners(bounds, mode)

  const fits = (zoom: number) => {
    const viewport = mode === '2d'
      ? new OrthographicViewport({ width, height, target, zoom, flipY: false })
      : new OrbitViewport({
          width,
          height,
          target,
          zoom,
          orbitAxis: 'Z',
          rotationOrbit: ROTATION_ORBIT,
          rotationX: ROTATION_X,
        })
    return corners.every((corner) => {
      const [x, y] = viewport.project(corner)
      return Number.isFinite(x) && Number.isFinite(y)
        && x >= padding.left
        && x <= width - padding.right
        && y >= padding.top
        && y <= height - padding.bottom
    })
  }

  let low = -1
  let high = 10
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const candidate = (low + high) / 2
    if (fits(candidate)) low = candidate
    else high = candidate
  }

  const zoom = Math.max(-1, Math.min(9.2, low - 0.08))
  return { target, zoom, minZoom: Math.max(-2, zoom - 2.5), maxZoom: 10 }
}

export function SemanticMap({
  points,
  fitPoints = points,
  highlightedIds = null,
  clusters,
  mode,
  selectedId,
  selectedClusterId = null,
  yearCutoff = null,
  onSelect,
  onClusterSelect,
  ariaLabel,
}: SemanticMapProps) {
  const [resetVersion, setResetVersion] = useState(0)
  const mapRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<DeckGLRef>(null)
  const pointerStartRef = useRef<[number, number] | null>(null)
  const initialMeasureRef = useRef(false)
  const fitCacheRef = useRef<{ key: string; state: ReturnType<typeof fitView> } | null>(null)
  const [mapSize, setMapSize] = useState<MapSize>({ width: 960, height: 680 })
  const [fitSizeVersion, setFitSizeVersion] = useState(0)

  useLayoutEffect(() => {
    const element = mapRef.current
    if (!element) return
    const updateSize = () => {
      const bounds = element.getBoundingClientRect()
      setMapSize((current) => {
        const width = Math.round(bounds.width)
        const height = Math.round(bounds.height)
        return current.width === width && current.height === height ? current : { width, height }
      })
      if (!initialMeasureRef.current) {
        initialMeasureRef.current = true
        setFitSizeVersion(1)
      }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fitBounds = useMemo(() => boundsForPoints(fitPoints), [fitPoints])
  const timelineVisible = yearCutoff !== null
  const fitKey = [
    fitBounds.minX,
    fitBounds.maxX,
    fitBounds.minY,
    fitBounds.maxY,
    fitBounds.minZ,
    fitBounds.maxZ,
  ].map((value) => value.toFixed(6)).join('-')
  const fitRequestKey = `${mode}-${resetVersion}-${fitKey}-${timelineVisible ? 'timeline' : 'map'}-${fitSizeVersion}`
  if (fitCacheRef.current?.key !== fitRequestKey) {
    fitCacheRef.current = {
      key: fitRequestKey,
      state: fitView(fitBounds, mapSize, mode, timelineVisible),
    }
  }
  const fitState = fitCacheRef.current.state

  const visibleClusterIds = useMemo(() => new Set(points.map((point) => point.clusterId)), [points])
  const visibleClusters = useMemo(
    () => clusters.filter((cluster) => visibleClusterIds.has(cluster.id)),
    [clusters, visibleClusterIds],
  )
  const highlightedClusterIds = useMemo(() => {
    if (highlightedIds === null) return null
    return new Set(points.filter((point) => highlightedIds.has(point.id)).map((point) => point.clusterId))
  }, [highlightedIds, points])

  const layers = useMemo(() => {
    const gridLayer = new LineLayer<GridLine>({
      id: `atlas-grid-${mode}`,
      data: GRID_LINES,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getSourcePosition: (line) => mode === '3d' ? line.source : [line.source[0], line.source[1], -0.05],
      getTargetPosition: (line) => mode === '3d' ? line.target : [line.target[0], line.target[1], -0.05],
      getColor: mode === '3d' ? [60, 70, 66, 42] : [60, 70, 66, 24],
      getWidth: 1,
      widthUnits: 'pixels',
      pickable: false,
    })

    const pointColor = (point: ThesisPoint): [number, number, number, number] => {
        const selected = point.id === selectedId
        const clusterMuted = selectedClusterId !== null && point.clusterId !== selectedClusterId
        const searchMuted = highlightedIds !== null && !highlightedIds.has(point.id)
        const timelineAlpha = yearCutoff === null ? 220 : point.year === yearCutoff ? 255 : 112
        if (searchMuted && !selected) return [125, 136, 130, 34]
        const alpha = selected ? 255 : clusterMuted ? 34 : highlightedIds !== null ? 252 : timelineAlpha
        return selected ? [15, 20, 18, 255] : clusterColorRgb(point.clusterId, alpha)
    }

    const pointScale = (point: ThesisPoint) => {
      if (point.id === selectedId) return 1.9
      if (highlightedIds !== null && highlightedIds.has(point.id)) return 1.42
      if (yearCutoff !== null && point.year === yearCutoff) return 1.45
      return 1
    }

    const pointLayer = mode === '2d'
      ? new ScatterplotLayer<ThesisPoint>({
          id: `theses-2d-${yearCutoff ?? 'all'}`,
          data: points,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          getPosition: (point) => [point.x, point.y, 0],
          getFillColor: pointColor,
          getLineColor: (point) => {
            if (point.id === selectedId) return [250, 252, 246, 255]
            if (highlightedIds !== null && !highlightedIds.has(point.id)) return [210, 216, 211, 24]
            return [250, 252, 246, 150]
          },
          getRadius: (point) => {
            if (point.id === selectedId) return 9
            if (highlightedIds !== null && highlightedIds.has(point.id)) return 6.8
            if (yearCutoff !== null && point.year === yearCutoff) return 6.6
            return 4.6
          },
          radiusUnits: 'pixels',
          lineWidthUnits: 'pixels',
          getLineWidth: (point) => (point.id === selectedId ? 2.4 : 0.45),
          stroked: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [15, 20, 18, 70],
          updateTriggers: {
            getFillColor: [highlightedIds, selectedId, selectedClusterId, yearCutoff],
            getRadius: [highlightedIds, selectedId, yearCutoff],
            getLineColor: [highlightedIds, selectedId],
            getLineWidth: [selectedId],
          },
          transitions: {
            getRadius: 260,
          },
        })
      : new SimpleMeshLayer<ThesisPoint>({
          id: `thesis-spheres-${yearCutoff ?? 'all'}`,
          data: points,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          mesh: THESIS_SPHERE,
          sizeScale: THESIS_SPHERE_SCALE,
          getPosition: (point) => [point.x, point.y, point.z],
          getColor: pointColor,
          getScale: (point) => {
            const scale = pointScale(point)
            return [scale, scale, scale]
          },
          material: {
            ambient: 0.42,
            diffuse: 0.64,
            shininess: 48,
            specularColor: [220, 230, 224],
          },
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 90],
          updateTriggers: {
            getColor: [highlightedIds, selectedId, selectedClusterId, yearCutoff],
            getScale: [highlightedIds, selectedId, yearCutoff],
          },
          transitions: {
            getScale: 260,
          },
        })

    const communityRingLayer = mode === '3d'
      ? new LineLayer<CommunityRingSegment>({
          id: 'cluster-rings-3d',
          data: buildCommunityRings(visibleClusters),
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          getSourcePosition: (segment) => segment.source,
          getTargetPosition: (segment) => segment.target,
          getColor: (segment) => highlightedClusterIds !== null && !highlightedClusterIds.has(segment.clusterId)
            ? [126, 135, 130, 72]
            : clusterColorRgb(segment.clusterId, 245),
          getWidth: 1.4,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          pickable: false,
          updateTriggers: {
            getColor: [highlightedClusterIds],
          },
        })
      : null

    const centroidLayer = mode === '2d'
      ? new ScatterplotLayer<ClusterSummary>({
          id: 'cluster-centroids-2d',
          data: visibleClusters,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          getPosition: (cluster) => [cluster.centroid[0], cluster.centroid[1], 0],
          getFillColor: (cluster) => highlightedClusterIds !== null && !highlightedClusterIds.has(cluster.id)
            ? [234, 237, 232, 82]
            : [247, 248, 243, 220],
          getLineColor: (cluster) => highlightedClusterIds !== null && !highlightedClusterIds.has(cluster.id)
            ? [126, 135, 130, 72]
            : clusterColorRgb(cluster.id, 240),
          getRadius: 12,
          radiusUnits: 'pixels',
          lineWidthUnits: 'pixels',
          getLineWidth: 1.5,
          stroked: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 120],
          updateTriggers: {
            getFillColor: [highlightedClusterIds],
            getLineColor: [highlightedClusterIds],
          },
        })
      : new SimpleMeshLayer<ClusterSummary>({
          id: 'cluster-spheres-3d',
          data: visibleClusters,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          mesh: COMMUNITY_SPHERE,
          sizeScale: 0.17,
          getPosition: communityPosition,
          getColor: (cluster) => highlightedClusterIds !== null && !highlightedClusterIds.has(cluster.id)
            ? [234, 237, 232, 118]
            : [247, 248, 243, 255],
          material: {
            ambient: 0.68,
            diffuse: 0.48,
            shininess: 42,
            specularColor: [255, 255, 255],
          },
          pickable: true,
          updateTriggers: {
            getColor: [highlightedClusterIds],
          },
        })

    const labelLayer = new TextLayer<ClusterSummary>({
      id: `cluster-labels-${mode}`,
      data: visibleClusters,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPosition: (cluster) => [
        cluster.centroid[0],
        cluster.centroid[1],
        mode === '3d' ? cluster.centroid[2] + 0.18 : 0,
      ],
      getText: (cluster) => String(cluster.id).padStart(2, '0'),
      getColor: (cluster) => {
        const muted = highlightedClusterIds !== null && !highlightedClusterIds.has(cluster.id)
        if (mode === '3d') return muted ? [90, 100, 94, 96] : [17, 24, 21, 255]
        return muted ? [90, 100, 94, 96] : [17, 24, 21, 255]
      },
      getSize: 11,
      sizeUnits: 'pixels',
      fontFamily: 'Manrope Variable, sans-serif',
      fontWeight: 700,
      fontSettings: { sdf: true, fontSize: 64, buffer: 4 },
      outlineWidth: 0.8,
      outlineColor: [247, 248, 243, 245],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      billboard: true,
      pickable: true,
      parameters: { depthCompare: 'always' },
      updateTriggers: {
        getColor: [highlightedClusterIds, mode],
      },
    })

    return [gridLayer, pointLayer, communityRingLayer, centroidLayer, labelLayer]
  }, [highlightedClusterIds, highlightedIds, mode, points, selectedClusterId, selectedId, visibleClusters, yearCutoff])

  const view = useMemo(
    () => mode === '2d'
      ? new OrthographicView({ id: 'semantic-2d', controller: true, flipY: false })
      : new OrbitView({ id: 'semantic-3d', controller: true, orbitAxis: 'Z' }),
    [mode],
  )

  const initialViewState = useMemo(
    () => mode === '2d'
      ? fitState
      : {
          ...fitState,
          rotationOrbit: ROTATION_ORBIT,
          rotationX: ROTATION_X,
          minRotationX: -70,
          maxRotationX: 70,
        },
    [fitState, mode],
  )

  function handleClick(info: PickingInfo<MapObject>) {
    if (!info.object) {
      onSelect(null)
      if (selectedClusterId !== null) onClusterSelect?.(null)
      return
    }
    if (isClusterSummary(info.object)) {
      onClusterSelect?.(info.object.id)
      return
    }
    onSelect(info.object)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLCanvasElement) {
      pointerStartRef.current = [event.clientX, event.clientY]
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (selectedClusterId === null || !start || !(event.target instanceof HTMLCanvasElement)) return
    if (Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) return
    const bounds = mapRef.current?.getBoundingClientRect()
    if (!bounds) return
    void deckRef.current?.pickObjectAsync({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      radius: 2,
    }).then((info) => {
      if (info?.object) return
      onSelect(null)
      onClusterSelect?.(null)
    })
  }

  function recordCameraState(viewState: CameraViewState) {
    const element = mapRef.current
    if (!element || !viewState.target || typeof viewState.zoom !== 'number') return
    element.dataset.cameraZoom = viewState.zoom.toFixed(4)
    element.dataset.cameraTargetX = viewState.target[0].toFixed(4)
    element.dataset.cameraTargetY = viewState.target[1].toFixed(4)
    element.dataset.cameraTargetZ = (viewState.target[2] ?? 0).toFixed(4)
    if (typeof viewState.rotationOrbit === 'number') {
      element.dataset.cameraRotationOrbit = viewState.rotationOrbit.toFixed(4)
    }
    if (typeof viewState.rotationX === 'number') {
      element.dataset.cameraRotationX = viewState.rotationX.toFixed(4)
    }
  }

  return (
    <div
      ref={mapRef}
      className="semantic-map"
      role="img"
      aria-label={ariaLabel}
      data-fit-zoom={fitState.zoom.toFixed(4)}
      data-fit-target-x={fitState.target[0].toFixed(4)}
      data-fit-target-y={fitState.target[1].toFixed(4)}
      data-camera-zoom={fitState.zoom.toFixed(4)}
      data-camera-target-x={fitState.target[0].toFixed(4)}
      data-camera-target-y={fitState.target[1].toFixed(4)}
      data-camera-target-z={fitState.target[2].toFixed(4)}
      data-camera-rotation-orbit={mode === '3d' ? ROTATION_ORBIT.toFixed(4) : undefined}
      data-camera-rotation-x={mode === '3d' ? ROTATION_X.toFixed(4) : undefined}
      data-point-count={points.length}
      data-highlight-count={highlightedIds?.size ?? points.length}
      data-thesis-sphere-scale={mode === '3d' ? THESIS_SPHERE_SCALE : undefined}
      onPointerDownCapture={handlePointerDown}
      onPointerUpCapture={handlePointerUp}
    >
      <DeckGL
        ref={deckRef}
        key={fitRequestKey}
        views={view}
        initialViewState={initialViewState}
        layers={layers}
        onClick={handleClick}
        onViewStateChange={({ viewState }) => recordCameraState(viewState as CameraViewState)}
        getTooltip={({ object, x, y }: PickingInfo<MapObject>) => {
          if (!object) return null
          if (isClusterSummary(object)) {
            return {
              text: `Comunidad ${String(object.id).padStart(2, '0')}\n${object.theme}\n${object.count} tesis · ${object.programCount} programas · ${object.yearMin}–${object.yearMax}`,
              style: {
                backgroundColor: '#111815',
                color: '#f8faf5',
                fontFamily: 'Manrope Variable, sans-serif',
                fontSize: '12px',
                lineHeight: '1.5',
                borderRadius: '6px',
                padding: '10px 12px',
                borderLeft: `3px solid rgb(${clusterColorRgb(object.id).slice(0, 3).join(',')})`,
                ...tooltipPositionStyle(x, y, mapSize, 300),
              },
            }
          }
          return {
            text: `${object.title}\n${object.author} · ${object.year}\n${object.clusterTheme}`,
            style: {
              backgroundColor: '#111815',
              color: '#f8faf5',
              fontFamily: 'Manrope Variable, sans-serif',
              fontSize: '12px',
              lineHeight: '1.45',
              borderRadius: '6px',
              padding: '10px 12px',
              borderLeft: '0 solid transparent',
              ...tooltipPositionStyle(x, y, mapSize, 320),
            },
          }
        }}
        getCursor={({ isDragging, isHovering }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab')}
      />
      <button
        className="map-reset icon-button"
        type="button"
        aria-label="Restablecer encuadre"
        data-tooltip="Restablecer encuadre"
        onClick={() => setResetVersion((value) => value + 1)}
      >
        <LocateFixed size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
