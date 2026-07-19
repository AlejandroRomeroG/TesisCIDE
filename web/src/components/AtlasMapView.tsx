import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUpRight,
  ChevronRight,
  Filter,
  Pause,
  Play,
  Search,
  SkipForward,
  X,
} from 'lucide-react'
import type {
  AnalyticsPayload,
  AtlasFilters,
  CameraDragMode,
  MapMode,
  ThesisDetails,
  ThesisPoint,
} from '../types'
import { clusterColor } from '../lib/colors'
import {
  formatNumber,
  includesAllSearchTerms,
  includesAllSearchTermsInAnyValue,
  languageLabel,
  searchTerms,
} from '../lib/format'

interface AtlasMapViewProps {
  points: ThesisPoint[]
  analytics: AnalyticsPayload
  filters: AtlasFilters
  onFiltersChange: (filters: AtlasFilters) => void
  selected: ThesisPoint | null
  onSelect: (point: ThesisPoint | null) => void
  loadDetails: (thesisId: string) => Promise<ThesisDetails | null>
  timelineMode?: boolean
}

const EMPTY_FILTERS: AtlasFilters = {
  query: '',
  level: '',
  program: '',
  clusterId: null,
}

const SemanticMap = lazy(() => import('./SemanticMap').then((module) => ({ default: module.SemanticMap })))

