const PLOTLY_URL = 'https://cdn.plot.ly/plotly-3.4.0.min.js'
const PLOTLY_INTEGRITY = 'sha256-KEmPoupLpFyGMyGAiOsiNDbKDKAvxXAn/W+oQa0ZAfk='
const ASSET_VERSION = '20260901.3'
const versionedAsset = path => `${path}?v=${ASSET_VERSION}`
const DATA_MODULE_URL = versionedAsset('/portfolio/js/plot-data.js')
const SIERRA_MODULE_URL = versionedAsset('/portfolio/js/sierra-model.js')
const PORTFOLIO_FONT_URL = versionedAsset('/portfolio/fonts/inter-latin.woff2')
const PLOT_IDS = ['basin', 'nevada', 'forge', 'monte-carlo', 'tornado']
const DOWNLOAD_ASSETS = [
  { kind: 'runtime', url: PLOTLY_URL, label: 'Plotly engine' },
  { kind: 'module', url: DATA_MODULE_URL, label: 'Plot interaction code' },
  { kind: 'module', url: SIERRA_MODULE_URL, label: 'Sierra model code' },
  { kind: 'data', id: 'dcism', url: versionedAsset('/portfolio/data/dcism.json'), label: 'DC-ISM annual scenarios' },
  { kind: 'data', id: 'basin', url: versionedAsset('/portfolio/data/basin.json'), label: 'Basin formation data' },
  { kind: 'data', id: 'nevada', url: versionedAsset('/portfolio/data/nevada.json'), label: 'Nevada favorability data' },
  { kind: 'data', id: 'forge', url: versionedAsset('/portfolio/data/forge.json'), label: 'FORGE stimulation data' },
  { kind: 'data', id: 'monte-carlo', url: versionedAsset('/portfolio/data/monte-carlo.json'), label: 'Monte Carlo distribution' },
  { kind: 'data', id: 'tornado', url: versionedAsset('/portfolio/data/tornado.json'), label: 'Sensitivity analysis' }
]

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const track = document.getElementById('portfolio-track')
const slides = Array.from(document.querySelectorAll('.slide'))
const previousButton = document.getElementById('nav-previous')
const nextButton = document.getElementById('nav-next')
const slideDots = Array.from(document.querySelectorAll('[data-slide-target]'))
const scrollCue = document.getElementById('scroll-cue')
const announcement = document.getElementById('announcement')
const DOWNLOAD_TOTAL = DOWNLOAD_ASSETS.length
const BUILD_TOTAL = 4
const TYPEWRITER_SPEED = 35
const HERO_TYPEWRITER_SPEED = 45
const SLIDE_COLOR_MARKERS = {
  1: [
    ['the risks of human-induced geohazards', 'act-problem'],
    ['coupled-process numerical and data-driven models', 'act-outcome']
  ],
  2: [
    ['open-ended energy questions', 'act-problem'],
    ['technical and commercial decisions', 'act-outcome']
  ],
  3: [
    ['severe time constraints', 'act-problem'],
    ['robust workflows', 'act-outcome']
  ]
}
const typedSlides = new Set()

const portfolioFontReady = typeof FontFace === 'function'
  ? new FontFace('Portfolio Inter', `url(${PORTFOLIO_FONT_URL})`, { style: 'normal', weight: '100 900' })
      .load()
      .then(face => {
        document.fonts.add(face)
        return face
      })
      .catch(error => {
        console.warn('Portfolio font could not be loaded; using the system sans-serif fallback.', error)
        return null
      })
  : Promise.resolve(null)

const progress = {
  panel: document.getElementById('load-panel'),
  download: {
    track: document.getElementById('download-progress'),
    ascii: document.querySelector('#download-progress .load-progress__ascii'),
    status: document.getElementById('download-status')
  },
  build: {
    track: document.getElementById('build-progress'),
    ascii: document.querySelector('#build-progress .load-progress__ascii'),
    status: document.getElementById('build-status')
  }
}

const appState = {
  currentSlide: 0,
  requestedSlide: 0,
  navigationReady: false,
  transitioning: false,
  plotModule: null,
  sierraModule: null,
  plotly: null,
  plotSpecs: new Map(),
  downloadedPlotText: new Map(),
  renderedPlots: new Map(),
  fullscreenShell: null,
  fullscreenOrigin: null,
  touchStart: null
}

function parseRequestedSlide () {
  const match = window.location.hash.match(/(?:slide|act)-(\d+)/)
  if (!match) return 0
  return Math.max(0, Math.min(slides.length - 1, Number(match[1]) || 0))
}

function setProgress (target, completed, total, phase, message) {
  const safeTotal = Math.max(1, Math.round(total))
  const safeCompleted = Math.max(0, Math.min(safeTotal, Math.round(completed)))
  const filled = Math.round((safeCompleted / safeTotal) * 12)
  target.ascii.textContent = `[${'#'.repeat(filled)}${'.'.repeat(12 - filled)}]`
  target.track.setAttribute('aria-valuemax', String(safeTotal))
  target.track.setAttribute('aria-valuenow', String(safeCompleted))
  const status = `${phase} (${safeCompleted}/${safeTotal}): ${message}`
  target.status.textContent = status
  target.track.setAttribute('aria-valuetext', status)
}

function buildTypewriterSegments (text, markers = []) {
  const segments = []
  let cursor = 0
  for (const [word, className] of markers) {
    const index = text.indexOf(word, cursor)
    if (index < 0) continue
    if (index > cursor) segments.push({ text: text.slice(cursor, index), className: '' })
    segments.push({ text: word, className })
    cursor = index + word.length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), className: '' })
  return segments
}

function typeSegmentsInto (host, segments, speed = TYPEWRITER_SPEED) {
  host.replaceChildren(...segments.map(segment => {
    const span = document.createElement('span')
    if (segment.className) span.className = segment.className
    return span
  }))
  const nodes = Array.from(host.children)

  if (reducedMotion.matches) {
    segments.forEach((segment, index) => { nodes[index].textContent = segment.text })
    return Promise.resolve()
  }

  const total = segments.reduce((sum, segment) => sum + segment.text.length, 0)
  return new Promise(resolve => {
    const start = performance.now()
    let lastTarget = -1

    function frame (now) {
      const target = Math.min(total, Math.floor((now - start) / speed))
      if (target !== lastTarget) {
        let remaining = target
        segments.forEach((segment, index) => {
          const count = Math.max(0, Math.min(segment.text.length, remaining))
          nodes[index].textContent = segment.text.slice(0, count)
          remaining -= count
        })
        lastTarget = target
      }
      if (target < total) window.requestAnimationFrame(frame)
      else resolve()
    }
    window.requestAnimationFrame(frame)
  })
}

function typeHero () {
  const host = document.getElementById('hero-typewriter')
  const text = host?.dataset.text || ''
  if (!host || !text) return Promise.resolve()
  const markers = [
    ['complexity', 'word-problem'],
    ['into', 'word-bridge'],
    ['decisions', 'word-outcome']
  ]
  return typeSegmentsInto(host, buildTypewriterSegments(text, markers), HERO_TYPEWRITER_SPEED)
}

function triggerSlideTypewriter (slideIndex) {
  if (typedSlides.has(slideIndex)) return
  const slide = slides[slideIndex]
  const host = slide?.querySelector('[data-slide-typewriter]')
  const text = host?.dataset.text || ''
  if (!host || !text) return

  typedSlides.add(slideIndex)
  const cursor = slide.querySelector('[data-typewriter-cursor]')
  if (reducedMotion.matches) return
  if (cursor) cursor.hidden = false
  const segments = buildTypewriterSegments(text, SLIDE_COLOR_MARKERS[slideIndex])
  typeSegmentsInto(host, segments)
}

