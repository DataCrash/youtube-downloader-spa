# YouTube Downloader SPA

Aplicação local para baixar vídeos autorizados do YouTube em até 1080p. A interface React acompanha o processo em tempo real; o backend Express executa `yt-dlp`, mescla áudio e vídeo com FFmpeg e grava diretamente na pasta **Vídeos** do Windows.

> Baixe somente conteúdo que você tem autorização para acessar e copiar.

## Recursos

- Download paralelo, com progresso, velocidade e estimativa de tempo.
- Prioridade para 1080p em H.264 + AAC dentro de MP4, formato compatível com o Windows; quando indisponível, usa a melhor alternativa com áudio até 1080p.
- Sugestão automática do título como nome do arquivo.
- Criação automática de subpastas em `C:\\Users\\<usuário>\\Videos`.
- Histórico persistente integrado aos cards de download, com remoção visual, limpeza e repetição sem apagar arquivos existentes.
- Atalho **Mostrar arquivo**, que abre o Explorador de Arquivos com o vídeo selecionado.
- Verificação automática de áudio, vídeo, duração e resolução depois do download.
- Acesso local por `https://youtube.download`, com redirecionamento de HTTP para HTTPS.

## Primeiro uso no Windows

### Pré-requisitos

- Windows 10 ou 11.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) em execução, com containers Linux habilitados.
- PowerShell. A execução de `start.ps1` pede confirmação do Windows porque atualiza o arquivo `hosts` e instala um certificado local.

No PowerShell, dentro da pasta do repositório, execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

O script prepara a máquina e abre o navegador:

1. associa `youtube.download` ao computador local;
2. registra o atalho local usado por **Mostrar arquivo**;
3. cria ou atualiza os containers;
4. instala a autoridade certificadora local do Caddy, válida somente nesta máquina;
5. abre `https://youtube.download`.

Depois disso, os dois endereços funcionam:

| Endereço | Comportamento |
| --- | --- |
| `https://youtube.download` | Aplicação segura principal. |
| `http://youtube.download` | Redireciona automaticamente para HTTPS. |

O certificado é local: ele não torna o endereço público nem envia dados para fora do seu computador.

## Uso da aplicação

1. Cole uma URL HTTPS do YouTube.
2. Aguarde a sugestão do título ou informe um nome próprio.
3. Escolha a pasta **Vídeos** ou uma subpasta. A última pasta usada é restaurada automaticamente; subpastas inexistentes são criadas no início do download.
4. Inicie o download e acompanhe o progresso.
5. Ao concluir, confira o resultado da validação e use **Mostrar arquivo** se quiser abrir o Explorer já com o arquivo selecionado.

Por segurança, o aplicativo aceita destinos somente dentro de `C:\\Users\\<usuário>\\Videos`. O botão **Procurar** usa o seletor nativo do navegador, mas navegadores não revelam o caminho absoluto da pasta escolhida; por isso, o nome selecionado é usado como subpasta de `Vídeos`.

### Histórico

O histórico é salvo no `localStorage` do navegador para o endereço `youtube.download`. Ao concluir, o card permanece no mesmo painel de downloads com suas ações de histórico. O painel mantém **Limpar histórico** visível o tempo todo e só o habilita quando há registros concluídos.

- **Remover do histórico** remove somente o registro visual.
- **Limpar histórico** remove todos os registros visuais.
- **Baixar novamente** cria uma nova tentativa com os mesmos dados.

Nenhuma dessas ações remove arquivos de `Vídeos`. Limpar dados do navegador ou usar outro perfil também apaga apenas o histórico, nunca os vídeos.

### Validação do arquivo

Após o `yt-dlp` terminar, a aplicação executa duas verificações:

1. `ffprobe` confirma que o MP4 possui faixas de vídeo e áudio legíveis e não está vazio.
2. O `yt-dlp` consulta novamente a seleção de formato do YouTube e compara a duração e a resolução esperadas com o arquivo local.

Um resultado **validado** indica que essas características conferem. Um aviso não apaga o arquivo: use **Baixar novamente** para fazer uma nova tentativa. Essa checagem não é uma comparação criptográfica byte a byte, pois o YouTube entrega áudio e vídeo separados e o arquivo final é mesclado localmente.

## Operação diária e diagnóstico

Depois do primeiro uso, para apenas iniciar os containers:

```powershell
docker compose up -d
```

Para reconfigurar o endereço local, o certificado ou o atalho **Mostrar arquivo**, execute novamente `start.ps1`.

Comandos úteis:

```powershell
docker compose ps
docker compose logs -f
docker compose down
```

Se `youtube.download` não abrir, confirme que o Docker Desktop está em execução e rode `start.ps1`. Se as portas 80 ou 443 já estiverem ocupadas, pare o serviço que as utiliza antes de iniciar a aplicação.

## Desenvolvimento local

Para desenvolver sem Docker, instale Node.js 20 ou superior, Python 3, `yt-dlp`, FFmpeg e Deno 2 ou superior no `PATH`. O Deno é usado pelo `yt-dlp` para lidar com os desafios JavaScript atuais do YouTube.

```powershell
npm install
npm run dev:backend
```

Em outro terminal:

```powershell
npm run dev:frontend
```

O Vite encaminha `/api` para `http://localhost:3000`. Para desenvolvimento fora do Docker, defina `DOWNLOAD_ROOT` e `HOST_DOWNLOAD_ROOT` para uma pasta local gravável antes de iniciar o backend.

Verificações do projeto:

```powershell
npm test
npm run lint
npm run build
```

## API local

| Método e rota | Finalidade |
| --- | --- |
| `GET /api/health` | Estado do backend. |
| `GET /api/config` | Caminho de `Vídeos` exposto à interface. |
| `GET /api/metadata?url=...` | Consulta o título de uma URL válida do YouTube. |
| `POST /api/download` | Inicia um download e mantém uma resposta SSE aberta. |

Exemplo de `POST /api/download`:

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "outputPath": "curso",
  "filename": "aula-01"
}
```

`outputPath` é opcional e pode ser uma subpasta ou um caminho absoluto dentro de `C:\\Users\\<usuário>\\Videos`. `filename` também é opcional e é sanitizado antes de chegar ao `yt-dlp`.

A resposta usa `text/event-stream` e pode emitir `started`, `progress`, `verifying`, `complete` ou `error`.

## Observações do navegador

- Tema, último destino e histórico ficam somente no `localStorage`.
- Caminhos são exibidos com a convenção do Windows (`\\`), mesmo que o Docker receba a variável de ambiente com `/`.
- A leitura automática da área de transferência depende da permissão do navegador e de um contexto seguro. Colar manualmente sempre funciona.
