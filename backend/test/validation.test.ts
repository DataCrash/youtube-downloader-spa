import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { parseYtDlpLine } from '../src/download.js'
import { assertYouTubeUrl, resolveOutputDirectory, sanitizeFilename } from '../src/validation.js'

test('aceita somente URLs HTTPS do YouTube', () => {
  assert.equal(assertYouTubeUrl('https://youtu.be/BaW_jenozKc').hostname, 'youtu.be')
  assert.throws(() => assertYouTubeUrl('https://example.com/video'))
  assert.throws(() => assertYouTubeUrl('http://youtube.com/watch?v=test'))
})

test('mantém o destino dentro da raiz de downloads', () => {
  const root = path.resolve('downloads')
  assert.equal(resolveOutputDirectory(root, 'music'), path.join(root, 'music'))
  assert.throws(() => resolveOutputDirectory(root, '..'))
  assert.throws(() => resolveOutputDirectory(root, path.resolve('outside')))
})

test('sanitiza nomes e interpreta progresso', () => {
  assert.equal(sanitizeFilename('meu: vídeo?.mp4'), 'meu- vídeo-.mp4')
  assert.deepEqual(parseYtDlpLine('__YTDLP_PROGRESS__|42.5%|1.2MiB/s|00:05'), {
    type: 'progress',
    percent: 42.5,
    speed: '1.2MiB/s',
    eta: '00:05',
  })
})
