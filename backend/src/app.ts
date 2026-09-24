import express from 'express'

import { getVideoTitle, runDownload, type DownloadEvent } from './download.js'
import { assertYouTubeUrl, downloadRequestSchema } from './validation.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.get('/api/config', (_request, response) => {
    response.json({ downloadPath: process.env.HOST_DOWNLOAD_ROOT || '' })
  })

  app.get('/api/metadata', async (request, response) => {
    const url = typeof request.query.url === 'string' ? request.query.url : ''
    try {
      assertYouTubeUrl(url)
      response.json({ title: await getVideoTitle(url) })
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : 'Não foi possível obter os metadados.' })
    }
  })

  app.post('/api/download', async (request, response) => {
    const parsed = downloadRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Requisição inválida.', details: parsed.error.flatten() })
      return
    }

    response.status(200)
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    response.flushHeaders()

    let streamOpen = true
    response.once('close', () => {
      streamOpen = false
    })

    const send = (event: DownloadEvent) => {
      if (!streamOpen || response.writableEnded) return
      response.write(`event: ${event.type}\n`)
      response.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    const heartbeat = setInterval(() => {
      if (streamOpen && !response.writableEnded) response.write(': keep-alive\n\n')
    }, 15_000)

    try {
      await runDownload(
        parsed.data,
        process.env.DOWNLOAD_ROOT || '/downloads',
        process.env.HOST_DOWNLOAD_ROOT || '',
        send,
      )
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : 'Falha desconhecida.' })
    } finally {
      clearInterval(heartbeat)
      if (!response.writableEnded) response.end()
    }
  })

  return app
}