function syncNavigation () {
  const atStart = appState.currentSlide === 0
  const atEnd = appState.currentSlide === slides.length - 1

  previousButton.disabled = !appState.navigationReady || atStart || appState.transitioning
  nextButton.disabled = !appState.navigationReady || atEnd || appState.transitioning
  previousButton.setAttribute('aria-disabled', String(previousButton.disabled))
  nextButton.setAttribute('aria-disabled', String(nextButton.disabled))
  previousButton.classList.toggle('is-edge', atStart)
  nextButton.classList.toggle('is-edge', atEnd)

  slideDots.forEach((dot, index) => {
    const current = index === appState.currentSlide
    dot.disabled = !appState.navigationReady || appState.transitioning
    dot.classList.toggle('is-current', current)
    if (current) dot.setAttribute('aria-current', 'step')
    else dot.removeAttribute('aria-current')
  })

  const active = slides[appState.currentSlide]
  document.body.dataset.slideTheme = active?.classList.contains('slide--light') ? 'light' : 'dark'
  const contextLabel = document.getElementById('context-label')
  if (contextLabel && active?.dataset.slideLabel) contextLabel.textContent = active.dataset.slideLabel
  updateScrollCue()
}

function resizeVisiblePlots () {
  if (!appState.plotly) return
  const activeSlide = slides[appState.currentSlide]
  for (const host of activeSlide.querySelectorAll('[data-plot-host], [data-dcism-energy-chart], [data-dcism-load-chart], [data-dcism-day-chart], [data-dcism-training-chart], .dialog-plot')) {
    if (host.classList.contains('js-plotly-plot')) {
      try { appState.plotly.Plots.resize(host) } catch (error) { console.warn('Plot resize skipped:', error) }
    }
  }
}

function goToSlide (index, { focusHeading = true, announce = true } = {}) {
  if (!appState.navigationReady || appState.transitioning) return
  const target = Math.max(0, Math.min(slides.length - 1, index))
  if (target === appState.currentSlide) return

  appState.currentSlide = target
  appState.transitioning = true
  track.style.setProperty('--active-slide', String(target))
  window.history.replaceState(null, '', `#slide-${target}`)

  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === target
    slide.toggleAttribute('inert', !active)
    slide.setAttribute('aria-hidden', String(!active))
  })
  syncNavigation()
  triggerSlideTypewriter(target)

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    window.clearTimeout(finishTimer)
    track.removeEventListener('transitionend', handleTransitionEnd)
    appState.transitioning = false
    syncNavigation()
    resizeVisiblePlots()
    if (focusHeading) {
      const heading = slides[target].querySelector('h1, h2')
      heading?.focus({ preventScroll: true })
    }
    if (announce) announcement.textContent = `${slides[target].dataset.slideLabel} section`
  }

  const handleTransitionEnd = event => {
    if (event.target === track && event.propertyName === 'transform') finish()
  }
  const finishTimer = window.setTimeout(finish, 1000)

  if (reducedMotion.matches) finish()
  else track.addEventListener('transitionend', handleTransitionEnd)
}

function updateScrollCue () {
  const active = slides[appState.currentSlide]
  if (!active) return
  const canScroll = active.scrollHeight > active.clientHeight + 8
  const nearTop = active.scrollTop < 80
  const contentSlide = appState.currentSlide > 0 && appState.currentSlide < slides.length - 1
  scrollCue.classList.toggle('is-visible', canScroll && nearTop && contentSlide)
}

function setupNavigation () {
  appState.requestedSlide = parseRequestedSlide()
  slides.forEach((slide, index) => {
    const active = index === 0
    slide.toggleAttribute('inert', !active)
    slide.setAttribute('aria-hidden', String(!active))
    slide.addEventListener('scroll', updateScrollCue, { passive: true })
  })

  previousButton.addEventListener('click', () => goToSlide(appState.currentSlide - 1))
  nextButton.addEventListener('click', () => goToSlide(appState.currentSlide + 1))
  slideDots.forEach(dot => dot.addEventListener('click', () => goToSlide(Number(dot.dataset.slideTarget))))

  document.addEventListener('keydown', event => {
    if (document.getElementById('media-dialog')?.open || appState.fullscreenShell) return
    const interactive = event.target.closest('input, select, textarea, button, a, summary, [role="button"], [contenteditable="true"], .js-plotly-plot')
    if (interactive) return
    if (event.key === 'ArrowRight') goToSlide(appState.currentSlide + 1)
    if (event.key === 'ArrowLeft') goToSlide(appState.currentSlide - 1)
  })

  track.addEventListener('pointerdown', event => {
    if (!appState.navigationReady || event.pointerType === 'mouse') return
    if (event.target.closest('.js-plotly-plot, input, button, a, summary, [role="button"], dialog')) return
    appState.touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId }
  }, { passive: true })

  track.addEventListener('pointerup', event => {
    const start = appState.touchStart
    appState.touchStart = null
    if (!start || start.id !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return
    goToSlide(appState.currentSlide + (deltaX < 0 ? 1 : -1))
  }, { passive: true })

  window.addEventListener('resize', () => {
    updateScrollCue()
    window.requestAnimationFrame(resizeVisiblePlots)
  }, { passive: true })

  syncNavigation()
}

function loadPlotly () {
  if (window.Plotly) return Promise.resolve(window.Plotly)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PLOTLY_URL
    script.integrity = PLOTLY_INTEGRITY
    script.crossOrigin = 'anonymous'
    script.async = true
    script.addEventListener('load', () => resolve(window.Plotly), { once: true })
    script.addEventListener('error', () => reject(new Error('The interactive plotting library could not be loaded.')), { once: true })
    document.head.appendChild(script)
  })
}

async function preloadPlotly () {
  const response = await fetch(PLOTLY_URL, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache',
    integrity: PLOTLY_INTEGRITY
  })
  if (!response.ok) throw new Error(`The Plotly preload returned ${response.status}.`)
  await response.arrayBuffer()
}

async function downloadAsset (asset) {
  if (asset.kind === 'runtime') return preloadPlotly()
  const response = await fetch(asset.url, {
    cache: 'force-cache',
    headers: { Accept: asset.kind === 'data' ? 'application/json' : 'text/javascript' }
  })
  if (!response.ok) throw new Error(`${asset.label} returned ${response.status}.`)
  if (asset.kind === 'data') appState.downloadedPlotText.set(asset.id, await response.text())
  else await response.arrayBuffer()
}

async function getPlotSpec (id) {
  if (appState.plotSpecs.has(id)) return appState.plotSpecs.get(id)
  const module = appState.plotModule
  let spec
  if (typeof module?.getPlotSpec === 'function') spec = await module.getPlotSpec(id)
  else if (typeof module?.loadPlotSpec === 'function') spec = await module.loadPlotSpec(id)
  else if (module?.plotSpecs?.[id]) spec = module.plotSpecs[id]
  else if (module?.PLOT_SPECS?.[id]) spec = module.PLOT_SPECS[id]
  else if (module?.default?.[id]) spec = module.default[id]
  if (!spec) throw new Error(`No plot specification was found for “${id}”.`)
  appState.plotSpecs.set(id, spec)
  return spec
}

function createPlotFigure (spec, options = {}) {
  if (typeof appState.plotModule?.createPlotFigure === 'function') {
    return appState.plotModule.createPlotFigure(spec, options)
  }
  if (spec.figure) return spec.figure
  return spec
}

