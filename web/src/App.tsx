import { lazy, Suspense, useState } from 'react'
import { AlertCircle, Database, GraduationCap, Network, Orbit } from 'lucide-react'
import { Navigation } from './components/Navigation'
import { AtlasMapView } from './components/AtlasMapView'
import { useAtlasData } from './data/useAtlasData'
import type { AtlasFilters, ThesisPoint, ViewId } from './types'
import { formatNumber, updatedDate } from './lib/format'
import './App.css'

const VIEW_COPY: Record<ViewId, { title: string; subtitle: string }> = {
  map: {
    title: 'Mapa semántico',
    subtitle: 'Cada punto es una tesis; la distancia aproxima afinidad de contenido.',
  },
  time: {
    title: 'El mapa a través del tiempo',
    subtitle: 'Una película acumulativa de la producción académica desde 1978.',
  },
  programs: {
    title: 'Programas',
    subtitle: 'Compara mezclas temáticas y cercanía entre trayectorias académicas.',
  },
  topics: {
    title: 'Territorios temáticos',
    subtitle: 'Veinte comunidades interpretables con volumen, tiempo y diversidad.',
  },
  faculty: {
    title: 'Profesorado',
    subtitle: 'Volumen de asesoría, amplitud temática y conexiones entre programas.',
  },
  methodology: {
    title: 'Cómo se construyó el atlas',
    subtitle: 'Fuente, procesamiento, modelos, validaciones y límites de interpretación.',
  },
}

const ProgramsView = lazy(() => import('./components/ProgramsView').then((module) => ({ default: module.ProgramsView })))
const TopicsView = lazy(() => import('./components/TopicsView').then((module) => ({ default: module.TopicsView })))
const FacultyView = lazy(() => import('./components/FacultyView').then((module) => ({ default: module.FacultyView })))
const MethodologyView = lazy(() => import('./components/MethodologyView').then((module) => ({ default: module.MethodologyView })))

const INITIAL_FILTERS: AtlasFilters = { query: '', level: '', program: '', clusterId: null }

function LoadingAtlas() {
  return (
    <main className="loading-atlas" aria-live="polite">
      <div className="loading-constellation" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => <span key={index} />)}
      </div>
      <span>Cargando atlas</span>
      <p>Preparando 2,388 tesis y sus relaciones.</p>
    </main>
  )
}

function LoadingView() {
  return <div className="loading-view" aria-live="polite">Preparando visualización…</div>
}

function App() {
  const { atlas, analytics, error, loading, loadDetails } = useAtlasData()
  const [activeView, setActiveView] = useState<ViewId>('map')
  const [filters, setFilters] = useState<AtlasFilters>(INITIAL_FILTERS)
  const [selectedThesis, setSelectedThesis] = useState<ThesisPoint | null>(null)

  if (loading && !error) return <LoadingAtlas />

  if (error || !atlas || !analytics) {
    return (
      <main className="error-state">
        <AlertCircle size={28} aria-hidden="true" />
        <h1>No se pudo abrir el atlas</h1>
        <p>{error ?? 'Los archivos de datos no están disponibles.'}</p>
      </main>
    )
  }

  const viewCopy = VIEW_COPY[activeView]
  const mapViewActive = activeView === 'map' || activeView === 'time'
  const stats = [
    { label: 'Tesis', value: formatNumber(analytics.meta.thesisCount), icon: Database },
    { label: 'Programas', value: String(analytics.meta.programCount), icon: GraduationCap },
    { label: 'Temas', value: String(analytics.meta.clusterCount), icon: Orbit },
    { label: 'Asesores', value: formatNumber(analytics.meta.advisorCount), icon: Network },
  ]

  function changeView(view: ViewId) {
    setActiveView(view)
    setSelectedThesis(null)
  }

  return (
    <div className="app-shell">
      <Navigation activeView={activeView} onChange={changeView} />
      <main className="app-main">
        <header className="app-header">
          <div className="view-title">
            <span>Atlas de Tesis CIDE</span>
            <h1>{viewCopy.title}</h1>
            <p>{viewCopy.subtitle}</p>
          </div>
          <div className="global-stats" aria-label="Cobertura del atlas">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label}>
                <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="data-date">
            <span>Snapshot</span>
            <strong>{updatedDate(analytics.meta.sourceUpdatedAt)}</strong>
          </div>
        </header>

        <div className="view-transition">
          <div
            className={`preserved-view${mapViewActive ? ' is-active' : ''}`}
            aria-hidden={!mapViewActive}
            inert={!mapViewActive}
          >
            <AtlasMapView
              points={atlas.points}
              analytics={analytics}
              filters={filters}
              onFiltersChange={setFilters}
              selected={selectedThesis}
              onSelect={setSelectedThesis}
              loadDetails={loadDetails}
              timelineMode={activeView === 'time'}
            />
          </div>
          <Suspense fallback={<LoadingView />}>
            {activeView === 'programs' && (
              <div className="transient-view">
                <ProgramsView analytics={analytics} />
              </div>
            )}
            {activeView === 'topics' && (
              <div className="transient-view">
                <TopicsView analytics={analytics} />
              </div>
            )}
            {activeView === 'faculty' && (
              <div className="transient-view">
                <FacultyView analytics={analytics} />
              </div>
            )}
            {activeView === 'methodology' && (
              <div className="transient-view">
                <MethodologyView meta={analytics.meta} />
              </div>
            )}
          </Suspense>
        </div>
      </main>
    </div>
  )
}

export default App
