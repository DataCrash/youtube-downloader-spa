import path from 'node:path'
import { z } from 'zod'

const allowedHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
])

export const downloadRequestSchema = z.object({
  url: z.string().url(),
  outputPath: z.string().trim().max(160).optional(),
  filename: z.string().trim().max(120).optional(),
})

export type DownloadRequest = z.infer<typeof downloadRequestSchema>

export function assertYouTubeUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error('Use uma URL HTTPS válida do YouTube.')
  }
  return url
}

export function sanitizeFilename(value?: string): string | undefined {
  if (!value) return undefined
  const sanitized = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\.+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return sanitized.slice(0, 100) || undefined
}

export function resolveOutputDirectory(root: string, hostRoot: string, requested?: string): string {
  const rootPath = path.resolve(root)
  const requestedPath = requested?.trim() || ''
  if (!requestedPath) return rootPath

  if (path.win32.isAbsolute(requestedPath)) {
    const hostBase = path.win32.resolve(hostRoot)
    const hostTarget = path.win32.resolve(requestedPath)
    const relative = path.win32.relative(hostBase, hostTarget)
    if (relative === '' || (!relative.startsWith('..\\') && relative !== '..' && !path.win32.isAbsolute(relative))) {
      return path.resolve(rootPath, ...relative.split('\\').filter(Boolean))
    }
    throw new Error('A pasta de destino deve estar dentro da sua pasta Vídeos.')
  }

  if (path.posix.isAbsolute(requestedPath)) {
    throw new Error('A pasta de destino deve estar dentro da sua pasta Vídeos.')
  }

  const resolved = path.resolve(rootPath, requestedPath)
  if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error('A pasta de destino deve estar dentro da sua pasta Vídeos.')
  }
  return resolved
}