export function AtlasMapView({
  points,
  analytics,
  filters,
  onFiltersChange,
  selected,
  onSelect,
  loadDetails,
  timelineMode = false,
}: AtlasMapViewProps) {
  const [mode, setMode] = useState<MapMode>('2d')
  const [cameraDragMode, setCameraDragMode] = useState<CameraDragMode>('rotate')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [year, setYear] = useState(analytics.meta.yearMax)
  const [playing, setPlaying] = useState(false)
  const [details, setDetails] = useState<ThesisDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const levels = useMemo(
    () => Object.keys(analytics.meta.levelCounts).sort((a, b) => a.localeCompare(b, 'es')),
    [analytics.meta.levelCounts],
  )
  const programs = useMemo(
    () => [...new Set(points.map((point) => point.degreeProgram))].sort((a, b) => a.localeCompare(b, 'es')),
    [points],
  )
  const programLevels = useMemo(
    () => new Map(points.map((point) => [point.degreeProgram, point.level])),
    [points],
  )
  const timelineYears = useMemo(
    () => Object.entries(analytics.meta.yearTotals)
      .filter(([, count]) => count > 0)
      .map(([value]) => Number(value))
      .sort((a, b) => a - b),
    [analytics.meta.yearTotals],
  )

  const queryTerms = useMemo(() => searchTerms(filters.query), [filters.query])
  const structuralPoints = useMemo(
    () => points.filter((point) => (
      (!filters.level || point.level === filters.level)
      && (!filters.program || point.degreeProgram === filters.program)
    )),
    [filters.level, filters.program, points],
  )

  const searchMatchIds = useMemo(() => {
    if (queryTerms.length === 0) return null
    return new Set(
      structuralPoints
        .filter((point) => (
          includesAllSearchTermsInAnyValue(point.author, queryTerms)
          || includesAllSearchTermsInAnyValue(point.advisor ?? '', queryTerms)
          || [
            point.id,
            point.title,
            point.level,
            point.program,
            point.degreeProgram,
            point.clusterTheme,
            point.subtopic,
            point.secondarySubtopic,
            point.taxonomy,
            languageLabel(point.language),
            String(point.year),
          ].some((value) => includesAllSearchTerms(value, queryTerms))
        ))
        .map((point) => point.id),
    )
  }, [queryTerms, structuralPoints])

  const filteredPoints = useMemo(
    () => structuralPoints.filter((point) => filters.clusterId === null || point.clusterId === filters.clusterId),
    [filters.clusterId, structuralPoints],
  )

  const displayedPoints = useMemo(
    () => timelineMode ? filteredPoints.filter((point) => point.year <= year) : filteredPoints,
    [filteredPoints, timelineMode, year],
  )
  const displayedMatchIds = useMemo(
    () => searchMatchIds === null
      ? null
      : new Set(displayedPoints.filter((point) => searchMatchIds.has(point.id)).map((point) => point.id)),
    [displayedPoints, searchMatchIds],
  )

  const clusterCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const point of structuralPoints) counts.set(point.clusterId, (counts.get(point.clusterId) ?? 0) + 1)
    return counts
  }, [structuralPoints])
  const clusterMatchCounts = useMemo(() => {
    const counts = new Map<number, number>()
    if (searchMatchIds === null) return counts
    for (const point of structuralPoints) {
      if (searchMatchIds.has(point.id)) counts.set(point.clusterId, (counts.get(point.clusterId) ?? 0) + 1)
    }
    return counts
  }, [searchMatchIds, structuralPoints])

  const yearStats = useMemo(() => {
    const newThisYear = filteredPoints.filter((point) => point.year === year).length
    const accumulated = filteredPoints.filter((point) => point.year <= year).length
    const clusterCountsAtYear = new Map<number, number>()
    for (const point of filteredPoints) {
      if (point.year > year) continue
      clusterCountsAtYear.set(point.clusterId, (clusterCountsAtYear.get(point.clusterId) ?? 0) + 1)
    }
    const rankedClusters = analytics.clusters
      .map((cluster) => ({ cluster, count: clusterCountsAtYear.get(cluster.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.cluster.id - b.cluster.id)
    return { newThisYear, accumulated, rankedClusters }
  }, [analytics.clusters, filteredPoints, year])

  const yearIndex = Math.max(0, timelineYears.indexOf(year))
  const previousTimelineYear = yearIndex > 0 ? timelineYears[yearIndex - 1] : year
  const currentYearGap = year - previousTimelineYear

  const activeFilterCount = [filters.program || filters.level, filters.clusterId]
    .filter((value) => value !== '' && value !== null).length

  useEffect(() => {
    if (!playing || !timelineMode) return
    const timer = window.setInterval(() => {
      setYear((current) => {
        const currentIndex = Math.max(0, timelineYears.indexOf(current))
        if (currentIndex >= timelineYears.length - 1) {
          setPlaying(false)
          return current
        }
        return timelineYears[currentIndex + 1]
      })
    }, 650)
    return () => window.clearInterval(timer)
  }, [playing, timelineMode, timelineYears])

  useEffect(() => {
    if (!selected) {
      setDetails(null)
      return
    }
    let active = true
    setDetails(null)
    setDetailsLoading(true)
    loadDetails(selected.id)
      .then((value) => {
        if (active) setDetails(value)
      })
      .finally(() => {
        if (active) setDetailsLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadDetails, selected])

  useEffect(() => {
    if (selected && !displayedPoints.some((point) => point.id === selected.id)) onSelect(null)
  }, [displayedPoints, onSelect, selected])

  function updateFilter<Key extends keyof AtlasFilters>(key: Key, value: AtlasFilters[Key]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  function updateProgram(program: string) {
    onFiltersChange({
      ...filters,
      program,
      level: program ? programLevels.get(program) ?? '' : '',
    })
  }

  function togglePlayback() {
    if (!playing && year >= timelineYears[timelineYears.length - 1]) setYear(timelineYears[0])
    setPlaying((value) => !value)
  }

  const selectedCluster = filters.clusterId === null
    ? null
    : analytics.clusters.find((cluster) => cluster.id === filters.clusterId) ?? null

  return (
    <section className="map-view" aria-label={timelineMode ? 'Película temporal de tesis' : 'Mapa semántico de tesis'}>
      <div className="map-toolbar">
        <label className="search-control">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Buscar tesis, autor, asesor o tema</span>
          <input
            value={filters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder="Buscar tesis, autor, asesor o tema"
            type="search"
          />
          {filters.query && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => updateFilter('query', '')}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="segmented-control" aria-label="Dimensiones del mapa">
          {(['2d', '3d'] as MapMode[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          className="filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <Filter size={17} aria-hidden="true" />
          Filtros
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
      </div>

      <div className={`map-body${filtersOpen ? ' filters-open' : ''}`}>
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <motion.div
              className="filter-band"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <label>
                <span>Nivel</span>
                <select
                  value={filters.level}
                  disabled={Boolean(filters.program)}
                  onChange={(event) => updateFilter('level', event.target.value)}
                >
                  <option value="">Todos los niveles</option>
                  {levels.map((level) => <option key={level}>{level}</option>)}
                </select>
              </label>
              <label>
                <span>Programa</span>
                <select value={filters.program} onChange={(event) => updateProgram(event.target.value)}>
                  <option value="">Todos los programas</option>
                  {programs.map((program) => <option key={program}>{program}</option>)}
                </select>
              </label>
              <button
                className="clear-filters"
                type="button"
                disabled={activeFilterCount === 0}
                onClick={() => onFiltersChange({ ...EMPTY_FILTERS, query: filters.query })}
              >
                <X size={16} aria-hidden="true" />
                Restablecer
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="map-workspace">
        <div className="map-stage">
          <Suspense fallback={<div className="map-loading">Preparando mapa WebGL…</div>}>
            <SemanticMap
              points={displayedPoints}
              fitPoints={structuralPoints}
              highlightedIds={displayedMatchIds}
              clusters={analytics.clusters}
              mode={mode}
              cameraDragMode={cameraDragMode}
              selectedId={selected?.id ?? null}
              selectedClusterId={filters.clusterId}
              yearCutoff={timelineMode ? year : null}
              onSelect={onSelect}
              onCameraDragModeChange={setCameraDragMode}
              onClusterSelect={(clusterId) => updateFilter('clusterId', clusterId)}
              ariaLabel={displayedMatchIds === null
                ? `${formatNumber(displayedPoints.length)} tesis visibles en mapa semántico ${mode.toUpperCase()}`
                : `${formatNumber(displayedMatchIds.size)} coincidencias entre ${formatNumber(displayedPoints.length)} tesis en mapa semántico ${mode.toUpperCase()}`}
            />
          </Suspense>

          <div className="map-readout" aria-live="polite" data-search-active={displayedMatchIds !== null || undefined}>
            <strong>{formatNumber(displayedMatchIds?.size ?? displayedPoints.length)}</strong>
            <span>
              {displayedMatchIds === null ? 'tesis visibles' : 'coincidencias'}
              {displayedMatchIds !== null && <small>{formatNumber(displayedPoints.length)} tesis en contexto</small>}
            </span>
          </div>

          <div className="map-mode-hint">
            {mode === '2d' || cameraDragMode === 'pan'
              ? 'Arrastra para mover · rueda para acercar'
              : 'Arrastra para orbitar · rueda para acercar'}
          </div>

          {timelineMode && (
            <>
              <AnimatePresence initial={false}>
                {currentYearGap > 1 && (
                  <motion.div
                    className="timeline-jump-notice"
                    key={`${previousTimelineYear}-${year}`}
                    initial={{ opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.24 }}
                    aria-live="polite"
                  >
                    <SkipForward size={14} aria-hidden="true" />
                    <strong>{previousTimelineYear} → {year}</strong>
                    <span>{currentYearGap} años hasta el siguiente registro</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="timeline-dock">
                <button
                  className="play-button"
                  type="button"
                  aria-label={playing ? 'Pausar película' : 'Reproducir película'}
                  onClick={togglePlayback}
                >
                  {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} fill="currentColor" aria-hidden="true" />}
                </button>
                <div className="timeline-year">
                  <span>Año</span>
                  <strong>{year}</strong>
                </div>
                <label className="timeline-range">
                  <span className="sr-only">Año de corte</span>
                  <input
                    type="range"
                    min={0}
                    max={timelineYears.length - 1}
                    value={yearIndex}
                    onChange={(event) => {
                      setPlaying(false)
                      setYear(timelineYears[Number(event.target.value)])
                    }}
                  />
                  <span className="range-labels">
                    <span>{timelineYears[0]}</span>
                    <span>{timelineYears[timelineYears.length - 1]}</span>
                  </span>
                </label>
                <div className="timeline-counts">
                  <span><strong>{formatNumber(yearStats.newThisYear)}</strong> nuevas</span>
                  <span><strong>{formatNumber(yearStats.accumulated)}</strong> acumuladas</span>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="map-context" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                className="thesis-detail"
                key={selected.id}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <div className="context-heading">
                  <span className="eyebrow">Tesis seleccionada</span>
                  <button type="button" className="icon-button" aria-label="Cerrar detalle" onClick={() => onSelect(null)}>
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <h2>{selected.title}</h2>
                <p className="detail-author">{selected.author}</p>
                <dl className="detail-facts">
                  <div><dt>Año</dt><dd>{selected.year}</dd></div>
                  <div><dt>Nivel</dt><dd>{selected.level}</dd></div>
                  <div><dt>Programa</dt><dd>{selected.program}</dd></div>
                  <div><dt>Idioma</dt><dd>{languageLabel(selected.language)}</dd></div>
                  <div><dt>Asesoría</dt><dd>{selected.advisor ?? 'No registrada'}</dd></div>
                </dl>
                <div className="theme-marker" style={{ '--cluster-color': clusterColor(selected.clusterId) } as CSSProperties}>
                  <span>{String(selected.clusterId).padStart(2, '0')}</span>
                  <p>{selected.clusterTheme}</p>
                </div>
                <div className="subtopic-line">
                  <span>Subtema</span>
                  <p>{selected.subtopic}</p>
                </div>
                <div className="abstract-block">
                  <span>Resumen</span>
                  {detailsLoading ? <p className="loading-copy">Cargando resumen…</p> : <p>{details?.abstract ?? 'Sin resumen disponible.'}</p>}
                </div>
                {details && details.subjects.length > 0 && (
                  <div className="subjects-line">
                    <span>Materias</span>
                    <p>{details.subjects.join(' · ')}</p>
                  </div>
                )}
                <a className="source-link" href={selected.url} target="_blank" rel="noreferrer">
                  Abrir ficha original
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </motion.div>
            ) : timelineMode ? (
              <motion.div key="timeline-context" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <span className="eyebrow">Pulso temático · {year}</span>
                <h2>Cómo se expande el mapa</h2>
                <p className="context-intro">La posición de cada tesis permanece fija; el tiempo revela cuándo se incorporó al paisaje. Los 20 temas se ordenan por tesis acumuladas.</p>
                <ol className="rank-list timeline-rank">
                  {yearStats.rankedClusters.map(({ cluster, count }, index) => (
                    <li key={cluster.id}>
                      <button
                        type="button"
                        disabled={count === 0}
                        onClick={() => updateFilter('clusterId', cluster.id)}
                      >
                        <span className="rank-index" style={{ backgroundColor: clusterColor(cluster.id) }}>{String(cluster.id).padStart(2, '0')}</span>
                        <span className="rank-copy">
                          <strong>{cluster.theme}</strong>
                          <small>#{String(index + 1).padStart(2, '0')} · {formatNumber(count)} acumuladas</small>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              </motion.div>
            ) : selectedCluster ? (
              <motion.div key={`cluster-${selectedCluster.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="context-heading">
                  <span className="eyebrow">Territorio {String(selectedCluster.id).padStart(2, '0')}</span>
                  <button type="button" className="icon-button" aria-label="Quitar filtro de tema" onClick={() => updateFilter('clusterId', null)}>
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <h2>{selectedCluster.theme}</h2>
                <p className="context-intro">{formatNumber(selectedCluster.count)} tesis · {selectedCluster.programCount} programas · {selectedCluster.yearMin}–{selectedCluster.yearMax}</p>
                <div className="keyword-cloud" aria-label="Palabras clave">
                  {selectedCluster.keywords.slice(0, 10).map((keyword, index) => (
                    <span key={keyword} style={{ fontSize: `${1.28 - index * 0.035}rem` }}>{keyword}</span>
                  ))}
                </div>
                <div className="context-section">
                  <span>Programas con mayor presencia</span>
                  {selectedCluster.topPrograms.slice(0, 4).map((program) => <p key={program}>{program}</p>)}
                </div>
              </motion.div>
            ) : (
              <motion.div key="cluster-index" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <span className="eyebrow">Veinte territorios</span>
                <h2>Explora por tema</h2>
                <p className="context-intro">Selecciona un territorio para aislarlo o entra directamente a una tesis desde el mapa.</p>
                <ol className="rank-list cluster-index-list">
                  {analytics.clusters.map((cluster) => (
                    <li key={cluster.id}>
                      <button
                        type="button"
                        disabled={(clusterCounts.get(cluster.id) ?? 0) === 0}
                        onClick={() => updateFilter('clusterId', cluster.id)}
                      >
                        <span className="rank-index" style={{ backgroundColor: clusterColor(cluster.id) }}>{String(cluster.id).padStart(2, '0')}</span>
                        <span className="rank-copy">
                          <strong>{cluster.theme}</strong>
                          <small>
                            {searchMatchIds === null
                              ? `${formatNumber(clusterCounts.get(cluster.id) ?? 0)} visibles`
                              : `${formatNumber(clusterMatchCounts.get(cluster.id) ?? 0)} coincidencias · ${formatNumber(clusterCounts.get(cluster.id) ?? 0)} en contexto`}
                          </small>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
        </div>
      </div>
    </section>
  )
}
