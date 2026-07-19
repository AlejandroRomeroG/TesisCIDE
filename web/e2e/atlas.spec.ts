import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { PNG } from 'pngjs'

async function expectCanvasHasContent(canvas: Locator, minimumChromaticSamples: number | null = 18) {
  await expect(canvas).toBeVisible()
  const image = PNG.sync.read(await canvas.screenshot())
  const colors = new Set<string>()
  let opaqueSamples = 0
  let chromaticSamples = 0
  const stride = Math.max(4, Math.floor(Math.min(image.width, image.height) / 160))

  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      const offset = (image.width * y + x) * 4
      if (image.data[offset + 3] < 100) continue
      opaqueSamples += 1
      const red = image.data[offset]
      const green = image.data[offset + 1]
      const blue = image.data[offset + 2]
      colors.add(`${red}-${green}-${blue}`)
      if (Math.max(red, green, blue) - Math.min(red, green, blue) > 32) chromaticSamples += 1
    }
  }

  expect(opaqueSamples).toBeGreaterThan(200)
  expect(colors.size).toBeGreaterThan(18)
  if (minimumChromaticSamples !== null) {
    expect(chromaticSamples).toBeGreaterThan(minimumChromaticSamples)
  }
}

async function expectNoDocumentOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1)
}

async function expectPlotFitsViewport(page: Page, selector: string) {
  const metrics = await page.locator(selector).evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const parent = element.parentElement
    const navigationTop = document.querySelector('.side-navigation')?.getBoundingClientRect().top ?? 0
    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      viewportWidth: window.innerWidth,
      navigationTop: navigationTop > 1 ? navigationTop : window.innerHeight,
      parentClientWidth: parent?.clientWidth ?? bounds.width,
      parentScrollWidth: parent?.scrollWidth ?? bounds.width,
    }
  })
  expect(metrics.left).toBeGreaterThanOrEqual(-1)
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1)
  expect(metrics.parentScrollWidth).toBeLessThanOrEqual(metrics.parentClientWidth + 1)
  expect(metrics.top).toBeGreaterThanOrEqual(0)
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.navigationTop + 1)
}

async function expectChartTooltipContained(page: Page, selector: string) {
  const chart = page.locator(selector)
  const chartBox = await chart.boundingBox()
  expect(chartBox).not.toBeNull()
  const tooltip = chart.locator('.atlas-chart-tooltip')
  let found = false

  for (let yStep = 1; yStep <= 9 && !found; yStep += 1) {
    for (let xStep = 9; xStep >= 1 && !found; xStep -= 1) {
      await page.mouse.move(
        chartBox!.x + chartBox!.width * xStep / 10,
        chartBox!.y + chartBox!.height * yStep / 10,
      )
      await page.waitForTimeout(20)
      found = await tooltip.isVisible().catch(() => false)
    }
  }

  expect(found).toBe(true)
  const tooltipBox = await tooltip.boundingBox()
  expect(tooltipBox).not.toBeNull()
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(chartBox!.x + 7)
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(chartBox!.y + 7)
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(chartBox!.x + chartBox!.width - 7)
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(chartBox!.y + chartBox!.height - 7)
  const style = await tooltip.evaluate((element) => {
    const computed = getComputedStyle(element)
    return { maxWidth: Number.parseFloat(computed.maxWidth), whiteSpace: computed.whiteSpace }
  })
  expect(style.maxWidth).toBeLessThanOrEqual(Math.min(320, chartBox!.width - 16) + 1)
  expect(style.whiteSpace).toBe('normal')
}

async function saveScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(name), fullPage: true })
}

function activeSemanticMap(page: Page) {
  return page.locator('.preserved-view.is-active .semantic-map')
}

function activeSemanticCanvas(page: Page) {
  return activeSemanticMap(page).locator('canvas').last()
}

function activeMapReadout(page: Page) {
  return page.locator('.preserved-view.is-active .map-readout')
}

function activeMapStage(page: Page) {
  return page.locator('.preserved-view.is-active .map-stage')
}

interface CameraState {
  zoom: string | undefined
  targetX: string | undefined
  targetY: string | undefined
  targetZ: string | undefined
  rotationOrbit: string | undefined
  rotationX: string | undefined
}

async function readCameraState(page: Page): Promise<CameraState> {
  return activeSemanticMap(page).evaluate((element) => ({
    zoom: (element as HTMLElement).dataset.cameraZoom,
    targetX: (element as HTMLElement).dataset.cameraTargetX,
    targetY: (element as HTMLElement).dataset.cameraTargetY,
    targetZ: (element as HTMLElement).dataset.cameraTargetZ,
    rotationOrbit: (element as HTMLElement).dataset.cameraRotationOrbit,
    rotationX: (element as HTMLElement).dataset.cameraRotationX,
  }))
}

