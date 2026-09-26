import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, ExternalLink, FileCheck2, FolderOpen, History, LoaderCircle, Monitor, Moon, RotateCcw, ShieldAlert, ShieldCheck, Sparkles, Sun, Trash2, Youtube, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

type Theme = 'light' | 'dark' | 'system'
type ProgressEngine = 'standard' | 'cyberpunk'
type DownloadStatus = 'queued' | 'downloading' | 'complete' | 'error'

type DownloadTask = {
  id: string
  url: string
  filename?: string
  outputPath?: string
  progress: number
  status: DownloadStatus
  message: string
  speed?: string
  eta?: string
  error?: string
  filePath?: string
  verification?: DownloadVerification
}

type ServerEvent = {
  type: 'started' | 'progress' | 'verifying' | 'complete' | 'error'
  message?: string
  percent?: number
  speed?: string
  eta?: string
  filePath?: string
  verification?: DownloadVerification
}

type AppConfig = { downloadPath: string }
type VideoMetadata = { title: string }
type DownloadVerification = { status: 'verified' | 'warning'; message: string }
type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<{ name: string }>
}

const themeKey = 'youtube-downloader-theme'
const downloadPathKey = 'youtube-downloader-last-path'
const historyKey = 'youtube-downloader-history'
const progressEngineKey = 'chrono-stream:ui-engine'

function normalizeWindowsPath(value: string) {
  return value.replaceAll('/', '\\').replace(/\\+$/, '')
}

function revealFileUrl(filePath: string) {
  return `youtube-downloader://reveal/${encodeURIComponent(filePath)}`
}

function loadHistory(): DownloadTask[] {
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey) || '[]') as unknown
    if (!Array.isArray(saved)) return []
    return saved.filter((item): item is DownloadTask => Boolean(item && typeof item === 'object' && (item as DownloadTask).status === 'complete'))
  } catch {
    return []
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

async function consumeEventStream(response: Response, onEvent: (event: ServerEvent) => void) {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || `Falha HTTP ${response.status}.`)
  }
  if (!response.body) throw new Error('O navegador não disponibilizou o fluxo de progresso.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const frames = buffer.split(/\r?\n\r?\n/)
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')
      if (data) onEvent(JSON.parse(data) as ServerEvent)
    }
    if (done) break
  }
}

