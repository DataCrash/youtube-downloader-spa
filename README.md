# YouTube Downloader SPA

SPA local para iniciar downloads paralelos de vídeos do YouTube em até 1080p.
O frontend React acompanha cada processo por Server-Sent Events; o backend
Express executa o binário oficial `yt-dlp` sem passar argumentos por shell.

> Baixe somente conteúdo que você tem autorização para acessar e copiar.

## Primeiro uso no Windows

Abra o PowerShell na pasta do projeto e execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

O Windows pedirá autorização de administrador uma única vez. O script:

- associa `youtube.download` ao computador local;
- cria e inicia os containers;
- instala uma autoridade certificadora local, válida somente nesta máquina.

Depois, abra `https://youtube.download`. O endereço
`http://youtube.download` também funciona e é redirecionado automaticamente
para HTTPS.

Os arquivos ficam em `./downloads`; a pasta informada na interface é uma
subpasta desse diretório. Por segurança, caminhos absolutos e travessia com
`..` são recusados.

## Operação diária

Depois do primeiro uso, para iniciar novamente:

```powershell
docker compose up -d
```

```powershell
docker compose logs -f
docker compose down
```

## Desenvolvimento local

Pré-requisitos: Node.js 20+, `yt-dlp` e `ffmpeg` disponíveis no `PATH`.

```powershell
npm install
npm run dev:backend
```

Em outro terminal:

```powershell
npm run dev:frontend
```

O Vite encaminha `/api` para `http://localhost:3000`.

## API

`POST /api/download`, com `Content-Type: application/json`:

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "outputPath": "curso",
  "filename": "aula-01"
}
```

A resposta permanece aberta como `text/event-stream`, emitindo eventos
`started`, `progress`, `complete` ou `error`. Somente URLs HTTPS do YouTube são
aceitas. `outputPath` é opcional e relativo a `/downloads`; `filename` também é
opcional e é sanitizado antes de chegar ao `yt-dlp`.

## Observações do navegador

- O tema e a última pasta usada ficam somente em `localStorage`.
- O seletor `webkitdirectory` não revela o caminho absoluto local; a interface
  aproveita o nome da pasta como subdiretório do volume `downloads`.
- A leitura automática da área de transferência depende da permissão do
  navegador e de um contexto considerado seguro. Colar manualmente sempre
  funciona.
