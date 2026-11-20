import { spawn } from 'node:child_process'

export const YT_DLP_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000

export interface IntervalScheduler {
  schedule(callback: () => void, delayMs: number): () => void
}

interface AutoUpdaterOptions {
  intervalMs?: number
  scheduler?: IntervalScheduler
  onError?: (error: unknown) => void
}

const systemScheduler: IntervalScheduler = {
  schedule(callback, delayMs) {
    const timer = setInterval(callback, delayMs)
    timer.unref()
    return () => clearInterval(timer)
  },
}

export function updateYtDlp(): Promise<void> {
  console.info('[yt-dlp] Verificando atualização no canal nightly.')

  return new Promise((resolve, reject) => {
    const child = spawn('/home/node/.local/bin/yt-dlp', ['--update-to', 'nightly'], { shell: false, windowsHide: true })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) {
        const output = stdout.trim() || stderr.trim()
        if (output) console.info(`[yt-dlp] ${output}`)
        return resolve()
      }
      reject(new Error(stderr.trim() || stdout.trim() || `yt-dlp terminou com código ${code ?? 'desconhecido'}.`))
    })
  })
}

export function startYtDlpAutoUpdater(
  update: () => Promise<void> = updateYtDlp,
  options: AutoUpdaterOptions = {},
): () => void {
  const { intervalMs = YT_DLP_UPDATE_INTERVAL_MS, scheduler = systemScheduler, onError = (error) => {
    console.error('[yt-dlp] Falha na atualização automática; o serviço continuará ativo e tentará novamente.', error)
  } } = options

  let updateInProgress = false
  let stopped = false
  const runUpdate = async () => {
    if (stopped || updateInProgress) return
    updateInProgress = true
    try {
      await update()
    } catch (error) {
      onError(error)
    } finally {
      updateInProgress = false
    }
  }

  void runUpdate()
  const cancelInterval = scheduler.schedule(() => { void runUpdate() }, intervalMs)
  return () => {
    stopped = true
    cancelInterval()
  }
}
