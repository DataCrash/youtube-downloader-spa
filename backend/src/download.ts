import { spawn } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
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
  | { type: 'verifying'; message: string }
  | { type: 'complete'; filename?: string; filePath?: string; verification?: DownloadVerification; message: string }
  | { type: 'error'; message: string }

export type DownloadVerification = {
  status: 'verified' | 'warning'
  message: string
}

const progressPrefix = '__YTDLP_PROGRESS__|'
const filePrefix = '__YTDLP_FILE__|'

const preferredFormat = [
  'bestvideo[height=1080][vcodec^=avc1][protocol=https]+bestaudio[acodec^=mp4a][protocol=https]',
  'bestvideo[height=1080]+bestaudio[acodec^=mp4a]',
  'bestvideo[height<=1080][vcodec^=avc1][protocol=https]+bestaudio[acodec^=mp4a][protocol=https]',
  'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]',
  'bestvideo[height<=1080]+bestaudio[acodec^=mp4a]',
  'best[height<=1080]',
].join('/')

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

function run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr.trim() || `${command} terminou com código ${code ?? 'desconhecido'}.`))
    })
  })
}

export async function verifyDownloadedFile(url: URL, filePath: string | undefined): Promise<DownloadVerification> {
  if (!filePath) return { status: 'warning', message: 'Download concluído, mas o caminho do arquivo não pôde ser verificado.' }

  try {
    const file = await stat(filePath)
    if (file.size === 0) return { status: 'warning', message: 'O arquivo concluído está vazio.' }

    const local = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height',
      '-of', 'json',
      filePath,
    ])
    const localInfo = JSON.parse(local.stdout) as {
      format?: { duration?: string }
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>
    }
    const video = localInfo.streams?.find((stream) => stream.codec_type === 'video')
    const audio = localInfo.streams?.find((stream) => stream.codec_type === 'audio')
    if (!video || !audio) return { status: 'warning', message: 'O arquivo foi criado, mas não contém vídeo e áudio válidos.' }

    const remote = await run('yt-dlp', [
      '--no-playlist',
      '--js-runtimes', 'deno:/usr/local/bin/deno',
      '--remote-components', 'ejs:github',
      '--simulate',
      '--format', preferredFormat,
      '--print', '%(duration)s|%(width)s|%(height)s',
      url.toString(),
    ])
    const [expectedDuration = '', expectedWidth = '', expectedHeight = ''] = remote.stdout.trim().split('|')
    const localDuration = Number(localInfo.format?.duration)
    const durationMatches = Number.isFinite(localDuration) && Number.isFinite(Number(expectedDuration))
      && Math.abs(localDuration - Number(expectedDuration)) <= 3
    const resolutionMatches = Number(expectedWidth) === video.width && Number(expectedHeight) === video.height

    if (!durationMatches || !resolutionMatches) {
      return { status: 'warning', message: 'O arquivo abre com áudio e vídeo, mas a duração ou resolução não conferiu com o YouTube. Tente baixar novamente.' }
    }
    return { status: 'verified', message: 'Arquivo validado: áudio, vídeo, duração e resolução conferem com o YouTube.' }
  } catch {
    return { status: 'warning', message: 'Download concluído, mas não foi possível validar o arquivo agora. Você pode baixá-lo novamente.' }
  }
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
    child.once('close', async (code) => {
      if (code === 0) {
        if (stdoutBuffer.trim()) {
          const event = parseYtDlpLine(stdoutBuffer.trim())
          if (event?.type === 'complete') completedFilename = event.filename
        }
        emit({ type: 'verifying', message: 'Verificando áudio, vídeo e consistência com o YouTube…' })
        const verification = await verifyDownloadedFile(url, completedFilename)
        emit({
          type: 'complete',
          filename: completedFilename,
          filePath: resolveHostFilePath(completedFilename, downloadRoot, hostDownloadRoot),
          verification,
          message: 'Download concluído.',
        })
        resolve()
        return
      }
      reject(new Error(stderrTail.trim() || `yt-dlp terminou com código ${code ?? 'desconhecido'}.`))
    })
  })
}
