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

Os arquivos ficam em `C:\\Users\\<seu-usuário>\\Videos`, diretamente no
Windows. A interface começa nessa pasta, restaura o último destino usado e
cria subpastas inexistentes ao iniciar o download. Caminhos absolutos são
aceitos somente dentro da pasta `Vídeos`; isso impede que o container grave em
outras áreas do computador.

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
aceitas. `outputPath` é opcional e pode ser uma subpasta ou um caminho absoluto
dentro de `C:\\Users\\<seu-usuário>\\Videos`; `filename` também é opcional e é
sanitizado antes de chegar ao `yt-dlp`.

## Observações do navegador

- O tema e a última pasta usada ficam somente em `localStorage`.
- O botão **Procurar** usa o seletor nativo de diretórios do navegador, não um
  campo de upload. Como o navegador não expõe o caminho absoluto selecionado,
  ele usa o nome da pasta como subpasta de `Vídeos`.
- O título é consultado no `yt-dlp` e sugerido como nome do arquivo; ele pode
  ser alterado antes de iniciar o download.
- A leitura automática da área de transferência depende da permissão do
  navegador e de um contexto considerado seguro. Colar manualmente sempre
  funciona.
