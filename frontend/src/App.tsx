import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, ExternalLink, FolderOpen, LoaderCircle, Monitor, Moon, RotateCcw, ShieldAlert, ShieldCheck, Sun, Trash2, Youtube } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

type Theme = 'light' | 'dark' | 'system'
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

  return (
    <main className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_var(--accent),_transparent_38%)] p-3 sm:p-4">
      <div className="mx-auto grid h-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(17rem,0.65fr)_minmax(0,1.35fr)] lg:grid-rows-1 lg:gap-4">
        <section className="flex min-h-0 flex-col gap-3">
          <header className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-xl bg-primary p-2 text-primary-foreground"><Youtube className="h-5 w-5 sm:h-6 sm:w-6" /></div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">YouTube Downloader</h1>
                <p className="text-xs text-muted-foreground">Downloads em até 1080p</p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={cycleTheme} title={`Tema: ${theme}`} aria-label={`Alterar tema atual: ${theme}`}>
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </header>

          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-3">
              <CardTitle className="text-base">Novo download</CardTitle>
              <span className="text-xs text-muted-foreground">URL da área de transferência</span>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2" onSubmit={startDownload}>
                <div className="col-span-full">
                  <Label className="sr-only" htmlFor="url">URL do YouTube</Label>
                  <Input className="h-9" id="url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL do YouTube" required />
                </div>
                <div className="col-span-full">
                  <Label className="sr-only" htmlFor="filename">Nome do arquivo</Label>
                  <Input className="h-9" id="filename" value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="Nome do arquivo (título sugerido)" />
                </div>
                <div>
                  <Label className="sr-only" htmlFor="outputPath">Pasta de destino</Label>
                  <Input className="h-9" id="outputPath" value={outputPath} onChange={(event) => setOutputPath(event.target.value)} placeholder="Pasta de destino" />
                </div>
                <Button className="h-9 w-9 px-0" type="button" variant="outline" onClick={() => void chooseFolder()} title="Procurar pasta" aria-label="Procurar pasta">
                  <FolderOpen className="h-4 w-4" />
                </Button>
                {destinationHint ? <p className="col-span-full text-xs text-muted-foreground">{destinationHint}</p> : null}
                <Button type="submit" className="col-span-full h-9">Iniciar download</Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="min-h-0" aria-live="polite">
          <Card className="flex h-full min-h-0 flex-col">
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 p-4 pb-3">
              <div>
                <CardTitle>Downloads e histórico</CardTitle>
                <CardDescription>Remover itens não apaga os arquivos salvos.</CardDescription>
              </div>
              <Button variant="outline" size="sm" disabled={history.length === 0} onClick={() => setHistory([])}>
                <Trash2 className="h-4 w-4" /> Limpar histórico
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pt-0 pr-2">
              <div className="grid gap-3">
                {downloadCards.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Os downloads e o histórico aparecerão aqui.</div>
                ) : downloadCards.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.filename || 'Nome automático do YouTube'}</p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                          <a className="inline-flex items-center gap-1 text-primary hover:underline" href={item.url} target="_blank" rel="noreferrer">
                            Abrir no YouTube <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          {item.status === 'complete' && item.filePath ? (
                            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={revealFileUrl(item.filePath)}>
                              Mostrar arquivo <FolderOpen className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-sm">
                        {item.status === 'complete' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : item.status === 'error' ? null : <LoaderCircle className="h-4 w-4 animate-spin text-primary" />}
                        <span>{item.status === 'complete' ? 'Concluído' : item.status === 'error' ? 'Erro' : item.status === 'queued' ? 'Na fila' : 'Baixando'}</span>
                      </div>
                    </div>
                    <Progress value={item.progress} />
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span>{item.error || item.message}</span>
                      <span>{item.progress.toFixed(1)}%{item.speed ? ` · ${item.speed}` : ''}{item.eta ? ` · ETA ${item.eta}` : ''}</span>
                    </div>
                    {item.verification ? (
                      <p className={`flex items-center gap-2 text-xs ${item.verification.status === 'verified' ? 'text-green-600' : 'text-amber-600'}`}>
                        {item.verification.status === 'verified' ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                        {item.verification.message}
                      </p>
                    ) : null}
                    {item.status === 'complete' ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => retryDownload(item)}>
                          <RotateCcw className="h-4 w-4" /> Baixar novamente
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setHistory((current) => current.filter((entry) => entry.id !== item.id))}>
                          <Trash2 className="h-4 w-4" /> Remover do histórico
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

export default App