async function readFitCameraState(page: Page): Promise<CameraState> {
  return activeSemanticMap(page).evaluate((element) => ({
    zoom: (element as HTMLElement).dataset.fitZoom,
    targetX: (element as HTMLElement).dataset.fitTargetX,
    targetY: (element as HTMLElement).dataset.fitTargetY,
    targetZ: (element as HTMLElement).dataset.fitTargetZ,
    rotationOrbit: (element as HTMLElement).dataset.fitRotationOrbit,
    rotationX: (element as HTMLElement).dataset.fitRotationX,
  }))
}

async function expectFitProfile(
  page: Page,
  profile: {
    viewport: 'mobile' | 'desktop'
    context: 'map' | 'timeline'
    zoomScale: string
    verticalOffset: string | RegExp
    verticalPositionScale: string
  },
) {
  await expect(activeSemanticMap(page)).toHaveAttribute('data-fit-viewport', profile.viewport)
  await expect(activeSemanticMap(page)).toHaveAttribute('data-fit-context', profile.context)
  await expect(activeSemanticMap(page)).toHaveAttribute('data-fit-zoom-scale', profile.zoomScale)
  await expect(activeSemanticMap(page)).toHaveAttribute('data-fit-vertical-offset', profile.verticalOffset)
  await expect(activeSemanticMap(page)).toHaveAttribute(
    'data-fit-vertical-position-scale',
    profile.verticalPositionScale,
  )
}

async function expectClusterVisibilityPreservesCamera(page: Page, token: string) {
  const canvas = activeSemanticCanvas(page)
  const initialCamera = await readCameraState(page)
  await canvas.hover()
  await page.mouse.wheel(0, -260)
  await expect.poll(async () => (await readCameraState(page)).zoom).not.toBe(initialCamera.zoom)
  await canvas.evaluate((element, value) => {
    element.dataset.cameraToken = value
  }, token)
  const movedCamera = await readCameraState(page)

  await page.getByRole('button', { name: /Crimen, violencia y seguridad/ }).click()
  await expect(activeSemanticMap(page)).toHaveAttribute('data-point-count', '154')
  await expect(canvas).toHaveAttribute('data-camera-token', token)
  await expect.poll(() => readCameraState(page)).toEqual(movedCamera)

  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  for (const [xShare, yShare] of [[0.04, 0.5], [0.96, 0.5], [0.5, 0.05], [0.5, 0.78]]) {
    await page.mouse.click(
      canvasBox!.x + canvasBox!.width * xShare,
      canvasBox!.y + canvasBox!.height * yShare,
    )
    await page.waitForTimeout(80)
    if (await activeSemanticMap(page).getAttribute('data-point-count') === '2388') break
  }
  await expect(activeSemanticMap(page)).toHaveAttribute('data-point-count', '2388')
  await expect(canvas).toHaveAttribute('data-camera-token', token)
  await expect.poll(() => readCameraState(page)).toEqual(movedCamera)
}

async function expectFilterTogglePreservesMap(page: Page, token: string) {
  const canvas = activeSemanticCanvas(page)
  const camera = await readCameraState(page)
  const closedScrollTop = await page.locator('.app-main').evaluate((element) => element.scrollTop)
  const mapHint = page.locator('.preserved-view.is-active .map-mode-hint')
  const timelineDock = page.locator('.preserved-view.is-active .timeline-dock')
  const closedHintBounds = await mapHint.isVisible().then((visible) => visible ? mapHint.boundingBox() : null)
  const closedDockBounds = await timelineDock.count() ? await timelineDock.boundingBox() : null
  const closedBounds = await activeSemanticMap(page).evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return { top: bounds.top, height: bounds.height }
  })
  await canvas.evaluate((element, value) => {
    element.dataset.filterToken = value
  }, token)

  await page.getByRole('button', { name: 'Filtros', exact: true }).click()
  await expect(page.locator('.preserved-view.is-active .filter-band')).toBeVisible()
  const layoutSamples: Array<{ top: number; height: number }> = []
  for (let sample = 0; sample < 5; sample += 1) {
    layoutSamples.push(await activeSemanticMap(page).evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return { top: bounds.top, height: bounds.height }
    }))
    await page.waitForTimeout(24)
  }
  const topRange = Math.max(...layoutSamples.map(({ top }) => top)) - Math.min(...layoutSamples.map(({ top }) => top))
  const heightRange = Math.max(...layoutSamples.map(({ height }) => height)) - Math.min(...layoutSamples.map(({ height }) => height))
  expect(topRange).toBeLessThanOrEqual(1)
  expect(heightRange).toBeLessThanOrEqual(1)
  expect(layoutSamples[0].top).toBeGreaterThan(closedBounds.top)
  expect(Math.abs(layoutSamples[0].height - closedBounds.height)).toBeLessThanOrEqual(1)
  expect(await page.locator('.app-main').evaluate((element) => element.scrollTop)).toBe(closedScrollTop)
  if (closedHintBounds) {
    const hintBounds = await mapHint.boundingBox()
    expect(hintBounds).not.toBeNull()
    expect(Math.abs(hintBounds!.y - closedHintBounds.y)).toBeLessThanOrEqual(1)
  }
  if (closedDockBounds) {
    const dockBounds = await timelineDock.boundingBox()
    const visibleBottom = (page.viewportSize()?.width ?? 0) <= 900
      ? await page.locator('.side-navigation').evaluate((element) => element.getBoundingClientRect().top)
      : await page.locator('.preserved-view.is-active .map-body').evaluate((element) => element.getBoundingClientRect().bottom)
    expect(dockBounds).not.toBeNull()
    expect(Math.abs(dockBounds!.y - closedDockBounds.y)).toBeLessThanOrEqual(1)
    expect(dockBounds!.y + dockBounds!.height).toBeLessThanOrEqual(visibleBottom + 1)
  }
  await page.waitForTimeout(280)
  await expect(canvas).toHaveAttribute('data-filter-token', token)
  await expect.poll(() => readCameraState(page)).toEqual(camera)

  await page.getByRole('button', { name: 'Filtros', exact: true }).click()
  await expect(page.locator('.preserved-view.is-active .filter-band')).toHaveCount(0)
  await page.waitForTimeout(280)
  const restoredBounds = await activeSemanticMap(page).evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return { top: bounds.top, height: bounds.height }
  })
  expect(Math.abs(restoredBounds.top - closedBounds.top)).toBeLessThanOrEqual(1)
  expect(Math.abs(restoredBounds.height - closedBounds.height)).toBeLessThanOrEqual(1)
  expect(await page.locator('.app-main').evaluate((element) => element.scrollTop)).toBe(closedScrollTop)
  await expect(canvas).toHaveAttribute('data-filter-token', token)
  await expect.poll(() => readCameraState(page)).toEqual(camera)
  await expectCanvasHasContent(canvas, 6)
}