function App() {
  const [url, setUrl] = useState('')
  const [filename, setFilename] = useState('')
  const [outputPath, setOutputPath] = useState(() => localStorage.getItem(downloadPathKey) || '')
  const [videosPath, setVideosPath] = useState('')
  const [destinationHint, setDestinationHint] = useState('')
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(themeKey) as Theme | null) || 'system')
  const [progressEngine, setProgressEngine] = useState<ProgressEngine>(() => (localStorage.getItem(progressEngineKey) as ProgressEngine | null) || 'standard')
  const [downloads, setDownloads] = useState<DownloadTask[]>([])
  const [history, setHistory] = useState<DownloadTask[]>(loadHistory)
  const lastClipboardRef = useRef('')

  const hasActiveDownloads = downloads.some((item) => item.status === 'queued' || item.status === 'downloading')
  const downloadCards = [...downloads, ...history]

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(themeKey, theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => theme === 'system' && applyTheme(theme)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(downloadPathKey, outputPath)
  }, [outputPath])

  useEffect(() => {
    localStorage.setItem(historyKey, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    localStorage.setItem(progressEngineKey, progressEngine)
  }, [progressEngine])

  useEffect(() => {
    void fetch('/api/config')
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<AppConfig>
      })
      .then((config) => {
        const normalizedVideosPath = normalizeWindowsPath(config.downloadPath)
        setVideosPath(normalizedVideosPath)
        const savedPath = localStorage.getItem(downloadPathKey)
        setOutputPath(normalizeWindowsPath(savedPath || normalizedVideosPath))
      })
      .catch(() => setDestinationHint('Não foi possível identificar a pasta Vídeos do sistema.'))
  }, [])

  useEffect(() => {
    const videoUrl = url.trim()
    if (!videoUrl || filename.trim()) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetch(`/api/metadata?url=${encodeURIComponent(videoUrl)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error()
          return response.json() as Promise<VideoMetadata>
        })
        .then((metadata) => setFilename((current) => current || metadata.title))
        .catch(() => undefined)
    }, 500)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [url, filename])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasActiveDownloads) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasActiveDownloads])

  useEffect(() => {
    const pollClipboard = async () => {
      try {
        const value = (await navigator.clipboard.readText()).trim()
        if (/^https?:\/\//i.test(value) && value !== lastClipboardRef.current && document.activeElement?.id !== 'url') {
          lastClipboardRef.current = value
          setUrl(value)
        }
      } catch {
        // Clipboard polling requires browser permission and a trustworthy origin.
      }
    }
    void pollClipboard()
    const timer = window.setInterval(() => void pollClipboard(), 2_000)
    return () => window.clearInterval(timer)
  }, [])

  const updateTask = (id: string, patch: Partial<DownloadTask>) => {
    setDownloads((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const queueDownload = async (requestUrl: string, requestedFilename?: string, requestedOutputPath?: string) => {
    if (!requestUrl) return

    const id = crypto.randomUUID()
    const task: DownloadTask = {
      id,
      url: requestUrl,
      filename: requestedFilename?.trim() || undefined,
      outputPath: requestedOutputPath?.trim() || undefined,
      progress: 0,
      status: 'queued',
      message: 'Aguardando o backend…',
    }
    setDownloads((current) => [task, ...current])

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ url: task.url, outputPath: task.outputPath, filename: task.filename }),
      })
      await consumeEventStream(response, (serverEvent) => {
        if (serverEvent.type === 'started') {
          updateTask(id, { status: 'downloading', message: serverEvent.message || 'Download iniciado.' })
        } else if (serverEvent.type === 'verifying') {
          updateTask(id, { status: 'downloading', progress: 100, message: serverEvent.message || 'Verificando arquivo…' })
        } else if (serverEvent.type === 'progress') {
          updateTask(id, {
            status: 'downloading',
            progress: serverEvent.percent ?? 0,
            speed: serverEvent.speed,
            eta: serverEvent.eta,
            message: 'Baixando vídeo…',
          })
        } else if (serverEvent.type === 'complete') {
          const completedTask: DownloadTask = {
            ...task,
            status: 'complete',
            progress: 100,
            filePath: serverEvent.filePath,
            verification: serverEvent.verification,
            message: serverEvent.message || 'Download concluído.',
          }
          setDownloads((current) => current.filter((item) => item.id !== id))
          setHistory((current) => [completedTask, ...current])
        } else {
          updateTask(id, { status: 'error', error: serverEvent.message || 'Falha no download.', message: 'Download interrompido.' })
        }
      })
    } catch (error) {
      updateTask(id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Falha desconhecida.',
        message: 'Download interrompido.',
      })
    }
  }

  const startDownload = async (event: FormEvent) => {
    event.preventDefault()
    const requestUrl = url.trim()
    const requestedFilename = filename.trim()
    const requestedOutputPath = outputPath.trim()
    setUrl('')
    setFilename('')
    await queueDownload(requestUrl, requestedFilename, requestedOutputPath)
  }

  const retryDownload = (item: DownloadTask) => {
    void queueDownload(item.url, item.filename, item.outputPath)
  }

  const chooseFolder = async () => {
    const picker = window as DirectoryPickerWindow
    if (!picker.showDirectoryPicker) {
      setDestinationHint('Seu navegador não oferece o seletor de pastas. Digite uma subpasta dentro de Vídeos.')
      return
    }

    try {
      const directory = await picker.showDirectoryPicker({ mode: 'read' })
      if (!videosPath) {
        setDestinationHint('A pasta Vídeos ainda está sendo identificada. Tente novamente em instantes.')
        return
      }
      setOutputPath(`${normalizeWindowsPath(videosPath)}\\${directory.name}`)
      setDestinationHint('A subpasta será criada dentro de Vídeos, caso ainda não exista.')
    } catch (error) {
      if (error instanceof DOMException && error.name !== 'AbortError') {
        setDestinationHint('Não foi possível selecionar a pasta.')
      }
    }
  }

  const cycleTheme = () => setTheme((current) => (current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'))
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const isCyberpunk = progressEngine === 'cyberpunk'

  return (
    <main className="chrono-shell h-dvh overflow-hidden p-3 sm:p-5">
      <div className="ambient-scene" aria-hidden="true"><i className="crystal crystal-a" /><i className="crystal crystal-b" /><i className="crystal crystal-c" /><i className="aurora aurora-a" /><i className="aurora aurora-b" /></div>
      <svg className="hidden" aria-hidden="true"><defs><filter id="liquid-magnetic-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" /><feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" /><feBlend in="SourceGraphic" in2="goo" /></filter></defs></svg>
      <div className="mx-auto grid h-full max-w-7xl grid-rows-[auto_minmax(0,1fr)] gap-3 sm:gap-4">
        <header className="app-topbar relative z-20 flex flex-wrap items-center justify-between gap-3 px-1 py-2 sm:px-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark"><Youtube className="h-5 w-5" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">YouTube Downloader</h1><p className="text-xs text-muted-foreground">Chrono-Stream <span className="mx-1 text-cyan-500">·</span> até 1080p</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="engine-toggle" title="Alternar motor de progresso"><Zap className="h-3.5 w-3.5" /><span className="hidden sm:inline">Fluido</span><button type="button" role="switch" aria-label="Ativar progresso fluido" aria-checked={isCyberpunk} onClick={() => setProgressEngine((current) => current === 'standard' ? 'cyberpunk' : 'standard')} className={`engine-switch ${isCyberpunk ? 'is-active' : ''}`}><span /></button></div>
            <Button variant="outline" size="icon" onClick={cycleTheme} title={`Tema: ${theme}`} aria-label={`Alterar tema atual: ${theme}`}><ThemeIcon className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={history.length === 0} onClick={() => setHistory([])} className="hidden sm:inline-flex"><Trash2 className="h-4 w-4" /> Limpar histórico</Button>
          </div>
        </header>

        <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(20rem,23rem)_minmax(0,1fr)] lg:gap-4">
          <section className="min-h-0 lg:h-full">
            <Card className="glass-panel sidebar-prism flex h-full min-h-0 flex-col overflow-hidden">
              <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-4"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Novo processo</p><CardTitle className="mt-1 text-lg">Configurar download</CardTitle><CardDescription className="mt-1">Cole a URL; o título é sugerido automaticamente.</CardDescription></div><Sparkles className="mt-1 h-5 w-5 text-cyan-500" /></div></CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pt-0 sm:p-5 sm:pt-0">
                <form className="grid gap-4" onSubmit={startDownload}>
                  <div className="grid gap-1.5"><Label htmlFor="url">URL do YouTube</Label><Input className="chrono-input h-11" id="url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Cole o link do vídeo" required /></div>
                  <div className="grid gap-1.5"><Label htmlFor="filename">Nome do arquivo <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input className="chrono-input h-11" id="filename" value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="Título do vídeo" /></div>
                  <div className="preview-well"><div className="prism-stage" aria-hidden="true"><i /><i /><i /><span><FileCheck2 className="h-5 w-5" /></span></div><div><p className="text-sm font-semibold">Pronto para processar</p><p className="mt-0.5 text-xs text-muted-foreground">Vídeo, áudio e arquivo final serão verificados.</p></div></div>
                  <div className="grid gap-1.5"><Label htmlFor="outputPath">Pasta de destino</Label><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Input className="chrono-input h-11" id="outputPath" value={outputPath} onChange={(event) => setOutputPath(event.target.value)} placeholder="Pasta dentro de Vídeos" /><Button className="h-11 px-3" type="button" variant="outline" onClick={() => void chooseFolder()} title="Procurar pasta" aria-label="Procurar pasta"><FolderOpen className="h-4 w-4" /><span className="hidden min-[380px]:inline">Pasta</span></Button></div>{destinationHint ? <p className="text-xs text-muted-foreground">{destinationHint}</p> : <p className="text-xs text-muted-foreground">A pasta será criada dentro de Vídeos quando necessário.</p>}</div>
                  <Button type="submit" className="chrono-primary h-11"><Youtube className="h-4 w-4" /> Iniciar download</Button>
                </form>
              </CardContent>
            </Card>
          </section>

          <section className="min-h-0" aria-live="polite">
            <Card className="glass-panel flex h-full min-h-0 flex-col overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 p-4 pb-3 sm:p-5 sm:pb-4"><div><p className="eyebrow">Monitoramento</p><CardTitle className="mt-1 flex items-center gap-2 text-lg"><History className="h-4 w-4 text-cyan-500" /> Downloads e histórico</CardTitle><CardDescription className="mt-1">Remover itens não apaga os arquivos salvos.</CardDescription></div><Button variant="outline" size="icon" disabled={history.length === 0} onClick={() => setHistory([])} className="sm:hidden" title="Limpar histórico" aria-label="Limpar histórico"><Trash2 className="h-4 w-4" /></Button></CardHeader>
              <CardContent className={`monitoring-feed min-h-0 flex-1 overflow-y-auto p-4 pt-0 sm:p-5 sm:pt-0 ${isCyberpunk ? 'mode-cyberpunk-fluid' : ''}`}>
                <div className="grid gap-3">
                  {downloadCards.length === 0 ? <div className="empty-feed"><div className="empty-orb"><Youtube className="h-5 w-5" /></div><p className="font-medium">Aguardando o primeiro vídeo</p><p className="text-xs text-muted-foreground">O progresso e o histórico aparecerão nesta área.</p></div> : downloadCards.map((item) => (
                    <article key={item.id} className="download-card"><i className="card-prism-orb" aria-hidden="true" />
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{item.filename || 'Nome automático do YouTube'}</p><div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs"><a className="inline-flex items-center gap-1 text-cyan-600 hover:underline dark:text-cyan-400" href={item.url} target="_blank" rel="noreferrer">Abrir no YouTube <ExternalLink className="h-3 w-3" /></a>{item.status === 'complete' && item.filePath ? <a className="inline-flex items-center gap-1 text-cyan-600 hover:underline dark:text-cyan-400" href={revealFileUrl(item.filePath)}>Mostrar arquivo <FolderOpen className="h-3 w-3" /></a> : null}</div></div><div className="status-badge">{item.status === 'complete' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : item.status === 'error' ? <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> : <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-500" />}<span>{item.status === 'complete' ? 'Concluído' : item.status === 'error' ? 'Erro' : item.status === 'queued' ? 'Na fila' : 'Baixando'}</span></div></div>
                      {item.status !== 'complete' && item.status !== 'error' ? <div className="mt-4"><Progress value={item.progress} className="mode-standard-bar" /><div className="liquid-track-container"><div className="liquid-core-stream" style={{ width: `${item.progress}%` }}><span className="liquid-particle-node" /></div></div></div> : null}
                      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{item.error || item.message}</span>{isCyberpunk && item.status === 'downloading' ? <span className="font-mono text-cyan-600 dark:text-cyan-300">Fluxo ativo {item.speed ? `· ${item.speed}` : ''}</span> : <span>{item.status !== 'complete' && item.status !== 'error' ? `${item.progress.toFixed(1)}%` : ''}{item.speed ? ` · ${item.speed}` : ''}{item.eta ? ` · ETA ${item.eta}` : ''}</span>}</div>
                      {item.verification ? <p className={`mt-3 flex items-start gap-2 border-t pt-3 text-xs ${item.verification.status === 'verified' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{item.verification.status === 'verified' ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}{item.verification.message}</p> : null}
                      {item.status === 'complete' ? <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => retryDownload(item)}><RotateCcw className="h-3.5 w-3.5" /> Baixar novamente</Button><Button variant="ghost" size="sm" onClick={() => setHistory((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 className="h-3.5 w-3.5" /> Remover</Button></div> : null}
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  )
}

export default App