function plotConfig (spec = {}) {
  return {
    responsive: true,
    displaylogo: false,
    scrollZoom: false,
    doubleClick: 'reset',
    displayModeBar: false,
    ...spec.config
  }
}

function makeFullscreenButton (shell, host) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'fullscreen-button'
  button.textContent = 'Full screen'
  button.setAttribute('aria-pressed', 'false')
  button.addEventListener('click', () => {
    const opening = !shell.classList.contains('is-fullscreen')
    if (opening) openFullscreenPlot(shell, host, button)
    else closeFullscreenPlot()
  })
  return button
}

function openFullscreenPlot (shell, host, button) {
  if (appState.fullscreenShell) closeFullscreenPlot({ restoreFocus: false })
  appState.fullscreenOrigin = {
    parent: shell.parentNode,
    nextSibling: shell.nextSibling
  }
  document.body.append(shell)
  shell.classList.add('is-fullscreen')
  shell.setAttribute('role', 'dialog')
  shell.setAttribute('aria-modal', 'true')
  document.body.classList.add('has-fullscreen-plot')
  appState.fullscreenShell = shell
  button.textContent = 'Exit full screen'
  button.setAttribute('aria-pressed', 'true')
  window.requestAnimationFrame(() => appState.plotly?.Plots.resize(host))
}

function closeFullscreenPlot ({ restoreFocus = true } = {}) {
  const shell = appState.fullscreenShell
  if (!shell) return
  shell.classList.remove('is-fullscreen')
  shell.removeAttribute('role')
  shell.removeAttribute('aria-modal')
  document.body.classList.remove('has-fullscreen-plot')
  appState.fullscreenShell = null
  const origin = appState.fullscreenOrigin
  if (origin?.nextSibling?.parentNode === origin.parent) origin.parent.insertBefore(shell, origin.nextSibling)
  else origin?.parent?.append(shell)
  appState.fullscreenOrigin = null
  const button = shell.querySelector('.fullscreen-button')
  if (button) {
    button.textContent = 'Full screen'
    button.setAttribute('aria-pressed', 'false')
    if (restoreFocus) button.focus()
  }
  const host = shell.querySelector('[data-plot-host]')
  window.requestAnimationFrame(() => appState.plotly?.Plots.resize(host))
}

function makeTraceMenu (id, host, traces, controls = {}) {
  const details = document.createElement('details')
  details.className = 'plot-menu'
  const summary = document.createElement('summary')
  summary.textContent = controls.label || (id === 'basin' ? 'Choose formations' : 'Choose layers')
  const panel = document.createElement('div')
  panel.className = 'plot-menu__panel'
  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'plot-menu__search'
  search.placeholder = 'Filter options…'
  search.setAttribute('aria-label', 'Filter plot options')
  const actions = document.createElement('div')
  actions.className = 'plot-menu__actions'
  const allButton = document.createElement('button')
  const clearButton = document.createElement('button')
  const clearLabel = controls.actions?.includes('reset') ? 'Reset' : 'Clear'
  for (const [button, label] of [[allButton, 'Show all'], [clearButton, clearLabel]]) {
    button.type = 'button'
    button.className = 'plot-control'
    button.textContent = label
    actions.appendChild(button)
  }
  const list = document.createElement('div')
  list.className = 'plot-menu__list'

  const groupedItems = controls.kind === 'grouped-multi-toggle'
    ? controls.groups
    : [{ id: 'all', label: '', items: traces.map((trace, traceIndex) => ({ traceIndex, label: trace.name || `Layer ${traceIndex + 1}` })) }]

  groupedItems.forEach(group => {
    const groupElement = document.createElement('section')
    groupElement.className = 'plot-menu__group'
    if (group.label) {
      const heading = document.createElement('h4')
      heading.textContent = group.label
      groupElement.appendChild(heading)
    }
    group.items.forEach(item => {
    const index = Number(item.traceIndex)
    const trace = traces[index]
    const label = document.createElement('label')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = trace.visible !== false && trace.visible !== 'legendonly'
    checkbox.dataset.traceIndex = String(index)
    const text = document.createElement('span')
    text.textContent = item.label || trace.name || `Layer ${index + 1}`
    label.dataset.filterText = text.textContent.toLowerCase()
    label.append(checkbox, text)
    groupElement.appendChild(label)
    })
    list.appendChild(groupElement)
  })

  function setVisibility (checkbox, visible) {
    checkbox.checked = visible
    const index = Number(checkbox.dataset.traceIndex)
    if (typeof appState.plotModule?.setTraceVisibility === 'function') {
      appState.plotModule.setTraceVisibility(host, index, visible, appState.plotly)
    } else {
      appState.plotly.restyle(host, { visible }, [index])
    }
  }

  list.addEventListener('change', event => {
    if (event.target.matches('input[type="checkbox"]')) setVisibility(event.target, event.target.checked)
  })
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase()
    list.querySelectorAll('label').forEach(label => { label.hidden = !label.dataset.filterText.includes(query) })
  })
  allButton.addEventListener('click', () => list.querySelectorAll('input').forEach(input => setVisibility(input, true)))
  clearButton.addEventListener('click', () => {
    if (controls.actions?.includes('reset')) {
      list.querySelectorAll('input').forEach(input => setVisibility(input, true))
    } else {
      list.querySelectorAll('input').forEach(input => setVisibility(input, false))
    }
  })

  panel.append(search, actions, list)
  details.append(summary, panel)
  return details
}

function makeLayerButtons (host, spec, figure) {
  const group = document.createElement('div')
  group.className = 'plot-control-group'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Map layer')
  const labels = spec.meta?.layers || spec.layers || spec.controls?.layers || figure.data.map(trace => trace.name)

  labels.forEach((layer, index) => {
    const label = typeof layer === 'string' ? layer : layer.label || layer.name
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'plot-control'
    button.textContent = label
    button.setAttribute('aria-pressed', String(index === 0))
    button.addEventListener('click', async () => {
      group.querySelectorAll('button').forEach((item, itemIndex) => item.setAttribute('aria-pressed', String(itemIndex === index)))
      const layerId = typeof layer === 'string' ? layer : layer.id || layer.value || index
      if (typeof appState.plotModule?.setMapLayer === 'function') {
        await appState.plotModule.setMapLayer(host, spec, layerId, appState.plotly)
      } else {
        const visible = figure.data.map((_, traceIndex) => traceIndex === index)
        await appState.plotly.restyle(host, { visible })
      }
    })
    group.appendChild(button)
  })
  return group
}

function setupPlotControls (id, host, spec, figure) {
  const shell = document.querySelector(`[data-plot-shell="${id}"]`)
  const toolbar = document.querySelector(`[data-plot-controls="${id}"]`)
  if (!shell || !toolbar) return
  toolbar.replaceChildren()

  if (id === 'nevada') toolbar.appendChild(makeLayerButtons(host, spec, figure))
  else toolbar.appendChild(makeTraceMenu(id, host, figure.data, spec.controls))
  toolbar.appendChild(makeFullscreenButton(shell, host))
}

async function renderPlot (id) {
  const host = document.querySelector(`[data-plot-host="${id}"]`)
  const shell = document.querySelector(`[data-plot-shell="${id}"]`)
  if (!host || !shell) return
  try {
    const spec = await getPlotSpec(id)
    const figure = createPlotFigure(spec)
    if (typeof appState.plotModule?.renderPlot === 'function') {
      await appState.plotModule.renderPlot(host, spec, appState.plotly)
    } else {
      const layout = {
        autosize: true,
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        ...figure.layout
      }
      await appState.plotly.newPlot(host, figure.data, layout, plotConfig(figure))
    }
    setupPlotControls(id, host, spec, figure)
    shell.classList.add('is-ready')
    shell.classList.remove('has-error')
    appState.renderedPlots.set(id, host)
  } catch (error) {
    console.error(`Could not render ${id}:`, error)
    shell.classList.add('has-error')
    throw error
  }
}

