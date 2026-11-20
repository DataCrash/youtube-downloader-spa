import { createApp } from './app.js'
import { startYtDlpAutoUpdater } from './yt-dlp-updater.js'

const port = Number.parseInt(process.env.PORT || '3000', 10)

if (process.env.NODE_ENV === 'production') startYtDlpAutoUpdater()

createApp().listen(port, '0.0.0.0', () => {
  console.log(`Backend disponível na porta ${port}.`)
})
