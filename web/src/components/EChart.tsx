import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import {
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
} from 'echarts/charts'
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
])

export interface ChartSize {
  width: number
  height: number
  compact: boolean
}

export type ResponsiveChartOption = EChartsCoreOption | ((size: ChartSize) => EChartsCoreOption)

interface EChartProps {
  option: ResponsiveChartOption
  className?: string
  ariaLabel: string
  onClick?: (params: unknown) => void
}

interface TooltipPositionSize {
  contentSize: [number, number]
  viewSize: [number, number]
}

type TooltipRecord = Record<string, unknown>

const TOOLTIP_EDGE_GAP = 8
const TOOLTIP_POINTER_GAP = 12

function containedTooltipPosition(
  point: [number, number],
  _params: unknown,
  _element: unknown,
  _rect: unknown,
  size: TooltipPositionSize,
): [number, number] {
  const [viewWidth, viewHeight] = size.viewSize
  const contentWidth = Math.min(size.contentSize[0], Math.max(0, viewWidth - TOOLTIP_EDGE_GAP * 2))
  const contentHeight = Math.min(size.contentSize[1], Math.max(0, viewHeight - TOOLTIP_EDGE_GAP * 2))

  let left = point[0] + TOOLTIP_POINTER_GAP
  let top = point[1] + TOOLTIP_POINTER_GAP
  if (left + contentWidth > viewWidth - TOOLTIP_EDGE_GAP) {
    left = point[0] - contentWidth - TOOLTIP_POINTER_GAP
  }
  if (top + contentHeight > viewHeight - TOOLTIP_EDGE_GAP) {
    top = point[1] - contentHeight - TOOLTIP_POINTER_GAP
  }

  const maxLeft = Math.max(TOOLTIP_EDGE_GAP, viewWidth - contentWidth - TOOLTIP_EDGE_GAP)
  const maxTop = Math.max(TOOLTIP_EDGE_GAP, viewHeight - contentHeight - TOOLTIP_EDGE_GAP)
  return [
    Math.max(TOOLTIP_EDGE_GAP, Math.min(left, maxLeft)),
    Math.max(TOOLTIP_EDGE_GAP, Math.min(top, maxTop)),
  ]
}

function resolvedOption(element: HTMLDivElement, value: ResponsiveChartOption): EChartsCoreOption {
  const bounds = element.getBoundingClientRect()
  const size = {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
    compact: bounds.width < 600,
  }
  const option = typeof value === 'function' ? value(size) : value
  const tooltip = (option as TooltipRecord).tooltip
  if (!tooltip || Array.isArray(tooltip) || typeof tooltip !== 'object') return option

  const tooltipOption = tooltip as TooltipRecord
  const existingClassName = typeof tooltipOption.className === 'string' ? tooltipOption.className : ''
  const existingCss = typeof tooltipOption.extraCssText === 'string' ? tooltipOption.extraCssText : ''
  const maxWidth = Math.max(1, Math.min(320, size.width - TOOLTIP_EDGE_GAP * 2))

  return {
    ...option,
    tooltip: {
      ...tooltipOption,
      appendTo: element,
      className: `${existingClassName} atlas-chart-tooltip`.trim(),
      confine: true,
      renderMode: 'html',
      position: containedTooltipPosition,
      extraCssText: `${existingCss};max-width:${maxWidth}px;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.45;pointer-events:none;`,
    },
  }
}

export function EChart({ option, className = '', ariaLabel, onClick }: EChartProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const optionRef = useRef(option)
  optionRef.current = option

  useEffect(() => {
    if (!elementRef.current) return
    const chart = echarts.init(elementRef.current, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    let previousWidth = 0
    let previousHeight = 0
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      if (width === previousWidth && height === previousHeight) return
      previousWidth = width
      previousHeight = height
      chart.resize()
      if (elementRef.current) {
        chart.setOption(resolvedOption(elementRef.current, optionRef.current), {
          notMerge: true,
          lazyUpdate: false,
        })
      }
    })
    observer.observe(elementRef.current)

    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    chartRef.current?.setOption(resolvedOption(element, option), { notMerge: true, lazyUpdate: false })
  }, [option])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onClick) return
    const handler = (params: unknown) => onClick(params)
    chart.on('click', handler)
    return () => {
      if (!chart.isDisposed()) chart.off('click', handler)
    }
  }, [onClick])

  return <div ref={elementRef} className={`echart ${className}`} role="img" aria-label={ariaLabel} />
}