function createPlotSupplement (spec) {
  if (!spec.controls) return null
  if (spec.controls.kind === 'stat-cards') {
    const list = document.createElement('dl')
    list.className = 'plot-supplement'
    for (const item of spec.controls.items) {
      const card = document.createElement('div')
      card.className = 'plot-stat'
      const term = document.createElement('dt')
      const value = document.createElement('dd')
      term.textContent = item.label
      value.textContent = `${Number(item.value).toFixed(2)}%`
      value.style.color = item.color
      card.append(term, value)
      list.appendChild(card)
    }
    const note = document.createElement('p')
    note.textContent = spec.summary?.convention || ''
    list.appendChild(note)
    return list
  }
  if (spec.controls.kind === 'external-legend') {
    const legend = document.createElement('div')
    legend.className = 'plot-supplement'
    legend.setAttribute('aria-label', 'Plot legend')
    for (const item of spec.controls.items) {
      const entry = document.createElement('span')
      entry.className = 'plot-legend-item'
      const swatch = document.createElement('span')
      swatch.className = `plot-legend-swatch${item.lineStyle ? ' is-line' : ''}`
      swatch.style.setProperty('--swatch', item.color)
      swatch.setAttribute('aria-hidden', 'true')
      entry.append(swatch, item.label)
      legend.appendChild(entry)
    }
    return legend
  }
  return null
}

async function renderDetailPlot (container, id, { compact = false } = {}) {
  const spec = await getPlotSpec(id)
  const shell = document.createElement('div')
  shell.className = compact ? 'preview-plot' : 'dialog-plot-shell'
  const supplement = compact ? null : createPlotSupplement(spec)
  const host = document.createElement('div')
  host.className = compact ? 'preview-plot' : 'dialog-plot'
  host.setAttribute('aria-label', spec.description || id)
  if (supplement) shell.appendChild(supplement)
  shell.appendChild(host)
  container.appendChild(shell)
  await appState.plotModule.renderPlot(host, spec, appState.plotly)
  return host
}

function triggerDetail (trigger) {
  return {
    kind: trigger.dataset.previewKind || (trigger.dataset.dialogImage ? 'image' : trigger.dataset.dialogKind === 'plot' ? 'plot' : 'document'),
    source: trigger.dataset.previewSrc || trigger.dataset.dialogImage || trigger.dataset.dialogDocument,
    id: trigger.dataset.previewId || trigger.dataset.dialogDocument?.split('/').pop().replace('.json', ''),
    title: trigger.dataset.previewTitle || trigger.dataset.dialogTitle || 'Project detail'
  }
}

async function fillDetailContainer (container, trigger, { compact = false } = {}) {
  const detail = triggerDetail(trigger)
  if (detail.kind === 'gallery') {
    const template = document.getElementById(trigger.dataset.previewTemplate)
    if (!(template instanceof HTMLTemplateElement)) throw new Error('The verification gallery is unavailable.')
    const gallery = template.content.cloneNode(true)
    container.classList.toggle('is-compact-gallery', compact)
    container.appendChild(gallery)
    return
  }
  if (detail.kind === 'image') {
    const image = new Image()
    image.src = detail.source
    image.alt = detail.title
    container.appendChild(image)
    return
  }
  if (detail.kind === 'plot') {
    await renderDetailPlot(container, detail.id, { compact })
    return
  }
  const iframe = document.createElement('iframe')
  iframe.src = detail.source
  iframe.title = detail.title
  container.appendChild(iframe)
}

function purgePlotsWithin (container) {
  if (!appState.plotly) return
  for (const plot of container.querySelectorAll('.js-plotly-plot')) {
    try { appState.plotly.purge(plot) } catch (_) {}
  }
}

function setupDialog () {
  const dialog = document.getElementById('media-dialog')
  const title = document.getElementById('dialog-title')
  const content = document.getElementById('dialog-content')
  const close = document.getElementById('dialog-close')

  function clearDialog () {
    purgePlotsWithin(content)
    content.classList.remove('is-compact-gallery')
    content.replaceChildren()
  }

  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', clearDialog)
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })

  document.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-preview-kind], [data-dialog-image], [data-dialog-document]')
    if (!trigger) return
    event.preventDefault()
    title.textContent = triggerDetail(trigger).title
    clearDialog()
    dialog.showModal()
    try {
      await fillDetailContainer(content, trigger)
    } catch (error) {
      content.textContent = 'This project detail could not be loaded.'
      console.error(error)
    }
  })

  document.addEventListener('keydown', event => {
    const trigger = event.target.closest('[data-preview-kind][role="button"]')
    if (!trigger || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    trigger.click()
  })
}

function setupInlinePreviews () {
  const preview = document.getElementById('inline-preview')
  const content = document.getElementById('inline-preview-content')
  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)')
  let activeTrigger = null
  let hideTimer = 0
  let renderToken = 0

  function hidePreview () {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      renderToken += 1
      activeTrigger = null
      preview.hidden = true
      preview.setAttribute('aria-hidden', 'true')
      purgePlotsWithin(content)
      content.classList.remove('is-compact-gallery')
      content.replaceChildren()
    }, 130)
  }

  async function showPreview (trigger) {
    if (!supportsHover.matches || activeTrigger === trigger) return
    window.clearTimeout(hideTimer)
    activeTrigger = trigger
    const token = ++renderToken
    purgePlotsWithin(content)
    content.classList.remove('is-compact-gallery')
    content.replaceChildren()
    preview.hidden = false
    preview.setAttribute('aria-hidden', 'false')
    preview.style.visibility = 'hidden'
    const rect = trigger.getBoundingClientRect()
    const width = preview.offsetWidth
    const height = preview.offsetHeight
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))
    const top = rect.bottom + 12 + height <= window.innerHeight ? rect.bottom + 12 : Math.max(8, rect.top - height - 12)
    preview.style.left = `${left}px`
    preview.style.top = `${top}px`
    preview.style.visibility = 'visible'
    try {
      await fillDetailContainer(content, trigger, { compact: true })
      if (token !== renderToken) return
      const plot = content.querySelector('.js-plotly-plot')
      if (plot) appState.plotly.Plots.resize(plot)
    } catch (error) {
      if (token === renderToken) content.textContent = 'Preview unavailable. Click to open the full view.'
      console.warn(error)
    }
  }

  document.addEventListener('pointerover', event => {
    const trigger = event.target.closest('[data-preview-kind]')
    if (trigger) showPreview(trigger)
  })
  document.addEventListener('pointerout', event => {
    const trigger = event.target.closest('[data-preview-kind]')
    if (trigger && !trigger.contains(event.relatedTarget)) hidePreview()
  })
  preview.addEventListener('pointerenter', () => window.clearTimeout(hideTimer))
  preview.addEventListener('pointerleave', hidePreview)
}

