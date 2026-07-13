import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { PNG } from 'pngjs'

async function expectCanvasHasContent(canvas: Locator, minimumChromaticSamples = 18) {
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
  expect(chromaticSamples).toBeGreaterThan(minimumChromaticSamples)
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

test('desktop atlas renders every analytical surface and animation control', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Mapa semántico', exact: true })).toBeVisible()
  await expect(page.getByText('2,388').first()).toBeVisible()
  await expectCanvasHasContent(activeSemanticCanvas(page))
  await expectNoDocumentOverflow(page)
  await saveScreenshot(page, testInfo, 'atlas-desktop-map.png')

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
  await page.mouse.wheel(0, -650)
  await page.waitForTimeout(450)
  await saveScreenshot(page, testInfo, 'atlas-desktop-2d-close.png')
  await page.reload()
  await expectCanvasHasContent(activeSemanticCanvas(page))

  await page.getByRole('button', { name: /Crimen, violencia y seguridad/ }).click()
  await expect(activeMapReadout(page).locator('strong')).toHaveText('154')
  await expectCanvasHasContent(activeSemanticCanvas(page))
  const canvasBox = await activeSemanticCanvas(page).boundingBox()
  expect(canvasBox).not.toBeNull()
  await page.mouse.click(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + 24)
  await expect(activeMapReadout(page).locator('strong')).toHaveText('2,388')
  await expect(page.getByRole('heading', { name: 'Explora por tema' })).toBeVisible()

  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expectCanvasHasContent(activeSemanticCanvas(page))
  await saveScreenshot(page, testInfo, 'atlas-desktop-3d.png')
  await activeSemanticCanvas(page).hover()
  await page.mouse.wheel(0, -650)
  await page.waitForTimeout(450)
  await saveScreenshot(page, testInfo, 'atlas-desktop-3d-close.png')

  await page.getByRole('button', { name: 'Programas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mapa', exact: true }).click()
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expectCanvasHasContent(activeSemanticCanvas(page))

  await page.getByRole('button', { name: 'Tiempo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'El mapa a través del tiempo' })).toBeVisible()
  const year = page.locator('.timeline-year strong')
  await expect(year).toHaveText('2026')
  const yearSlider = page.getByRole('slider', { name: 'Año de corte' })
  await yearSlider.press('Home')
  await expect(year).toHaveText('1978')
  await yearSlider.press('ArrowRight')
  await expect(year).toHaveText('1994')
  await expect(page.locator('.timeline-jump-notice')).toContainText('Salto de 16 años')
  await page.getByRole('button', { name: 'Reproducir película' }).click()
  await expect(year).not.toHaveText('1994')
  await page.getByRole('button', { name: 'Pausar película' }).click()

  await page.getByRole('button', { name: 'Programas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible()
  await expectCanvasHasContent(page.locator('.program-chart canvas').last())
  await expectPlotFitsViewport(page, '.program-chart')
  await saveScreenshot(page, testInfo, 'atlas-desktop-programs.png')

  await page.getByRole('button', { name: 'Temas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Territorios temáticos', exact: true })).toBeVisible()
  await expectCanvasHasContent(page.locator('.topic-chart canvas').last())
  await expectPlotFitsViewport(page, '.topic-chart')
  await saveScreenshot(page, testInfo, 'atlas-desktop-topics.png')

  await page.getByRole('button', { name: 'Profesorado', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Profesorado', exact: true })).toBeVisible()
  await expectCanvasHasContent(page.locator('.faculty-chart canvas').last())
  await expectPlotFitsViewport(page, '.faculty-chart')
  await saveScreenshot(page, testInfo, 'atlas-desktop-faculty.png')

  await page.getByRole('button', { name: 'Método', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cómo se construyó el atlas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Una cadena reproducible, con la fuente siempre a la vista' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Consultar el Repositorio Digital CIDE' })).toHaveAttribute('href', 'https://repositorio-digital.cide.edu')
  await saveScreenshot(page, testInfo, 'atlas-desktop-methodology.png')
})

test('mobile atlas reflows without document overflow or control collisions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Mapa semántico', exact: true })).toBeVisible()
  await expectCanvasHasContent(activeSemanticCanvas(page))
  await expectNoDocumentOverflow(page)

  const navigation = await page.locator('.side-navigation').boundingBox()
  const stage = await activeMapStage(page).boundingBox()
  expect(navigation).not.toBeNull()
  expect(stage).not.toBeNull()
  expect(navigation!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height - 1)
  await saveScreenshot(page, testInfo, 'atlas-mobile-map.png')

  await page.getByRole('button', { name: 'Tiempo', exact: true }).click()
  const dock = await page.locator('.timeline-dock').boundingBox()
  const timeStage = await activeMapStage(page).boundingBox()
  expect(dock).not.toBeNull()
  expect(timeStage).not.toBeNull()
  expect(dock!.y).toBeGreaterThanOrEqual(timeStage!.y)
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(timeStage!.y + timeStage!.height + 1)
  await expect(page.locator('.range-gap')).toContainText('salto 16 años')
  await saveScreenshot(page, testInfo, 'atlas-mobile-time.png')

  await page.getByRole('button', { name: 'Programas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible()
  await expectNoDocumentOverflow(page)
  await expectCanvasHasContent(page.locator('.program-chart canvas').last())
  await expectPlotFitsViewport(page, '.program-chart')
  await saveScreenshot(page, testInfo, 'atlas-mobile-programs.png')

  await page.getByRole('button', { name: 'Similitud' }).click()
  await expectCanvasHasContent(page.locator('.program-chart canvas').last())
  await expectPlotFitsViewport(page, '.program-chart')

  await page.getByRole('button', { name: 'Temas', exact: true }).click()
  await expectCanvasHasContent(page.locator('.topic-chart canvas').last())
  await expectPlotFitsViewport(page, '.topic-chart')
  await saveScreenshot(page, testInfo, 'atlas-mobile-topics.png')

  await page.getByRole('button', { name: 'Profesorado', exact: true }).click()
  await expectCanvasHasContent(page.locator('.faculty-chart canvas').last())
  await expectPlotFitsViewport(page, '.faculty-chart')
  await saveScreenshot(page, testInfo, 'atlas-mobile-faculty.png')

  await page.getByRole('button', { name: 'Programas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible()
  for (const label of ['Mapa', 'Tiempo', 'Programas', 'Temas', 'Profesorado', 'Método']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
  await saveScreenshot(page, testInfo, 'atlas-mobile-program-detail.png')

  await page.getByRole('button', { name: 'Método', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cómo se construyó el atlas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Una cadena reproducible, con la fuente siempre a la vista' })).toBeVisible()
  await expectNoDocumentOverflow(page)
  await saveScreenshot(page, testInfo, 'atlas-mobile-methodology.png')
})

test('small portrait and landscape plots stay inside the visible frame', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expectCanvasHasContent(activeSemanticCanvas(page))

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
  }
})
