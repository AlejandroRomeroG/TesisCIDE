import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Search, Users, X } from 'lucide-react'
import { EChart, type ResponsiveChartOption } from './EChart'
import type { AdvisorSummary, AnalyticsPayload } from '../types'
import { clusterColor } from '../lib/colors'
import { formatNumber, formatPercent, includesAllSearchTerms, searchTerms } from '../lib/format'

interface FacultyViewProps {
  analytics: AnalyticsPayload
}

interface AdvisorClick {
  value?: [number, number, number, string, number, string, number]
}

const FACULTY_LABEL_MIN_THESES = 25

export function FacultyView({ analytics }: FacultyViewProps) {
  const [query, setQuery] = useState('')
  const [selectedName, setSelectedName] = useState(analytics.advisors[0]?.name ?? '')
  const queryTerms = useMemo(() => searchTerms(query), [query])

  const matchingAdvisors = useMemo(
    () => queryTerms.length > 0
      ? analytics.advisors.filter((advisor) => includesAllSearchTerms(advisor.name, queryTerms))
      : analytics.advisors,
    [analytics.advisors, queryTerms],
  )
  const matchingNames = useMemo(
    () => queryTerms.length > 0 ? new Set(matchingAdvisors.map((advisor) => advisor.name)) : null,
    [matchingAdvisors, queryTerms.length],
  )
  const defaultLabeledAdvisors = useMemo(
    () => analytics.advisors.filter((advisor) => advisor.thesisCount >= FACULTY_LABEL_MIN_THESES),
    [analytics.advisors],
  )
  const visibleLabelAdvisors = queryTerms.length > 0 ? matchingAdvisors : defaultLabeledAdvisors
  const selected = analytics.advisors.find((advisor) => advisor.name === selectedName) ?? analytics.advisors[0]

  const topics = useMemo(
    () => analytics.advisorTopics
      .filter((datum) => datum.name === selected.name)
      .sort((a, b) => b.thesisCount - a.thesisCount),
    [analytics.advisorTopics, selected.name],
  )

  const option = useMemo<ResponsiveChartOption>(() => ({ compact }) => {
    const byCluster = new Map<number, AdvisorSummary[]>()
    for (const advisor of analytics.advisors) {
      const rows = byCluster.get(advisor.mainClusterId) ?? []
      rows.push(advisor)
      byCluster.set(advisor.mainClusterId, rows)
    }
    const maximumTheses = Math.max(...analytics.advisors.map((advisor) => advisor.thesisCount))
    const xAxisMaximum = Math.ceil(maximumTheses * 1.12 + 2)
    const directLabels = visibleLabelAdvisors.length <= 3
    const labelPlacements = directLabels
      ? visibleLabelAdvisors.map((advisor) => ({
          advisor,
          x: advisor.thesisCount,
          y: advisor.clusterCount,
          position: advisor.thesisCount > xAxisMaximum * 0.72 ? 'left' as const : 'right' as const,
          connector: false,
        }))
      : [
          {
            position: 'left' as const,
            x: xAxisMaximum * 0.41,
            rows: [...visibleLabelAdvisors]
              .sort((a, b) => a.thesisCount - b.thesisCount || a.name.localeCompare(b.name, 'es'))
              .slice(0, Math.ceil(visibleLabelAdvisors.length / 2)),
          },
          {
            position: 'right' as const,
            x: xAxisMaximum * 0.59,
            rows: [...visibleLabelAdvisors]
              .sort((a, b) => a.thesisCount - b.thesisCount || a.name.localeCompare(b.name, 'es'))
              .slice(Math.ceil(visibleLabelAdvisors.length / 2)),
          },
        ].flatMap(({ position, x, rows }) => rows
          .sort((a, b) => b.clusterCount - a.clusterCount || b.thesisCount - a.thesisCount)
          .map((advisor, index) => ({
            advisor,
            x,
            y: rows.length === 1 ? advisor.clusterCount : 15.8 - index * (15 / (rows.length - 1)),
            position,
            connector: true,
          })))
    const pointSeries = [...byCluster.entries()].map(([clusterId, advisors]) => ({
      name: analytics.clusters.find((cluster) => cluster.id === clusterId)?.theme ?? `Cluster ${clusterId}`,
      type: 'scatter',
      data: advisors.map((advisor) => {
        const matches = matchingNames === null || matchingNames.has(advisor.name)
        return {
          value: [
            advisor.thesisCount,
            advisor.clusterCount,
            advisor.programCount,
            advisor.name,
            advisor.mainClusterId,
            advisor.mainCluster,
            matches ? 1 : 0,
          ],
          itemStyle: matches ? undefined : {
            color: '#9ca59f',
            borderColor: '#e7eae5',
            borderWidth: 1,
            opacity: 0.2,
          },
        }
      }),
      symbolSize: (value: [number, number, number, string, number, string, number]) => {
        const size = 7 + Math.sqrt(value[0]) * 2.1 + value[2] * 0.65
        return compact ? Math.max(5, size * 0.72) : size
      },
      itemStyle: {
        color: clusterColor(clusterId),
        borderColor: '#f7f8f4',
        borderWidth: 1,
        opacity: 0.78,
      },
      emphasis: { focus: 'series', scale: 1.18, itemStyle: { opacity: 1, borderColor: '#111815', borderWidth: 2 } },
    }))
    const labelSeries = {
      name: 'Nombres',
      type: 'scatter',
      silent: true,
      z: 20,
      symbolSize: 1,
      itemStyle: {
        color: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(0, 0, 0, 0)',
      },
      tooltip: { show: false },
      data: labelPlacements.map(({ advisor, x, y, position }) => ({
        value: [
          x,
          y,
          advisor.programCount,
          advisor.name,
          advisor.mainClusterId,
          advisor.mainCluster,
          1,
        ],
        label: { position },
      })),
      label: {
        show: true,
        distance: compact ? 5 : 7,
        color: '#25302a',
        fontFamily: 'Manrope Variable',
        fontSize: compact ? 8 : 10,
        lineHeight: compact ? 11 : 14,
        backgroundColor: 'rgba(247, 248, 244, 0.9)',
        borderRadius: 2,
        padding: compact ? [1, 2] : [2, 3],
        formatter: (params: unknown) => (params as AdvisorClick).value?.[3] ?? '',
      },
      markLine: {
        silent: true,
        animation: false,
        symbol: ['none', 'none'],
        label: { show: false },
        lineStyle: { color: '#7c8881', width: 1, opacity: 0.36 },
        data: labelPlacements
          .filter(({ connector }) => connector)
          .map(({ advisor, x, y }) => [
            { coord: [advisor.thesisCount, advisor.clusterCount] },
            { coord: [x, y] },
          ]),
      },
      labelLayout: { hideOverlap: false },
    }
    return {
      animationDuration: 520,
      animationEasing: 'cubicOut',
      aria: { enabled: true },
      grid: {
        left: compact ? 43 : 62,
        right: compact ? 18 : 36,
        top: compact ? 22 : 30,
        bottom: compact ? 48 : 64,
      },
      tooltip: {
        backgroundColor: '#111815',
        borderWidth: 0,
        textStyle: { color: '#f8faf5', fontFamily: 'Manrope Variable' },
        formatter: (params: unknown) => {
          const value = (params as AdvisorClick).value
          if (!value) return ''
          return `<strong>${value[3]}</strong><br/>${formatNumber(value[0])} tesis · ${value[1]} temas · ${value[2]} programas<br/>Principal: ${value[5]}`
        },
      },
      xAxis: {
        type: 'value',
        min: -0.5,
        max: xAxisMaximum,
        name: 'Tesis asesoradas',
        nameLocation: 'middle',
        nameGap: compact ? 28 : 40,
        axisLine: { lineStyle: { color: '#aeb5ad' } },
        axisTick: { show: false },
        axisLabel: { color: '#66716b', fontFamily: 'Manrope Variable', fontSize: compact ? 9 : 12 },
        nameTextStyle: { color: '#66716b', fontFamily: 'Manrope Variable', fontSize: compact ? 9 : 12 },
        splitLine: { lineStyle: { color: '#e2e5df' } },
      },
      yAxis: {
        type: 'value',
        min: -0.7,
        max: 17,
        interval: 2,
        name: compact ? 'Territorios' : 'Territorios temáticos',
        nameLocation: 'middle',
        nameGap: compact ? 28 : 42,
        axisLine: { lineStyle: { color: '#aeb5ad' } },
        axisTick: { show: false },
        axisLabel: { color: '#66716b', fontFamily: 'Manrope Variable', fontSize: compact ? 9 : 12 },
        nameTextStyle: { color: '#66716b', fontFamily: 'Manrope Variable', fontSize: compact ? 9 : 12 },
        splitLine: { lineStyle: { color: '#e2e5df' } },
      },
      series: [...pointSeries, labelSeries],
    }
  }, [analytics.advisors, analytics.clusters, matchingNames, visibleLabelAdvisors])

  function handleClick(params: unknown) {
    const value = (params as AdvisorClick).value
    if (typeof value?.[3] === 'string') setSelectedName(value[3])
  }

  return (
    <section
      className="analysis-view faculty-view"
      data-point-count={analytics.advisors.length}
      data-match-count={matchingAdvisors.length}
      data-search-active={queryTerms.length > 0 || undefined}
      data-label-threshold={FACULTY_LABEL_MIN_THESES}
      data-default-label-count={defaultLabeledAdvisors.length}
      data-visible-label-count={visibleLabelAdvisors.length}
      data-label-overlap="callout-columns"
    >
      <div className="analysis-toolbar faculty-toolbar">
        <div>
          <span className="eyebrow">465 nombres homologados</span>
          <h2>Profesorado como puente entre temas</h2>
        </div>
        <label className="search-control compact-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Buscar profesora o profesor</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar profesorado" type="search" />
          {query && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}>
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      <div className="analysis-split">
        <div className="chart-region">
          <div className="chart-heading">
            <div>
              <h3>Volumen y amplitud temática</h3>
              <p>Cada punto es una persona; el tamaño incorpora también el número de programas. Se muestran nombres a partir de 25 tesis.</p>
            </div>
            <span>
              {queryTerms.length > 0
                ? `${formatNumber(matchingAdvisors.length)} ${matchingAdvisors.length === 1 ? 'coincidencia' : 'coincidencias'}`
                : `${formatNumber(analytics.advisors.length)} visibles`}
            </span>
          </div>
          <EChart
            option={option}
            className="faculty-chart"
            ariaLabel={`Dispersión de ${formatNumber(analytics.advisors.length)} personas por tesis y temas`}
            onClick={handleClick}
          />
          <ul className="sr-only" aria-label="Nombres mostrados en la gráfica">
            {visibleLabelAdvisors.map((advisor) => <li key={advisor.name}>{advisor.name}</li>)}
          </ul>
          {queryTerms.length > 0 && matchingAdvisors.length === 0 && (
            <div className="empty-search faculty-empty-search">
              <Users size={26} aria-hidden="true" />
              No hay coincidencias para “{query}”.
            </div>
          )}
          {queryTerms.length > 0 && matchingAdvisors.length > 0 && (
            <div className="faculty-results" aria-label="Resultados de búsqueda">
              {matchingAdvisors.slice(0, 8).map((advisor) => (
                <button key={advisor.name} type="button" onClick={() => setSelectedName(advisor.name)}>
                  <strong>{advisor.name}</strong>
                  <span>{advisor.thesisCount} tesis</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <motion.aside
          className="analysis-context faculty-context"
          key={selected.name}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22 }}
        >
          <span className="eyebrow">Perfil de asesoría</span>
          <h2>{selected.name}</h2>
          <p className="context-intro">Actividad observada entre {selected.yearMin} y {selected.yearMax}.</p>
          <div className="metric-strip three">
            <div><strong>{formatNumber(selected.thesisCount)}</strong><span>tesis</span></div>
            <div><strong>{selected.clusterCount}</strong><span>temas</span></div>
            <div><strong>{selected.programCount}</strong><span>programas</span></div>
          </div>
          <div className="dominant-theme" style={{ borderColor: clusterColor(selected.mainClusterId) }}>
            <span>Tema principal · {formatPercent(selected.mainClusterShare)}</span>
            <p>{selected.mainCluster}</p>
          </div>
          <div className="advisor-topic-bars">
            <span>Distribución temática</span>
            {topics.slice(0, 8).map((topic) => (
              <div key={topic.clusterId}>
                <div><strong>{topic.clusterTheme}</strong><span>{formatPercent(topic.advisorShare)}</span></div>
                <span className="bar-track"><span style={{ width: `${topic.advisorShare * 100}%`, backgroundColor: clusterColor(topic.clusterId) }} /></span>
              </div>
            ))}
          </div>
          <label className="program-picker">
            <span>Cambiar perfil</span>
            <select value={selectedName} onChange={(event) => setSelectedName(event.target.value)}>
              {analytics.advisors.map((advisor) => <option key={advisor.name}>{advisor.name}</option>)}
            </select>
          </label>
        </motion.aside>
      </div>
    </section>
  )
}
