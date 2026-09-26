import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import {
  assertYouTubeUrl,
  resolveOutputDirectory,
  sanitizeFilename,
  type DownloadRequest,
} from './validation.js'

export type DownloadEvent =
  | { type: 'started'; message: string }
  | { type: 'progress'; percent: number; speed?: string; eta?: string }
  | { type: 'complete'; filename?: string; filePath?: string; message: string }
  | { type: 'error'; message: string }

const progressPrefix = '__YTDLP_PROGRESS__|'
const filePrefix = '__YTDLP_FILE__|'

export function parseYtDlpLine(line: string): DownloadEvent | undefined {
  if (line.startsWith(progressPrefix)) {
    const [percentRaw = '', speed = '', eta = ''] = line.slice(progressPrefix.length).split('|')
    const percent = Number.parseFloat(percentRaw.replace('%', '').trim())
    return {
      type: 'progress',
      percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0,
      speed: speed.trim() || undefined,
      eta: eta.trim() || undefined,
    }
  }
  if (line.startsWith(filePrefix)) {
    return { type: 'complete', filename: line.slice(filePrefix.length).trim(), message: 'Download concluído.' }
  }
  return undefined
}

export function resolveHostFilePath(containerPath: string | undefined, downloadRoot: string, hostDownloadRoot: string): string | undefined {
  if (!containerPath || !hostDownloadRoot) return undefined

  const relativePath = path.relative(downloadRoot, containerPath)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) return undefined

  return path.win32.join(hostDownloadRoot.replaceAll('/', '\\'), ...relativePath.split(path.sep))
}

export async function getVideoTitle(value: string): Promise<string> {
  const url = assertYouTubeUrl(value)

  return new Promise<string>((resolve, reject) => {
    const child = spawn('yt-dlp', ['--no-playlist', '--skip-download', '--print', '%(title)s', url.toString()], { shell: false, windowsHide: true })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr = `${stderr}${chunk.toString('utf8')}`.slice(-2000) })
    child.once('error', reject)
    child.once('close', (code) => {
      const title = stdout.trim()
      if (code === 0 && title) {
        resolve(title)
        return
      }
      reject(new Error(stderr.trim() || 'Não foi possível obter o título do vídeo.'))
    })
  })
}

export async function runDownload(
  request: DownloadRequest,
  downloadRoot: string,
  hostDownloadRoot: string,
  emit: (event: DownloadEvent) => void,
): Promise<void> {
  const url = assertYouTubeUrl(request.url)
  const outputDirectory = resolveOutputDirectory(downloadRoot, hostDownloadRoot, request.outputPath)
  const filename = sanitizeFilename(request.filename)
  await mkdir(outputDirectory, { recursive: true })

  const outputTemplate = filename
    ? `${filename}.%(ext)s`
    : '%(title).100B [%(id)s].%(ext)s'
  const preferredFormat = [
    'bestvideo[height=1080][vcodec^=avc1][protocol=https]+bestaudio[acodec^=mp4a][protocol=https]',
    'bestvideo[height=1080]+bestaudio[acodec^=mp4a]',
    'bestvideo[height<=1080][vcodec^=avc1][protocol=https]+bestaudio[acodec^=mp4a][protocol=https]',
    'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]',
    'bestvideo[height<=1080]+bestaudio[acodec^=mp4a]',
    'best[height<=1080]',
  ].join('/')

  const args = [
    '--no-playlist',
    '--js-runtimes',
    'deno:/usr/local/bin/deno',
    '--remote-components',
    'ejs:github',
    '--newline',
    '--progress',
    '--no-colors',
    '--format',
    preferredFormat,
    '--concurrent-fragments',
    '1',
    '--retries',
    '10',
    '--fragment-retries',
    '10',
    '--abort-on-unavailable-fragment',
    '--merge-output-format',
    'mp4',
    '--paths',
    outputDirectory,
    '--output',
    outputTemplate,
    '--progress-template',
    `download:${progressPrefix}%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s`,
    '--print',
    `after_move:${filePrefix}%(filepath)s`,
    url.toString(),
  ]

  emit({ type: 'started', message: 'Download iniciado.' })

  await new Promise<void>((resolve, reject) => {
    const child = spawn('yt-dlp', args, { shell: false, windowsHide: true })
    let stdoutBuffer = ''
    let stderrTail = ''
    let completedFilename: string | undefined

    const consumeLines = (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf8')
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const event = parseYtDlpLine(line.trim())
        if (!event) continue
        if (event.type === 'complete') completedFilename = event.filename
        else emit(event)
      }
    }

    child.stdout.on('data', consumeLines)
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = `${stderrTail}${chunk.toString('utf8')}`.slice(-2000)
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) {
        if (stdoutBuffer.trim()) {
          const event = parseYtDlpLine(stdoutBuffer.trim())
          if (event?.type === 'complete') completedFilename = event.filename
        }
        emit({
          type: 'complete',
          filename: completedFilename,
          filePath: resolveHostFilePath(completedFilename, downloadRoot, hostDownloadRoot),
          message: 'Download concluído.',
        })
        resolve()
        return
      }
      reject(new Error(stderrTail.trim() || `yt-dlp terminou com código ${code ?? 'desconhecido'}.`))
    })
  })
}