function setupDcismDemoV2 (root, dataset) {
  const plotly = appState.plotly
  const annualHost = root.querySelector('[data-dcism-energy-chart]')
  const loadHost = root.querySelector('[data-dcism-load-chart]')
  const dayHost = root.querySelector('[data-dcism-day-chart]')
  const trainingHost = root.querySelector('[data-dcism-training-chart]')
  if (!plotly || !annualHost || !loadHost || !dayHost || !trainingHost) return

  const colors = {
    demand: '#102033',
    solar: '#f1c40f',
    solarFill: 'rgba(241,196,15,.38)',
    grid: '#2980b9',
    battery: '#27ae60',
    curtailment: '#c0392b',
    cooling: '#27ae60',
    electrical: '#f08c00',
    house: '#868e96',
    muted: '#64788a',
    line: '#dbe3e9'
  }
  const plotOptions = { responsive: true, displaylogo: false, displayModeBar: false, scrollZoom: false }
  const selected = { day: 195, dispatch: null, components: null }
  const dates = Array.from({ length: 365 }, (_, index) => new Date(Date.UTC(dataset.year, 0, index + 1)).toISOString().slice(0, 10))

  function sum (values) {
    return values.reduce((total, value) => total + value, 0)
  }

  function aggregateDays (values) {
    return Array.from({ length: 365 }, (_, day) => {
      let total = 0
      const start = day * 24
      for (let hour = 0; hour < 24; hour += 1) total += values[start + hour]
      return total
    })
  }

  function dispatchEnergy (demand, unitSolar, solarShare, batteryHours) {
    const demandEnergy = sum(demand)
    const solarCapacityMwDc = solarShare * demandEnergy / sum(unitSolar)
    const solar = unitSolar.map(value => value * solarCapacityMwDc)
    const peakDemand = Math.max(...demand)
    const batteryCapacityMwh = batteryHours * peakDemand
    const batteryPowerMw = batteryHours ? peakDemand : 0
    const efficiency = Math.sqrt(dataset.energyAssumptions.batteryRoundTripEfficiency)
    const grid = new Array(demand.length).fill(0)
    const directSolar = new Array(demand.length).fill(0)
    const batteryCharge = new Array(demand.length).fill(0)
    const batteryDischarge = new Array(demand.length).fill(0)
    const curtailed = new Array(demand.length).fill(0)
    const batterySoc = new Array(demand.length).fill(0)
    let soc = 0

    demand.forEach((load, index) => {
      const generation = solar[index]
      if (generation >= load) {
        directSolar[index] = load
        let excess = generation - load
        if (batteryCapacityMwh > 0 && soc < batteryCapacityMwh) {
          const charge = Math.min(excess, batteryPowerMw, (batteryCapacityMwh - soc) / efficiency)
          batteryCharge[index] = charge
          soc += charge * efficiency
          excess -= charge
        }
        curtailed[index] = excess
      } else {
        directSolar[index] = generation
        let deficit = load - generation
        if (batteryCapacityMwh > 0 && soc > 0) {
          const discharge = Math.min(deficit, batteryPowerMw, soc * efficiency)
          batteryDischarge[index] = discharge
          soc -= discharge / efficiency
          deficit -= discharge
        }
        grid[index] = deficit
      }
      batterySoc[index] = soc
    })

    return {
      demand,
      solar,
      grid,
      directSolar,
      batteryCharge,
      batteryDischarge,
      curtailed,
      batterySoc,
      solarCapacityMwDc,
      batteryCapacityMwh,
      demandEnergy,
      renewableEnergy: sum(directSolar) + sum(batteryDischarge)
    }
  }

  function annualLayout () {
    return {
      height: 390,
      margin: { t: 28, r: 16, b: 52, l: 68 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      hovermode: 'x unified',
      clickmode: 'event',
      legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 11, color: colors.muted } },
      xaxis: { title: { text: '2026' }, gridcolor: colors.line, tickformat: '%b', dtick: 'M1', fixedrange: true },
      yaxis: { title: { text: 'Energy (MWh/day)' }, gridcolor: colors.line, rangemode: 'tozero', fixedrange: true },
      font: { family: 'Portfolio Inter, system-ui, sans-serif', color: colors.muted, size: 12 },
      shapes: [{
        type: 'line', x0: dates[selected.day], x1: dates[selected.day], y0: 0, y1: 1, yref: 'paper',
        line: { color: colors.demand, width: 1.5, dash: 'dot' }
      }]
    }
  }

  function dailyLayout (dateLabel) {
    return {
      height: 300,
      margin: { t: 24, r: 16, b: 52, l: 62 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      hovermode: 'x unified',
      barmode: 'relative',
      legend: { orientation: 'h', x: 0, y: 1.15, font: { size: 10, color: colors.muted } },
      xaxis: { title: { text: dateLabel }, tickmode: 'array', tickvals: [0, 6, 12, 18, 23], ticktext: ['00:00', '06:00', '12:00', '18:00', '24:00'], gridcolor: colors.line, fixedrange: true },
      yaxis: { title: { text: 'Power (MW)' }, gridcolor: colors.line, zerolinecolor: '#9aacba', fixedrange: true },
      font: { family: 'Portfolio Inter, system-ui, sans-serif', color: colors.muted, size: 12 }
    }
  }

  async function renderDay (day = selected.day) {
    if (!selected.dispatch || !selected.components) return
    selected.day = Math.max(0, Math.min(364, day))
    const start = selected.day * 24
    const slice = values => values.slice(start, start + 24)
    const hours = Array.from({ length: 24 }, (_, hour) => hour)
    const date = new Date(`${dates[selected.day]}T12:00:00Z`)
    const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    root.querySelector('[data-dcism-day-title]').textContent = `Hourly dispatch · ${dateLabel}`
    const dispatchTraces = [
      { x: hours, y: slice(selected.dispatch.solar), name: 'Solar generation', type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { color: colors.solar, width: 2 }, fillcolor: colors.solarFill, hovertemplate: '%{y:.1f} MW<extra>Solar generation</extra>' },
      { x: hours, y: slice(selected.dispatch.demand), name: 'Facility demand', type: 'scatter', mode: 'lines', line: { color: colors.demand, width: 3 }, hovertemplate: '%{y:.1f} MW<extra>Facility demand</extra>' },
      { x: hours, y: slice(selected.dispatch.grid), name: 'Grid import', type: 'scatter', mode: 'lines', line: { color: colors.grid, width: 2.2 }, hovertemplate: '%{y:.1f} MW<extra>Grid import</extra>' },
      { x: hours, y: slice(selected.dispatch.batteryDischarge), name: 'Battery discharge', type: 'bar', marker: { color: colors.battery }, opacity: .72, hovertemplate: '%{y:.1f} MW<extra>Battery discharge</extra>' },
      { x: hours, y: slice(selected.dispatch.batteryCharge).map(value => -value), name: 'Battery charge', type: 'bar', marker: { color: colors.battery }, opacity: .35, hovertemplate: '%{y:.1f} MW<extra>Battery charge</extra>' }
    ]
    const dailyDemand = slice(selected.dispatch.demand)
    const dailyIt = slice(selected.components.itMw)
    const dailyCooling = slice(selected.components.coolingMw)
    const dailyHouse = Array(24).fill(selected.components.houseMw)
    const dailyElectrical = dailyDemand.map((value, index) => Math.max(0, value - dailyIt[index] - dailyCooling[index] - dailyHouse[index]))
    const componentDefinitions = [
      [dailyIt, 'IT load', colors.grid],
      [dailyCooling, 'Cooling', colors.cooling],
      [dailyElectrical, 'Electrical losses', colors.electrical],
      [dailyHouse, 'House load', colors.house]
    ]
    const loadTraces = componentDefinitions.map(([values, name, color]) => ({
      x: hours,
      y: values,
      name,
      type: 'scatter',
      mode: 'lines',
      stackgroup: 'facility',
      line: { color, width: 1.4 },
      hovertemplate: `%{y:.1f} MW<extra>${name}</extra>`
    }))
    loadTraces.push({
      x: hours,
      y: dailyDemand,
      name: 'Total demand',
      type: 'scatter',
      mode: 'lines',
      line: { color: colors.demand, width: 2.6 },
      hovertemplate: '%{y:.1f} MW<extra>Total demand</extra>'
    })
    await Promise.all([
      plotly.react(loadHost, loadTraces, dailyLayout(dateLabel), plotOptions),
      plotly.react(dayHost, dispatchTraces, dailyLayout(dateLabel), plotOptions)
    ])
  }

  async function renderAnnual () {
    const facilityKey = root.querySelector('[data-dcism-facility]').value
    const siteKey = root.querySelector('[data-dcism-site]').value
    const solarShare = Number(root.querySelector('[data-dcism-solar-share]').value)
    const batteryHours = Number(root.querySelector('[data-dcism-battery-hours]').value)
    const facility = dataset.facilities[facilityKey]
    const site = dataset.sites[siteKey]
    const scenario = dataset.demand[facilityKey][siteKey]
    selected.dispatch = dispatchEnergy(scenario.powerMw, dataset.solar[siteKey].unitPowerMw, solarShare, batteryHours)
    selected.components = {
      ...dataset.facilityComponents[facilityKey],
      coolingMw: scenario.coolingMw
    }
    const daily = Object.fromEntries(['demand', 'solar', 'grid', 'batteryDischarge', 'curtailed'].map(key => [key, aggregateDays(selected.dispatch[key])]))
    const traces = [
      { x: dates, y: daily.solar, name: 'Solar generation', type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { color: colors.solar, width: 1.8 }, fillcolor: colors.solarFill, hovertemplate: '%{y:,.0f} MWh<extra>Solar generation</extra>' },
      { x: dates, y: daily.demand, name: 'Facility demand', type: 'scatter', mode: 'lines', line: { color: colors.demand, width: 2.5 }, hovertemplate: '%{y:,.0f} MWh<extra>Facility demand</extra>' },
      { x: dates, y: daily.grid, name: 'Grid import', type: 'scatter', mode: 'lines', line: { color: colors.grid, width: 2 }, hovertemplate: '%{y:,.0f} MWh<extra>Grid import</extra>' },
      { x: dates, y: daily.batteryDischarge, name: 'Battery discharge', type: 'scatter', mode: 'lines', line: { color: colors.battery, width: 1.8 }, hovertemplate: '%{y:,.0f} MWh<extra>Battery discharge</extra>' },
      { x: dates, y: daily.curtailed, name: 'Solar curtailed', type: 'scatter', mode: 'lines', line: { color: colors.curtailment, width: 1.6, dash: 'dot' }, hovertemplate: '%{y:,.0f} MWh<extra>Solar curtailed</extra>' }
    ]
    await plotly.react(annualHost, traces, annualLayout(), plotOptions)
    if (typeof annualHost.removeAllListeners === 'function') annualHost.removeAllListeners('plotly_click')
    annualHost.on?.('plotly_click', event => {
      const point = event.points?.[0]
      if (Number.isInteger(point?.pointNumber)) {
        selected.day = point.pointNumber
        renderAnnualSelection()
      }
    })

    const solarEnergy = sum(selected.dispatch.solar)
    const gridEnergy = sum(selected.dispatch.grid)
    const curtailedEnergy = sum(selected.dispatch.curtailed)
    root.querySelector('[data-dcism-value="solar-capacity"]').textContent = `${selected.dispatch.solarCapacityMwDc.toFixed(1)} MWdc`
    root.querySelector('[data-dcism-value="solar-energy"]').textContent = `${(solarEnergy / 1000).toFixed(1)} GWh`
    root.querySelector('[data-dcism-value="renewable"]').textContent = `${(100 * selected.dispatch.renewableEnergy / selected.dispatch.demandEnergy).toFixed(1)}%`
    root.querySelector('[data-dcism-value="grid"]').textContent = `${(gridEnergy / 1000).toFixed(1)} GWh`
    root.querySelector('[data-dcism-heading]').textContent = `${facility.name} · ${site.name} · solar plus storage`
    root.querySelector('[data-dcism-battery]').textContent = batteryHours ? `${selected.dispatch.batteryCapacityMwh.toFixed(1)} MWh battery` : 'No battery'
    root.querySelector('[data-dcism-curtailment]').textContent = `${(curtailedEnergy / 1000).toFixed(1)} GWh curtailed`
    await renderDay()
  }

  async function renderAnnualSelection () {
    const layout = annualLayout()
    await plotly.relayout(annualHost, { shapes: layout.shapes })
    await renderDay()
  }

  function formatDuration (days) {
    const hours = days * 24
    if (hours < 1) return `${Math.round(hours * 60)} min`
    if (days < 1) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`
    if (days < 365) return `${days.toFixed(days < 10 ? 1 : 0)} d`
    return `${(days / 365.25).toFixed(1)} yr`
  }

  async function renderTraining () {
    const facilityEntries = Object.entries(dataset.facilities)
    const modelNames = dataset.workloads.map(workload => workload.name)
    const traces = facilityEntries.map(([facilityKey, facility]) => {
      const estimates = dataset.workloads.map(workload => dataset.training[facilityKey][workload.key])
      const days = estimates.map(estimate => estimate.days)
      return {
        x: modelNames,
        y: days.map(value => value * 24),
        name: facility.name,
        type: 'bar',
        marker: { color: facility.chartColor, line: { color: facilityKey === 'stargate_phase_1' ? '#9a7d0a' : facility.chartColor, width: 1 } },
        text: days.map(formatDuration),
        textposition: 'outside',
        cliponaxis: false,
        customdata: estimates.map((estimate, index) => [formatDuration(estimate.days), facility.gpuCount.toLocaleString('en-US'), facility.gpu, dataset.workloads[index].kind === 'moe' ? 'active-parameter MoE' : 'dense transformer']),
        hovertemplate: '<b>%{x}</b><br>' + facility.name + '<br>%{customdata[0]} estimated training time<br>%{customdata[1]} %{customdata[2]} GPUs<br>%{customdata[3]}<extra></extra>'
      }
    })
    const layout = {
      height: 500,
      margin: { t: 30, r: 18, b: 105, l: 76 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      barmode: 'group',
      bargap: .2,
      bargroupgap: .06,
      hovermode: 'closest',
      legend: { orientation: 'h', x: 0, y: 1.11, font: { size: 11, color: colors.muted } },
      xaxis: { title: { text: 'Published model workload' }, tickangle: -18, fixedrange: true },
      yaxis: {
        type: 'log',
        range: [-1.25, 4.35],
        title: { text: 'Estimated training time' },
        tickmode: 'array',
        tickvals: [1 / 12, 1, 24, 168, 720, 8766],
        ticktext: ['5 min', '1 hour', '1 day', '1 week', '1 month', '1 year'],
        gridcolor: colors.line,
        fixedrange: true
      },
      uniformtext: { mode: 'hide', minsize: 9 },
      font: { family: 'Portfolio Inter, system-ui, sans-serif', color: colors.muted, size: 12 }
    }
    await plotly.react(trainingHost, traces, layout, plotOptions)
  }

  const viewButtons = Array.from(root.querySelectorAll('[data-dcism-view]'))
  function selectView (view, { focus = false } = {}) {
    viewButtons.forEach(button => {
      const active = button.dataset.dcismView === view
      button.setAttribute('aria-selected', String(active))
      button.tabIndex = active ? 0 : -1
      if (active && focus) button.focus()
    })
    root.querySelectorAll('[data-dcism-panel]').forEach(panel => { panel.hidden = panel.dataset.dcismPanel !== view })
    const status = root.querySelector('[data-dcism-status]')
    if (view === 'training') {
      root.querySelector('[data-dcism-heading]').textContent = 'Published model workloads · four facility templates'
      status.textContent = 'DC-ISM roofline estimate'
      renderTraining().then(() => plotly.Plots.resize(trainingHost))
    } else {
      status.textContent = `${dataset.hours.toLocaleString('en-US')} hourly states`
      renderAnnual().then(() => {
        plotly.Plots.resize(annualHost)
        plotly.Plots.resize(loadHost)
        plotly.Plots.resize(dayHost)
      })
    }
  }

  root.querySelectorAll('[data-dcism-facility], [data-dcism-site], [data-dcism-solar-share], [data-dcism-battery-hours]').forEach(control => control.addEventListener('change', renderAnnual))
  viewButtons.forEach((button, index) => {
    button.addEventListener('click', () => selectView(button.dataset.dcismView))
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      let nextIndex = index
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + viewButtons.length) % viewButtons.length
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % viewButtons.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = viewButtons.length - 1
      selectView(viewButtons[nextIndex].dataset.dcismView, { focus: true })
    })
  })
  selectView('training')
}

function setupDcismDemo (dataset) {
  const root = document.querySelector('[data-dcism-demo]')
  const chart = root?.querySelector('[data-dcism-chart]')
  if (!root) return
  if (dataset?.schemaVersion === 2) {
    setupDcismDemoV2(root, dataset)
    return
  }
  if (!chart || dataset?.schemaVersion !== 1) return

  const svgNamespace = 'http://www.w3.org/2000/svg'
  const width = 900
  const height = 300
  const margins = { top: 18, right: 18, bottom: 42, left: 62 }
  const plotWidth = width - margins.left - margins.right
  const plotHeight = height - margins.top - margins.bottom
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const trainingAssumptions = {
    computeFactor: 6,
    h100DenseBf16Flops: 989e12,
    modelFlopsUtilization: 0.40,
    secondsPerDay: 86400
  }

  const svgNode = (name, attributes = {}) => {
    const node = document.createElementNS(svgNamespace, name)
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
    return node
  }

  function drawScenario (scenario) {
    const averages = scenario.monthly.averageMw
    const peaks = scenario.monthly.peakMw
    const yMaximum = Math.ceil(Math.max(...peaks) * 1.08 / 10) * 10
    const x = index => margins.left + (index / 11) * plotWidth
    const y = value => margins.top + plotHeight - (value / yMaximum) * plotHeight
    const linePath = values => values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
    const areaPath = values => `${linePath(values)} L${x(11).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
    const title = svgNode('title')
    title.textContent = 'Monthly average and peak facility demand'
    const description = svgNode('desc')
    description.textContent = `The modeled facility peaks at ${scenario.peakMw.toFixed(2)} megawatts with annual PUE ${scenario.pue.toFixed(3)}. The monthly profile shows seasonal cooling effects across 8,760 hours.`
    chart.replaceChildren(title, description)

    for (const fraction of [0, .25, .5, .75, 1]) {
      const value = yMaximum * fraction
      const tickY = y(value)
      chart.appendChild(svgNode('line', { x1: margins.left, x2: width - margins.right, y1: tickY, y2: tickY, class: 'dcism-grid' }))
      const label = svgNode('text', { x: margins.left - 10, y: tickY + 5, 'text-anchor': 'end' })
      label.textContent = Number.isInteger(value) ? String(value) : value.toFixed(1)
      chart.appendChild(label)
    }
    months.forEach((month, index) => {
      const label = svgNode('text', { x: x(index), y: height - 13, 'text-anchor': index === 0 ? 'start' : index === 11 ? 'end' : 'middle' })
      label.textContent = month
      chart.appendChild(label)
    })
    chart.appendChild(svgNode('line', { x1: margins.left, x2: margins.left, y1: margins.top, y2: height - margins.bottom, class: 'dcism-axis' }))
    chart.appendChild(svgNode('line', { x1: margins.left, x2: width - margins.right, y1: height - margins.bottom, y2: height - margins.bottom, class: 'dcism-axis' }))
    const axisLabel = svgNode('text', { x: 15, y: height / 2, transform: `rotate(-90 15 ${height / 2})`, 'text-anchor': 'middle' })
    axisLabel.textContent = 'Facility demand (MW)'
    chart.appendChild(axisLabel)
    chart.appendChild(svgNode('path', { d: areaPath(averages), class: 'dcism-area' }))
    chart.appendChild(svgNode('path', { d: linePath(averages), class: 'dcism-average' }))
    chart.appendChild(svgNode('path', { d: linePath(peaks), class: 'dcism-peak' }))
    averages.forEach((value, index) => chart.appendChild(svgNode('circle', { cx: x(index), cy: y(value), r: 3.2, class: 'dcism-average-point' })))
    peaks.forEach((value, index) => chart.appendChild(svgNode('circle', { cx: x(index), cy: y(value), r: 3, class: 'dcism-peak-point' })))
  }

  function selectedScenario () {
    const facilityKey = root.querySelector('[data-dcism-facility]')?.value
    const siteKey = root.querySelector('[data-dcism-site]')?.value
    const coolingKey = root.querySelector('[data-dcism-cooling]')?.value
    const scenario = dataset.scenarios?.[facilityKey]?.[siteKey]?.[coolingKey]
    return { facilityKey, siteKey, coolingKey, scenario }
  }

  function updateDemand () {
    const { facilityKey, siteKey, coolingKey, scenario } = selectedScenario()
    if (!scenario) return
    const facility = dataset.facilities[facilityKey]
    const site = dataset.sites[siteKey]
    const cooling = dataset.cooling[coolingKey]
    root.querySelector('[data-dcism-value="pue"]').textContent = scenario.pue.toFixed(3)
    root.querySelector('[data-dcism-value="peak"]').textContent = `${scenario.peakMw.toFixed(2)} MW`
    root.querySelector('[data-dcism-value="energy"]').textContent = `${scenario.energyGwh.toFixed(1)} GWh`
    root.querySelector('[data-dcism-value="water"]').textContent = `${Math.round(scenario.waterM3).toLocaleString('en-US')} m³`
    root.querySelector('[data-dcism-summary]').textContent = `Monthly average and peak · ${dataset.hours.toLocaleString('en-US')} modeled hours`
    root.querySelector('[data-dcism-cost]').textContent = `$${(scenario.powerCostUsd / 1e6).toFixed(2)}M modeled power bill`
    root.querySelector('[data-dcism-flex]').textContent = `${scenario.flexibilityMw.toFixed(2)} MW flexibility offer`
    root.querySelector('[data-dcism-constraints]').textContent = scenario.constraintCount
      ? `${scenario.constraintCount} site constraint${scenario.constraintCount === 1 ? '' : 's'} flagged`
      : 'No site constraints flagged'
    root.querySelector('[data-dcism-heading]').textContent = `${facility.name} · ${site.name} · ${cooling.name.toLowerCase()}`
    drawScenario(scenario)
  }

  function formatTrainingFlops (value) {
    const exponent = Math.floor(Math.log10(value))
    const coefficient = value / (10 ** exponent)
    return `${coefficient.toFixed(2)}e${exponent} FLOPs`
  }

  function formatTrainingTime (days) {
    if (days < 1) return `${(days * 24).toFixed(days * 24 < 10 ? 1 : 0)} hours`
    if (days < 365) return `${days.toFixed(days < 100 ? 1 : 0)} days`
    return `${(days / 365.25).toFixed(1)} years`
  }

  function updateTrainingScale () {
    const gpuCount = Number(root.querySelector('[data-dcism-gpus]')?.value)
    if (!gpuCount) return
    const rows = Array.from(root.querySelectorAll('[data-dcism-model]'))
    const values = rows.map(row => {
      const parameters = Number(row.dataset.activeParameters)
      const tokens = Number(row.dataset.tokens)
      const flops = trainingAssumptions.computeFactor * parameters * tokens
      const effectiveFlopsPerSecond = gpuCount * trainingAssumptions.h100DenseBf16Flops * trainingAssumptions.modelFlopsUtilization
      const days = flops / effectiveFlopsPerSecond / trainingAssumptions.secondsPerDay
      return { row, flops, days }
    })
    const logarithms = values.map(item => Math.log10(item.flops))
    const minimumLog = Math.min(...logarithms)
    const maximumLog = Math.max(...logarithms)
    values.forEach(({ row, flops, days }) => {
      row.querySelector('[data-dcism-flops]').textContent = formatTrainingFlops(flops)
      row.querySelector('[data-dcism-days]').textContent = formatTrainingTime(days)
      const width = 14 + 86 * (Math.log10(flops) - minimumLog) / (maximumLog - minimumLog)
      row.querySelector('[data-dcism-bar]').style.width = `${width.toFixed(1)}%`
    })
  }

  const viewButtons = Array.from(root.querySelectorAll('[data-dcism-view]'))
  function selectView (view, { focus = false } = {}) {
    viewButtons.forEach(button => {
      const selected = button.dataset.dcismView === view
      button.setAttribute('aria-selected', String(selected))
      button.tabIndex = selected ? 0 : -1
      if (selected && focus) button.focus()
    })
    root.querySelectorAll('[data-dcism-panel]').forEach(panel => {
      panel.hidden = panel.dataset.dcismPanel !== view
    })
    const heading = root.querySelector('[data-dcism-heading]')
    const status = root.querySelector('[data-dcism-status]')
    if (view === 'training') {
      heading.textContent = 'Named LLM pretraining workloads · configurable H100 cluster'
      status.textContent = '6NDT planning estimate'
      updateTrainingScale()
    } else {
      status.textContent = `${dataset.hours.toLocaleString('en-US')} hourly states`
      updateDemand()
    }
  }

  root.querySelectorAll('[data-dcism-facility], [data-dcism-site], [data-dcism-cooling]').forEach(select => select.addEventListener('change', updateDemand))
  root.querySelector('[data-dcism-gpus]')?.addEventListener('change', updateTrainingScale)
  viewButtons.forEach((button, index) => {
    button.addEventListener('click', () => selectView(button.dataset.dcismView))
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      let nextIndex = index
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + viewButtons.length) % viewButtons.length
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % viewButtons.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = viewButtons.length - 1
      selectView(viewButtons[nextIndex].dataset.dcismView, { focus: true })
    })
  })
  updateDemand()
  updateTrainingScale()
}

