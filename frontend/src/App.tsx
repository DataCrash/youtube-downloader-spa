import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, ExternalLink, FolderOpen, LoaderCircle, Monitor, Moon, Sun, Youtube } from 'lucide-react'

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
}

type ServerEvent = {
  type: 'started' | 'progress' | 'complete' | 'error'
  message?: string
  percent?: number
  speed?: string
  eta?: string
}

const themeKey = 'youtube-downloader-theme'
const downloadPathKey = 'youtube-downloader-last-path'

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
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(themeKey) as Theme | null) || 'system')
  const [downloads, setDownloads] = useState<DownloadTask[]>([])
  const folderInputRef = useRef<HTMLInputElement>(null)
  const lastClipboardRef = useRef('')

  const hasActiveDownloads = downloads.some((item) => item.status === 'queued' || item.status === 'downloading')

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

  const startDownload = async (event: FormEvent) => {
    event.preventDefault()
    const requestUrl = url.trim()
    if (!requestUrl) return

    const id = crypto.randomUUID()
    const task: DownloadTask = {
      id,
      url: requestUrl,
      filename: filename.trim() || undefined,
      outputPath: outputPath.trim() || undefined,
      progress: 0,
      status: 'queued',
      message: 'Aguardando o backend…',
    }
    setDownloads((current) => [task, ...current])
    setUrl('')
    setFilename('')

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ url: task.url, outputPath: task.outputPath, filename: task.filename }),
      })
      await consumeEventStream(response, (serverEvent) => {
        if (serverEvent.type === 'started') {
          updateTask(id, { status: 'downloading', message: serverEvent.message || 'Download iniciado.' })
        } else if (serverEvent.type === 'progress') {
          updateTask(id, {
            status: 'downloading',
            progress: serverEvent.percent ?? 0,
            speed: serverEvent.speed,
            eta: serverEvent.eta,
            message: 'Baixando vídeo…',
          })
        } else if (serverEvent.type === 'complete') {
          updateTask(id, { status: 'complete', progress: 100, message: serverEvent.message || 'Download concluído.' })
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

  const chooseFolder = (files: FileList | null) => {
    const first = files?.item(0)
    const relativePath = first?.webkitRelativePath
    const folder = relativePath?.split('/')[0]
    if (folder) setOutputPath(folder)
  }

  const cycleTheme = () => setTheme((current) => (current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'))
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--accent),_transparent_38%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground"><Youtube className="h-7 w-7" /></div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">YouTube Downloader</h1>
              <p className="text-sm text-muted-foreground">Downloads paralelos em até 1080p</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={cycleTheme} title={`Tema: ${theme}`} aria-label={`Alterar tema atual: ${theme}`}>
            <ThemeIcon className="h-4 w-4" />
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Novo download</CardTitle>
            <CardDescription>A URL é preenchida automaticamente quando o navegador permite acesso à área de transferência.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={startDownload}>
              <div className="grid gap-2">
                <Label htmlFor="url">URL do YouTube</Label>
                <Input id="url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="filename">Nome do arquivo (opcional)</Label>
                <Input id="filename" value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="meu-video" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="outputPath">Pasta de destino (opcional)</Label>
                <div className="flex gap-2">
                  <Input id="outputPath" value={outputPath} onChange={(event) => setOutputPath(event.target.value)} placeholder="subpasta em downloads" />
                  <Button type="button" variant="outline" onClick={() => folderInputRef.current?.click()}>
                    <FolderOpen className="h-4 w-4" /> Procurar
                  </Button>
                  <input
                    ref={folderInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(event) => chooseFolder(event.target.files)}
                    {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">O navegador fornece somente o nome da pasta; ela é criada dentro do volume local <code>downloads</code>.</p>
              </div>
              <Button type="submit" className="w-full sm:w-fit">Iniciar download</Button>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-4" aria-live="polite">
          {downloads.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">Os downloads aparecerão aqui.</CardContent></Card>
          ) : downloads.map((item) => (
            <Card key={item.id}>
              <CardContent className="grid gap-4 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.filename || 'Nome automático do YouTube'}</p>
                    <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={item.url} target="_blank" rel="noreferrer">
                      Abrir no YouTube <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {item.status === 'complete' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : item.status === 'error' ? null : <LoaderCircle className="h-4 w-4 animate-spin text-primary" />}
                    <span>{item.status === 'complete' ? 'Concluído' : item.status === 'error' ? 'Erro' : item.status === 'queued' ? 'Na fila' : 'Baixando'}</span>
                  </div>
                </div>
                <Progress value={item.progress} />
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>{item.error || item.message}</span>
                  <span>{item.progress.toFixed(1)}%{item.speed ? ` · ${item.speed}` : ''}{item.eta ? ` · ETA ${item.eta}` : ''}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}

export default App