async function clickProgramHeatmapCell(page: Page, mode: 'profile' | 'similarity', column: number, row: number) {
  const chart = page.locator('.program-chart')
  const box = await chart.boundingBox()
  expect(box).not.toBeNull()
  const compact = box!.width < 600
  const medium = box!.width < 820
  const left = compact ? 76 : medium ? 154 : 245
  const right = compact ? 8 : 30
  const top = mode === 'profile' ? (compact ? 14 : 24) : (compact ? 40 : 48)
  const bottom = mode === 'profile' ? (compact ? 64 : 74) : (compact ? 112 : 155)
  const columns = mode === 'profile' ? 20 : 21
  const rows = 21
  const cellWidth = (box!.width - left - right) / columns
  const cellHeight = (box!.height - top - bottom) / rows

  await page.mouse.click(
    box!.x + left + (column + 0.5) * cellWidth,
    box!.y + top + (rows - row - 0.5) * cellHeight,
  )
}

test('desktop atlas renders every analytical surface and animation control', async ({ page }, testInfo) => {
  test.slow()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Mapa semántico', exact: true })).toBeVisible()
  await expect(page.getByText('2,388').first()).toBeVisible()
  await expect(page.getByText('Última actualización', { exact: true })).toBeVisible()
  const updateLabel = page.locator('.data-date > span')
  const updateDate = page.locator('.data-date > strong')
  const updateTypography = await Promise.all([
    updateLabel.evaluate((element) => ({
      fontFamily: getComputedStyle(element).fontFamily,
      fontSize: getComputedStyle(element).fontSize,
    })),
    updateDate.evaluate((element) => ({
      fontFamily: getComputedStyle(element).fontFamily,
      fontSize: getComputedStyle(element).fontSize,
    })),
  ])
  expect(updateTypography[0]).toEqual(updateTypography[1])
  const brandTypeSizes = await page.locator('.brand-mark').evaluate((element) => ({
    at: Number.parseFloat(getComputedStyle(element.querySelector('strong')!).fontSize),
    cide: Number.parseFloat(getComputedStyle(element.querySelector('small')!).fontSize),
  }))
  expect(brandTypeSizes.cide).toBe(brandTypeSizes.at)
  await expect(page.getByRole('link', { name: /Autor Alejandro Romero González/ }))
    .toHaveAttribute('href', 'https://alejandroromerog.github.io/')
  const sealStyles = await page.locator('.source-seal').evaluate((element) => {
    const links = element.querySelectorAll('a')
    const style = (selector: string, link: Element) => getComputedStyle(link.querySelector(selector)!)
    return {
      sourceLabel: style('strong', links[0]).color,
      authorLabel: style('strong', links[1]).color,
      sourceValue: getComputedStyle(links[0].querySelector('p')!).color,
      authorValue: getComputedStyle(links[1].querySelector('p')!).color,
      sourceMarker: style(':scope > span', links[0]).backgroundColor,
      authorMarker: style(':scope > span', links[1]).backgroundColor,
    }
  })
  expect(sealStyles.authorLabel).toBe(sealStyles.sourceLabel)
  expect(sealStyles.authorValue).toBe(sealStyles.sourceValue)
  expect(sealStyles.authorMarker).toBe(sealStyles.sourceMarker)
  await expect(page.locator('.brand-name')).toHaveText(/Atlas de\s*Tesis del CIDE/)
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', './favicon.svg?v=at-cide')
  const favicon = await page.evaluate(async () => {
    const response = await fetch(new URL('./favicon.svg', window.location.href))
    const document = new DOMParser().parseFromString(await response.text(), 'image/svg+xml')
    return [...document.querySelectorAll('text')].map((element) => ({
      label: element.textContent,
      size: element.closest('g')?.getAttribute('font-size') ?? element.getAttribute('font-size'),
    }))
  })
  expect(favicon).toEqual([{ label: 'AT', size: '15' }, { label: 'CIDE', size: '15' }])
  await expectCanvasHasContent(activeSemanticCanvas(page))
  await expectNoDocumentOverflow(page)
  await saveScreenshot(page, testInfo, 'atlas-desktop-map.png')
  await expectFilterTogglePreservesMap(page, 'map-2d-filter')

  await page.getByRole('button', { name: 'Filtros', exact: true }).click()
  const levelFilter = page.getByLabel('Nivel')
  const programFilter = page.getByLabel('Programa')
  await programFilter.selectOption('Maestría en Economía')
  await expect(levelFilter).toHaveValue('Maestría')
  await expect(levelFilter).toBeDisabled()
  await expect(activeSemanticMap(page)).toHaveAttribute('data-point-count', '315')
  await programFilter.selectOption('')
  await expect(levelFilter).toHaveValue('')
  await expect(levelFilter).toBeEnabled()
  await programFilter.selectOption('Maestría en Economía')
  await page.getByRole('button', { name: 'Restablecer', exact: true }).click()
  await expect(levelFilter).toHaveValue('')
  await expect(programFilter).toHaveValue('')
  await expect(levelFilter).toBeEnabled()
  await page.getByRole('button', { name: 'Filtros', exact: true }).click()

  const search = page.getByRole('searchbox', { name: 'Buscar tesis, autor, asesor o tema' })
  await search.fill('pandemia')
  await expect(activeSemanticMap(page)).toHaveAttribute('data-point-count', '2388')
  const highlighted = Number(await activeSemanticMap(page).getAttribute('data-highlight-count'))
  expect(highlighted).toBeGreaterThan(0)
  expect(highlighted).toBeLessThan(2388)
  await expect(activeMapReadout(page)).toContainText('coincidencias')
  await expect(activeMapReadout(page)).toContainText('2,388 tesis en contexto')
  await expectCanvasHasContent(activeSemanticCanvas(page), 6)
  await saveScreenshot(page, testInfo, 'atlas-desktop-search-focus.png')
  await search.fill('Alejandro Romero')
  await expect(activeSemanticMap(page)).toHaveAttribute('data-highlight-count', '1')
  await expect(activeMapReadout(page).locator('strong')).toHaveText('1')
  await search.fill('Romero, González Alejandro')
  await expect(activeSemanticMap(page)).toHaveAttribute('data-highlight-count', '1')
  await search.fill('Carlos Arturo')
  await expect(activeSemanticMap(page)).toHaveAttribute('data-highlight-count', '1')
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click()
  await expect(activeSemanticMap(page)).toHaveAttribute('data-highlight-count', '2388')

  const edgePoint = await page.evaluate(async () => {
    const response = await fetch('/data/atlas.json')
    const payload = await response.json()
    return payload.points.reduce(
      (rightmost: { x: number; y: number }, point: { x: number; y: number }) => point.x > rightmost.x ? point : rightmost,
    ) as { x: number; y: number }
  })
  const fit = await activeSemanticMap(page).evaluate((element) => ({
    zoom: Number((element as HTMLElement).dataset.fitZoom),
    targetX: Number((element as HTMLElement).dataset.fitTargetX),
    targetY: Number((element as HTMLElement).dataset.fitTargetY),
  }))
  const mapBox = await activeSemanticMap(page).boundingBox()
  expect(mapBox).not.toBeNull()
  const scale = 2 ** fit.zoom
  await page.mouse.move(
    mapBox!.x + mapBox!.width / 2 + (edgePoint.x - fit.targetX) * scale,
    mapBox!.y + mapBox!.height / 2 - (edgePoint.y - fit.targetY) * scale,
  )
  const tooltip = activeSemanticMap(page).locator('.deck-tooltip')
  await expect(tooltip).toBeVisible()
  const tooltipBox = await tooltip.boundingBox()
  expect(tooltipBox).not.toBeNull()
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(mapBox!.x - 1)
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(mapBox!.y - 1)
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(mapBox!.x + mapBox!.width + 1)
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(mapBox!.y + mapBox!.height + 1)
  await saveScreenshot(page, testInfo, 'atlas-edge-tooltip.png')

  await activeSemanticCanvas(page).hover()
  const initial2dCamera = await readFitCameraState(page)
  await page.mouse.wheel(0, -650)
  await expect.poll(async () => (await readCameraState(page)).zoom).not.toBe(initial2dCamera.zoom)
  await page.waitForTimeout(450)
  await saveScreenshot(page, testInfo, 'atlas-desktop-2d-close.png')
  await page.getByRole('button', { name: 'Volver a la vista inicial' }).click()
  await expect.poll(() => readCameraState(page)).toEqual(initial2dCamera)
  await expectCanvasHasContent(activeSemanticCanvas(page))

  await expectClusterVisibilityPreservesCamera(page, 'map-2d-camera')
  await expectCanvasHasContent(activeSemanticCanvas(page))
  await expect(page.getByRole('heading', { name: 'Explora por tema' })).toBeVisible()

  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect(activeSemanticMap(page)).toHaveAttribute('data-thesis-sphere-scale', '0.048')
  await expectFitProfile(page, {
    viewport: 'desktop',
    context: 'map',
    zoomScale: '1.750',
    verticalOffset: /^[1-9]\d*\.\d$/,
    verticalPositionScale: '1.100',
  })
  const rotateCamera = page.getByRole('button', { name: 'Girar cámara' })
  const moveCamera = page.getByRole('button', { name: 'Mover cámara' })
  await expect(rotateCamera).toHaveAttribute('aria-pressed', 'true')
  await expect(moveCamera).toHaveAttribute('aria-pressed', 'false')
  const cameraBeforePan = await readCameraState(page)
  await moveCamera.click()
  await expect(activeSemanticMap(page)).toHaveAttribute('data-camera-drag-mode', 'pan')
  await expect(page.locator('.preserved-view.is-active .map-mode-hint')).toContainText('Arrastra para mover')
  await expect.poll(() => readCameraState(page)).toEqual(cameraBeforePan)
  const panCanvas = activeSemanticCanvas(page)
  const panBounds = await panCanvas.boundingBox()
  expect(panBounds).not.toBeNull()
  const panStart = {
    x: panBounds!.x + panBounds!.width * 0.54,
    y: panBounds!.y + panBounds!.height * 0.48,
  }
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down()
  await page.mouse.move(panStart.x + 92, panStart.y + 46, { steps: 8 })
  await page.mouse.up()
  const initialTarget = [cameraBeforePan.targetX, cameraBeforePan.targetY, cameraBeforePan.targetZ].join('|')
  await expect.poll(async () => {
    const camera = await readCameraState(page)
    return [camera.targetX, camera.targetY, camera.targetZ].join('|')
  }).not.toBe(initialTarget)
  const cameraAfterPan = await readCameraState(page)
  expect(cameraAfterPan.rotationOrbit).toBe(cameraBeforePan.rotationOrbit)
  expect(cameraAfterPan.rotationX).toBe(cameraBeforePan.rotationX)
  await rotateCamera.click()
  await expect(activeSemanticMap(page)).toHaveAttribute('data-camera-drag-mode', 'rotate')
  await expect.poll(() => readCameraState(page)).toEqual(cameraAfterPan)
  const rotationBeforeDrag = [cameraAfterPan.rotationOrbit, cameraAfterPan.rotationX].join('|')
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down()
  await page.mouse.move(panStart.x - 74, panStart.y + 38, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => {
    const camera = await readCameraState(page)
    return [camera.rotationOrbit, camera.rotationX].join('|')
  }).not.toBe(rotationBeforeDrag)
  const cameraAfterRotation = await readCameraState(page)
  expect(cameraAfterRotation.targetX).toBe(cameraAfterPan.targetX)
  expect(cameraAfterRotation.targetY).toBe(cameraAfterPan.targetY)
  expect(cameraAfterRotation.targetZ).toBe(cameraAfterPan.targetZ)
  const initial3dCamera = await readFitCameraState(page)
  await page.getByRole('button', { name: 'Volver a la vista inicial' }).click()
  await expect.poll(() => readCameraState(page)).toEqual(initial3dCamera)
  await expectCanvasHasContent(activeSemanticCanvas(page))
  await saveScreenshot(page, testInfo, 'atlas-desktop-3d.png')
  await expectFilterTogglePreservesMap(page, 'map-3d-filter')
  await expectClusterVisibilityPreservesCamera(page, 'map-3d-camera')
  await saveScreenshot(page, testInfo, 'atlas-desktop-3d-close.png')

  await page.getByRole('button', { name: 'Programas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mapa', exact: true }).click()
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expectCanvasHasContent(activeSemanticCanvas(page))

  await page.getByRole('button', { name: 'Tiempo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'El mapa a través del tiempo' })).toBeVisible()
  const timelineRanking = page.locator('.timeline-rank li')
  await expect(timelineRanking).toHaveCount(20)
  await expect(timelineRanking.first()).toContainText('#01')
  await expect(timelineRanking.last()).toContainText('#20')
  const timelineRankingScroll = await page.locator('.timeline-rank').evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(timelineRankingScroll.scrollHeight).toBeGreaterThan(timelineRankingScroll.clientHeight)
  const rankedCounts = await timelineRanking.locator('.rank-copy small').allTextContents()
  const accumulatedCounts = rankedCounts.map((label) => Number(label.split('·')[1].replace(/\D/g, '')))
  expect(accumulatedCounts).toEqual([...accumulatedCounts].sort((a, b) => b - a))
  await saveScreenshot(page, testInfo, 'atlas-desktop-time-ranking.png')
  await expectFitProfile(page, {
    viewport: 'desktop',
    context: 'timeline',
    zoomScale: '1.750',
    verticalOffset: /^[1-9]\d*\.\d$/,
    verticalPositionScale: '1.100',
  })
  await expectFilterTogglePreservesMap(page, 'time-3d-filter')
  await expectClusterVisibilityPreservesCamera(page, 'time-3d-camera')
  await page.getByRole('button', { name: '2D', exact: true }).click()
  await expectFilterTogglePreservesMap(page, 'time-2d-filter')
  await expectClusterVisibilityPreservesCamera(page, 'time-2d-camera')
  const year = page.locator('.timeline-year strong')
  await expect(year).toHaveText('2026')
  const yearSlider = page.getByRole('slider', { name: 'Año de corte' })
  await yearSlider.press('Home')
  await expect(year).toHaveText('1978')
  await yearSlider.press('ArrowRight')
  await expect(year).toHaveText('1994')
  await expect(page.locator('.timeline-jump-notice')).toContainText('1978 → 1994')
  await expect(page.locator('.timeline-jump-notice')).toContainText('16 años hasta el siguiente registro')
  await page.getByRole('button', { name: 'Reproducir película' }).click()
  await expect(year).not.toHaveText('1994')
  await page.getByRole('button', { name: 'Pausar película' }).click()

  await page.getByRole('button', { name: 'Programas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible()
  await expectCanvasHasContent(page.locator('.program-chart canvas').last())
  await expectPlotFitsViewport(page, '.program-chart')
  await expectChartTooltipContained(page, '.program-chart')
  await clickProgramHeatmapCell(page, 'profile', 1, 0)
  await expect(page.locator('.analysis-context')).toHaveAttribute('data-selected-program', 'Licenciatura en Economía')
  await expect(page.locator('.analysis-context')).toHaveAttribute('data-selected-cluster', '1')
  await expect(page.locator('.program-comparison-bars')).toHaveAttribute('data-comparison-count', '20')
  await expect(page.locator('.program-comparison-bars button')).toHaveCount(20)
  await expect(page.locator('.program-comparison-bars button').first()).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Similitud' }).click()
  await expectCanvasHasContent(page.locator('.program-chart canvas').last())
  await expectChartTooltipContained(page, '.program-chart')
  await clickProgramHeatmapCell(page, 'similarity', 1, 10)
  await expect(page.locator('.analysis-context')).toHaveAttribute(
    'data-selected-program',
    'Maestría en Métodos para el Análisis de Políticas Públicas',
  )
  await expect(page.locator('.analysis-context')).toHaveAttribute(
    'data-selected-comparison',
    'Licenciatura en Ciencia Política y Relaciones Internacionales',
  )
  await expect(page.locator('.program-comparison-bars')).toHaveAttribute('data-comparison-count', '20')
  await expect(page.locator('.program-comparison-bars button')).toHaveCount(20)
  await expect(page.locator('.program-comparison-bars button').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.program-comparison-bars .comparison-level')).toHaveCount(20)
  for (const level of ['Licenciatura', 'Maestría', 'Doctorado']) {
    expect(await page.locator(`.program-comparison-bars [data-program-level="${level}"]`).count()).toBeGreaterThan(0)
  }
  const levelColors = await page.locator('.program-comparison-bars button').evaluateAll((buttons) => [
    ...new Set(buttons.map((button) => getComputedStyle(button.querySelector('.bar-track > span')!).backgroundColor)),
  ])
  expect(levelColors).toHaveLength(3)
  await saveScreenshot(page, testInfo, 'atlas-desktop-program-similarity.png')
  await page.getByRole('button', { name: 'Perfil temático' }).click()
  await saveScreenshot(page, testInfo, 'atlas-desktop-programs.png')

  await page.getByRole('button', { name: 'Temas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Territorios temáticos', exact: true })).toBeVisible()
  await expectCanvasHasContent(page.locator('.topic-chart canvas').last())
  await expectPlotFitsViewport(page, '.topic-chart')
  await expectChartTooltipContained(page, '.topic-chart')
  await expect(page.locator('.topic-selector')).toHaveCount(0)
  await expect(page.locator('.topic-context h2')).toHaveText('Crimen, violencia y seguridad')
  await saveScreenshot(page, testInfo, 'atlas-desktop-topics.png')

  await page.getByRole('button', { name: 'Profesorado', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Profesorado', exact: true })).toBeVisible()
  await expectCanvasHasContent(page.locator('.faculty-chart canvas').last())
  await expectPlotFitsViewport(page, '.faculty-chart')
  await expectChartTooltipContained(page, '.faculty-chart')
  const facultySearch = page.getByRole('searchbox', { name: 'Buscar profesora o profesor' })
  await facultySearch.fill('Laura Helena')
  await expect(page.locator('.faculty-view')).toHaveAttribute('data-point-count', '465')
  await expect(page.locator('.faculty-view')).toHaveAttribute('data-match-count', '1')
  await expect(page.locator('.chart-heading')).toContainText('1 coincidencia')
  await expectCanvasHasContent(page.locator('.faculty-chart canvas').last(), null)
  await saveScreenshot(page, testInfo, 'atlas-desktop-faculty.png')

  await page.getByRole('button', { name: 'Método', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cómo se construyó el atlas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '2,388 tesis conectadas por lo que dicen' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Una forma distinta de leer la producción del CIDE' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seis pasos para llegar al Atlas desde el repositorio del CIDE' })).toBeVisible()
  await expect(page.getByText('El proceso, sin jerga')).toHaveCount(0)
  await expect(page.getByText('2,388 fichas, equivalentes al 100.0%, incluyen un abstract utilizable.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver la fuente original' })).toHaveAttribute('href', 'https://repositorio-digital.cide.edu')
  const technicalDetails = page.locator('.method-technical')
  await expect(technicalDetails).not.toHaveAttribute('open', '')
  await saveScreenshot(page, testInfo, 'atlas-desktop-methodology.png')
  await page.getByText('Ver ficha técnica ampliada').click()
  await expect(technicalDetails).toHaveAttribute('open', '')
  await expect(page.getByText('Para las personas más curiosas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Las comunidades se calculan antes del mapa' })).toBeVisible()
  await expect(page.getByText('Secuencia reproducible')).toHaveCount(0)
})

test('mobile atlas reflows without document overflow or control collisions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Mapa semántico', exact: true })).toBeVisible()
  await expectCanvasHasContent(activeSemanticCanvas(page))
  await expectNoDocumentOverflow(page)
  await expectFilterTogglePreservesMap(page, 'mobile-map-filter')
  await expectNoDocumentOverflow(page)

  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expectFitProfile(page, {
    viewport: 'mobile',
    context: 'map',
    zoomScale: '1.500',
    verticalOffset: '0.0',
    verticalPositionScale: '1.000',
  })
  const mobileCameraModes = page.getByRole('group', { name: 'Interacción de cámara 3D' })
  const mobileReset = page.getByRole('button', { name: 'Volver a la vista inicial' })
  await expect(mobileCameraModes).toBeVisible()
  await expect(mobileReset).toBeVisible()
  const mobileModeBounds = await mobileCameraModes.boundingBox()
  const mobileResetBounds = await mobileReset.boundingBox()
  expect(mobileModeBounds).not.toBeNull()
  expect(mobileResetBounds).not.toBeNull()
  expect(mobileModeBounds!.y).toBeGreaterThanOrEqual(mobileResetBounds!.y + mobileResetBounds!.height + 6)
  const mobileInitial3dCamera = await readFitCameraState(page)
  await page.getByRole('button', { name: 'Mover cámara' }).click()
  const mobileCanvas = activeSemanticCanvas(page)
  const mobileCanvasBounds = await mobileCanvas.boundingBox()
  expect(mobileCanvasBounds).not.toBeNull()
  const mobilePanStart = {
    x: mobileCanvasBounds!.x + mobileCanvasBounds!.width * 0.5,
    y: mobileCanvasBounds!.y + mobileCanvasBounds!.height * 0.5,
  }
  await page.mouse.move(mobilePanStart.x, mobilePanStart.y)
  await page.mouse.down()
  await page.mouse.move(mobilePanStart.x + 48, mobilePanStart.y + 32, { steps: 6 })
  await page.mouse.up()
  const mobileInitialTarget = [
    mobileInitial3dCamera.targetX,
    mobileInitial3dCamera.targetY,
    mobileInitial3dCamera.targetZ,
  ].join('|')
  await expect.poll(async () => {
    const camera = await readCameraState(page)
    return [camera.targetX, camera.targetY, camera.targetZ].join('|')
  }).not.toBe(mobileInitialTarget)
  await mobileReset.click()
  await expect.poll(() => readCameraState(page)).toEqual(mobileInitial3dCamera)
  await saveScreenshot(page, testInfo, 'atlas-mobile-map-3d.png')
  await page.getByRole('button', { name: '2D', exact: true }).click()

  const navigation = await page.locator('.side-navigation').boundingBox()
  const stage = await activeMapStage(page).boundingBox()
  expect(navigation).not.toBeNull()
  expect(stage).not.toBeNull()
  expect(navigation!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height - 1)
  await saveScreenshot(page, testInfo, 'atlas-mobile-map.png')

  await page.getByRole('button', { name: 'Tiempo', exact: true }).click()
  await expectFitProfile(page, {
    viewport: 'mobile',
    context: 'timeline',
    zoomScale: '1.500',
    verticalOffset: '36.0',
    verticalPositionScale: '1.500',
  })
  await expectFilterTogglePreservesMap(page, 'mobile-time-filter')
  const dock = await page.locator('.timeline-dock').boundingBox()
  const timeStage = await activeMapStage(page).boundingBox()
  expect(dock).not.toBeNull()
  expect(timeStage).not.toBeNull()
  expect(dock!.y).toBeGreaterThanOrEqual(timeStage!.y)
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(timeStage!.y + timeStage!.height + 1)
  await expect(page.locator('.range-gap')).toHaveCount(0)
  await expect(page.locator('.range-labels')).toContainText('1978')
  await expect(page.locator('.range-labels')).toContainText('2026')
  await expect(page.locator('.range-labels')).not.toContainText('salto')
  await saveScreenshot(page, testInfo, 'atlas-mobile-time.png')

  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expectFitProfile(page, {
    viewport: 'mobile',
    context: 'timeline',
    zoomScale: '2.250',
    verticalOffset: '36.0',
    verticalPositionScale: '1.500',
  })
  const mobileTimeline3dCamera = await readFitCameraState(page)
  await activeSemanticCanvas(page).hover()
  await page.mouse.wheel(0, -260)
  await expect.poll(async () => (await readCameraState(page)).zoom).not.toBe(mobileTimeline3dCamera.zoom)
  await page.getByRole('button', { name: 'Volver a la vista inicial' }).click()
  await expect.poll(() => readCameraState(page)).toEqual(mobileTimeline3dCamera)
  await saveScreenshot(page, testInfo, 'atlas-mobile-time-3d.png')
  await page.getByRole('button', { name: '2D', exact: true }).click()

  await page.getByRole('button', { name: 'Programas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible()
  await expectNoDocumentOverflow(page)
  await expectCanvasHasContent(page.locator('.program-chart canvas').last())
  await expectPlotFitsViewport(page, '.program-chart')
  await expectChartTooltipContained(page, '.program-chart')
  await saveScreenshot(page, testInfo, 'atlas-mobile-programs.png')

  await page.getByRole('button', { name: 'Similitud' }).click()
  await expectCanvasHasContent(page.locator('.program-chart canvas').last())
  await expectPlotFitsViewport(page, '.program-chart')
  await expectChartTooltipContained(page, '.program-chart')
  await saveScreenshot(page, testInfo, 'atlas-mobile-program-similarity.png')

  await page.getByRole('button', { name: 'Temas', exact: true }).click()
  await expectCanvasHasContent(page.locator('.topic-chart canvas').last())
  await expectPlotFitsViewport(page, '.topic-chart')
  await expectChartTooltipContained(page, '.topic-chart')
  await saveScreenshot(page, testInfo, 'atlas-mobile-topics.png')

  await page.getByRole('button', { name: 'Profesorado', exact: true }).click()
  await expectCanvasHasContent(page.locator('.faculty-chart canvas').last())
  await expectPlotFitsViewport(page, '.faculty-chart')
  await expectChartTooltipContained(page, '.faculty-chart')
  await saveScreenshot(page, testInfo, 'atlas-mobile-faculty.png')

  await page.getByRole('button', { name: 'Programas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible()
  for (const label of ['Mapa', 'Tiempo', 'Programas', 'Temas', 'Profesorado', 'Método']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
  await saveScreenshot(page, testInfo, 'atlas-mobile-program-detail.png')

  await page.getByRole('button', { name: 'Método', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cómo se construyó el atlas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '2,388 tesis conectadas por lo que dicen' })).toBeVisible()
  await expectNoDocumentOverflow(page)
  await saveScreenshot(page, testInfo, 'atlas-mobile-methodology.png')
  await page.getByText('Ver ficha técnica ampliada').click()
  await expect(page.locator('.method-technical')).toHaveAttribute('open', '')
  await expectNoDocumentOverflow(page)
})

test('small portrait and landscape plots stay inside the visible frame', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expectCanvasHasContent(activeSemanticCanvas(page))
    await expectFilterTogglePreservesMap(page, `compact-${viewport.width}x${viewport.height}-filter`)

    const navigation = await page.locator('.side-navigation').boundingBox()
    const stage = await activeMapStage(page).boundingBox()
    expect(navigation).not.toBeNull()
    expect(stage).not.toBeNull()
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(navigation!.y + 1)

    for (const [label, selector] of [
      ['Programas', '.program-chart'],
      ['Temas', '.topic-chart'],
      ['Profesorado', '.faculty-chart'],
    ] as const) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expectCanvasHasContent(page.locator(`${selector} canvas`).last(), 6)
      await expectPlotFitsViewport(page, selector)
    }

    await page.getByRole('button', { name: 'Método', exact: true }).click()
    await expect(page.getByRole('heading', { name: '2,388 tesis conectadas por lo que dicen' })).toBeVisible()
    await expectNoDocumentOverflow(page)
    await page.getByText('Ver ficha técnica ampliada').click()
    await expect(page.locator('.method-technical')).toHaveAttribute('open', '')
    await expectNoDocumentOverflow(page)
  }
})