async function mountSierra () {
  const host = document.querySelector('[data-sierra-demo]')
  if (!host) return
  const module = appState.sierraModule
  if (typeof module?.mountSierra === 'function') await module.mountSierra(host, appState.plotly)
  else if (typeof module?.mountSierraModel === 'function') await module.mountSierraModel(host, appState.plotly)
  else if (typeof module?.mountSierraDemo === 'function') await module.mountSierraDemo(host, appState.plotly)
  else if (typeof module?.mount === 'function') await module.mount(host, appState.plotly)
  else if (typeof module?.default === 'function') await module.default(host, appState.plotly)
  else throw new Error('The Sierra demo module did not expose a mount function.')
}

function prepareReducedMotionMedia () {
  if (!reducedMotion.matches) return
  document.querySelectorAll('video[autoplay]').forEach(video => {
    video.removeAttribute('autoplay')
    video.pause()
  })
}

async function preparePortfolio () {
  let downloaded = 0
  const failures = []
  setProgress(progress.download, 0, DOWNLOAD_TOTAL, 'Downloading', 'Interactive assets')
  setProgress(progress.build, 0, BUILD_TOTAL, 'Initializing', 'Waiting for downloads')

  const downloadPromise = Promise.all(DOWNLOAD_ASSETS.map(async asset => {
    try {
      await downloadAsset(asset)
    } catch (error) {
      failures.push(error)
      console.warn(`Could not preload ${asset.label}:`, error)
    } finally {
      downloaded += 1
      setProgress(progress.download, downloaded, DOWNLOAD_TOTAL, 'Downloading', asset.label)
    }
  }))

  try {
    await Promise.all([downloadPromise, portfolioFontReady])
    setProgress(progress.build, 0, BUILD_TOTAL, 'Initializing', 'Interactive model code')

    ;[appState.plotModule, appState.sierraModule, appState.plotly] = await Promise.all([
      import(DATA_MODULE_URL),
      import(SIERRA_MODULE_URL),
      loadPlotly()
    ])

    for (const id of PLOT_IDS) {
      const source = appState.downloadedPlotText.get(id)
      if (!source) continue
      try {
        const spec = JSON.parse(source)
        if (spec.schemaVersion !== 1) throw new Error(`Unsupported ${id} plot schema: ${spec.schemaVersion}`)
        appState.plotSpecs.set(id, spec)
      } catch (error) {
        failures.push(error)
        console.warn(`Could not prepare ${id} plot data:`, error)
      }
    }

    const dcismSource = appState.downloadedPlotText.get('dcism')
    if (dcismSource) {
      try {
        setupDcismDemo(JSON.parse(dcismSource))
      } catch (error) {
        failures.push(error)
        console.warn('Could not prepare DC-ISM annual scenario data:', error)
      }
    }

    let built = 0
    for (const [kind, id, label] of [
      ['sierra', '', 'Sierra finance model'],
      ['plot', 'basin', 'Basin formation model'],
      ['plot', 'nevada', 'Nevada favorability model'],
      ['plot', 'forge', 'FORGE stimulation model']
    ]) {
      await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))
      try {
        if (kind === 'sierra') await mountSierra()
        else await renderPlot(id)
      } catch (error) {
        failures.push(error)
        console.error(error)
      }
      built += 1
      setProgress(progress.build, built, BUILD_TOTAL, 'Initializing', label)
    }

    setProgress(progress.download, DOWNLOAD_TOTAL, DOWNLOAD_TOTAL, 'Downloaded', 'Interactive assets')
    setProgress(progress.build, BUILD_TOTAL, BUILD_TOTAL, 'Initialized', failures.length ? `${failures.length} static fallback${failures.length === 1 ? '' : 's'} available` : 'Interactive portfolio')
  } catch (error) {
    failures.push(error)
    console.error('Interactive preparation failed:', error)
    document.querySelectorAll('[data-plot-shell]').forEach(shell => shell.classList.add('has-error'))
    setProgress(progress.build, BUILD_TOTAL, BUILD_TOTAL, 'Initialized', 'Static fallbacks available')
  } finally {
    if (!reducedMotion.matches) await new Promise(resolve => window.setTimeout(resolve, 260))
    progress.panel.classList.add('is-complete')
    if (!reducedMotion.matches) await new Promise(resolve => window.setTimeout(resolve, 420))
    appState.navigationReady = true
    appState.transitioning = false
    syncNavigation()
    if (appState.requestedSlide > 0) goToSlide(appState.requestedSlide, { focusHeading: false, announce: false })
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && appState.fullscreenShell) closeFullscreenPlot()
})

setupNavigation()
setupDialog()
setupInlinePreviews()
prepareReducedMotionMedia()
preparePortfolio().then(typeHero)
