import assert from 'node:assert/strict'
import test from 'node:test'

import { startYtDlpAutoUpdater, type IntervalScheduler } from '../src/yt-dlp-updater.js'

test('executa a atualização ao iniciar e agenda a próxima para 24 horas', async () => {
  let scheduledCallback: (() => void) | undefined
  let scheduledDelay = 0
  let cancelled = false
  let updateCount = 0
  const scheduler: IntervalScheduler = {
    schedule(callback, delayMs) {
      scheduledCallback = callback
      scheduledDelay = delayMs
      return () => { cancelled = true }
    },
  }

  const stop = startYtDlpAutoUpdater(async () => { updateCount += 1 }, { scheduler })

  assert.equal(updateCount, 1)
  assert.equal(scheduledDelay, 24 * 60 * 60 * 1000)

  await Promise.resolve()
  scheduledCallback?.()
  assert.equal(updateCount, 2)

  stop()
  assert.equal(cancelled, true)
  scheduledCallback?.()
  assert.equal(updateCount, 2)
})

test('não inicia outra atualização enquanto a anterior ainda está em andamento', async () => {
  let scheduledCallback: (() => void) | undefined
  let releaseUpdate: (() => void) | undefined
  let updateCount = 0
  const scheduler: IntervalScheduler = {
    schedule(callback) {
      scheduledCallback = callback
      return () => undefined
    },
  }

  const stop = startYtDlpAutoUpdater(() => {
    updateCount += 1
    return new Promise<void>((resolve) => { releaseUpdate = resolve })
  }, { scheduler })

  scheduledCallback?.()
  scheduledCallback?.()
  assert.equal(updateCount, 1)

  releaseUpdate?.()
  await Promise.resolve()
  scheduledCallback?.()
  assert.equal(updateCount, 2)
  stop()
})

test('registra falhas sem impedir que as próximas atualizações tentem novamente', async () => {
  let scheduledCallback: (() => void) | undefined
  let updateCount = 0
  const errors: unknown[] = []
  const scheduler: IntervalScheduler = {
    schedule(callback) {
      scheduledCallback = callback
      return () => undefined
    },
  }

  const stop = startYtDlpAutoUpdater(async () => {
    updateCount += 1
    if (updateCount === 1) throw new Error('rede indisponível')
  }, { scheduler, onError: (error) => errors.push(error) })

  await Promise.resolve()
  assert.equal(errors.length, 1)
  scheduledCallback?.()
  assert.equal(updateCount, 2)
  stop()
})
