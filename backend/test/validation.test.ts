import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { parseYtDlpLine, resolveHostFilePath } from '../src/download.js'
import { assertYouTubeUrl, resolveOutputDirectory, sanitizeFilename } from '../src/validation.js'

test('aceita somente URLs HTTPS do YouTube', () => {
  assert.equal(assertYouTubeUrl('https://youtu.be/BaW_jenozKc').hostname, 'youtu.be')
  assert.throws(() => assertYouTubeUrl('https://example.com/video'))
  assert.throws(() => assertYouTubeUrl('http://youtube.com/watch?v=test'))
})

test('mantém o destino dentro da raiz de downloads', () => {
  const root = path.resolve('downloads')
  const hostRoot = 'C:\\Users\\DataCrash\\Videos'
  assert.equal(resolveOutputDirectory(root, hostRoot, 'music'), path.join(root, 'music'))
  assert.equal(resolveOutputDirectory(root, hostRoot, 'C:\\Users\\DataCrash\\Videos\\FullCycle'), path.join(root, 'FullCycle'))
  assert.throws(() => resolveOutputDirectory(root, hostRoot, '..'))
  assert.throws(() => resolveOutputDirectory(root, hostRoot, 'C:\\outside'))
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

test('converte o arquivo concluído para o caminho do Windows', () => {
  assert.equal(
    resolveHostFilePath('/downloads/FullCycle/aula.mp4', '/downloads', 'C:\\Users\\DataCrash/Videos'),
    'C:\\Users\\DataCrash\\Videos\\FullCycle\\aula.mp4',
  )
  assert.equal(resolveHostFilePath('/tmp/aula.mp4', '/downloads', 'C:\\Users\\DataCrash\\Videos'), undefined)
})
