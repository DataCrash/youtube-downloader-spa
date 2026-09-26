# 💎 DESIGN SYSTEM: ESPECIFICAÇÃO DE ARQUITETURA VISUAL & COMPONENTES

## Projeto: Chrono-Stream UI (YouTube Downloader Premium)

Este documento estabelece as diretrizes matemáticas, funcionais, tipográficas e de estilo para o desenvolvimento front-end do ecossistema Chrono-Stream UI. A especificação une a estética tridimensional e os efeitos de refração de vidro (*glassmorphism*) das telas conceituais originais com a estrutura enxuta, usabilidade limpa do wireframe refinado e a arquitetura híbrida de monitoramento de progresso.

---

## 1. PALETA DE CORES & TOKENS DE IDENTIDADE

O ecossistema Chrono-Stream UI opera em um esquema dual de temas (Dark e Light) com alta consistência semântica e fidelidade cromática aos cristais e refrações tridimensionais da interface.

### 🌑 Tema Escuro (Dark Mode)

* **Ambiente (Background Principal):** `#0B0F19` (Cinza espacial profundo de ultra-baixa reflexão)
* **Superfície de Vidro (Backdrop do Card/Sidebar):** `rgba(20, 28, 47, 0.45)` com `backdrop-filter: blur(12px)`
* **Borda Lapidada (Prisma Angular):** Gradiente Linear a 135°: `(rgba(255,255,255,0.15) 0%, rgba(0,242,254,0.2) 50%, rgba(20,28,47,0) 100%)`
* **Texto Primário:** `#FFFFFF` (Branco puro para legibilidade máxima sobre superfícies escuras)
* **Texto Secundário / Labels:** `#94A3B8` (Slate 400 - para descrições, subtítulos e labels)
* **Acentos Ativos & Funcionais:**
  * `#00F2FE` (Ciano Ativo - Indicadores de progresso standard, realces de foco e destaques cibernéticos)
  * `#9B51E0` (Púrpura Fluido - Extremidade dinâmica e transição do ferrofluido ativo)
  * `#E11D48` ou `#B91C1C` (Vermelho Premium - Botão Iniciar Download e acentos de marca)
  * `#27AE60` (Verde Sucesso - Ícones e badges de status "Concluído")
  * `#F59E0B` (Âmbar Alerta - Mensagens de validação e atenção secundária)

### ☀️ Tema Claro (Light Mode)

* **Ambiente (Background Principal):** `#F3F5F9` (Cinza calcedônia limpo com oclusão suave)
* **Superfície de Vidro (Backdrop do Card/Sidebar):** `rgba(255, 255, 255, 0.65)` com `backdrop-filter: blur(12px)`
* **Borda Lapidada (Prisma Suave):** Gradiente Linear a 135°: `(rgba(255,255,255,0.8) 0%, rgba(11,15,25,0.05) 100%)`
* **Texto Primário:** `#0F172A` (Slate 900 profundo para legibilidade de alto contraste)
* **Texto Secundário / Labels:** `#475569` (Slate 600 para metadados e textos de suporte)
* **Acentos de Alto Contraste:**
  * `#3B82F6` (Azul Funcional - Progresso Standard e interações padrão)
  * `#1D4ED8` (Azul Profundo - Extremidade do Ferrofluido Claro)
  * `#991B1B` (Vermelho Escuro - Botão Iniciar Download Premium)
  * `#1E8449` (Verde Esmeralda - Status Concluído em superfícies claras)

---

## 2. ESPECIFICAÇÃO DE TIPOGRAFIA

O sistema tipográfico prioriza a clareza técnica de um gerenciador de downloads misturada à sofisticação de um software Premium.

### A. Famílias de Fontes (Font Families)

* **Interface Geral (Títulos, UI, Inputs):** Sans-Serif Moderna (Ex: `Inter`, `System-UI`, ou `Segoe UI`).
* **Logs e Dados Técnicos (Status, URLs, Metadados):** Monoespaçada (Ex: `JetBrains Mono`, `Fira Code`, ou `monospace`).

### B. Escala Tipográfica & Pesos (Typography Scale)

| Token de Estilo | Tamanho (Rem/Px) | Peso (Weight) | Aplicação em Interface |
| :--- | :--- | :--- | :--- |
| `font-title-lg` | `1.50rem` (24px) | **Bold (700)** | Logo principal da aplicação no Header. |
| `font-title-md` | `1.125rem` (18px) | **SemiBold (600)** | Título dos cards de mídia e cabeçalhos de bloco. |
| `font-body-md` | `1.00rem` (16px) | Regular (400) | Textos de inputs, conteúdo principal e descrições. |
| `font-label-sm` | `0.875rem` (14px) | Medium (500) | Labels de formulários, botões de ação e sub-badges. |
| `font-code-xs` | `0.75rem` (12px) | Regular (400) | Logs de validação de arquivos e URLs técnicas. |

---

## 3. ARQUITETURA DE LAYOUT & CAMADAS (EIXO Z)

O sistema é dividido em uma estrutura binária de visualização protegida por um empilhamento rígido no eixo Z, impedindo artefatos visuais ou quebras de foco:

### A. Divisão Estrutural de Tela

* **Header Superior (Global):** Estende-se por toda a largura horizontal (`100vw`). Contém a identidade do software, o badge de resolução limite e as ações globais de destruição em massa da árvore de histórico.
* **Painel de Configuração Lateral (Sidebar - Esquerda):** Largura fixa ou proporcional (`320px` a `380px`). Concentra o fluxo de entrada de dados (URL e Nome) e o botão de gatilho principal.
* **Lista de Monitoramento (Feed - Direita):** Área fluida (`flex: 1`). Composta por um empilhamento vertical de cards de progresso e histórico.

### B. Matriz Matemática de Camadas (Z-Index)

| Nível de Camada (Z-Index) | Nome do Segmento | Comportamento e Elementos Integrados |
| :--- | :--- | :--- |
| `z-index: 1` | Ambientação Profunda | Elementos tridimensionais, cristais geométricos de fundo e efeitos de Raytracing. |
| `z-index: 10` | Isolamento de Difusão | Camada de desfoque ativo (`backdrop-filter`) que suaviza o ruído visual de fundo. |
| `z-index: 20` | Superfície e Controle | Contêineres de vidro fosco, textos estruturais, inputs, botões e controles críticos. |
| `z-index: 30` | Feedback e Alertas | Tooltips, mensagens de validação em tempo real e overlays de carregamento. |

---

## 4. ESPECIFICAÇÃO DE COMPONENTES DA UI

### 1. Cabeçalho (Header)

* **Zona Esquerda:**
  * **Título Principal:** "YouTube Downloader" em fonte Bold/Sans-serif.
  * **Badge de Resolução:** Label secundária discreta exibindo "Até 1080p".
* **Zona Direita:**
  * **Botão Global "Purge Chronno" / "Limpar histórico":** Remove a listagem visual do feed de monitoramento.
  * **Texto Informativo de Segurança:** Aviso fixo e legível de que *"Remover itens não apaga os arquivos salvos."*

### 2. Painel de Configuração Lateral (Sidebar)

* **Campos de Entrada (Inputs):** Bloco estruturado com labels flutuantes para **"URL do YouTube"** e **"Nome do arquivo"**.
* **Área de Preview Visual:** Região central de preview demarcada geometricamente (retângulo pontilhado/dashed) abrigando o **ícone estrutural hexagonal de status**.
* **Seletor de Destino Integrado:** Campo de leitura de diretório acoplado ao botão **"Procurar Pasta"** (Ícone de pasta/diretório). O botão antigo "Purge" foi permanentemente descontinuado.
* **Botão de Ação Primária:** Localizado na base da Sidebar, com preenchimento em vermelho sólido destacado (**"Iniciar Processo"** ou **"Iniciar Download"**).

### 3. Lista de Monitoramento (Feed de Cards)

* **Estrutura do Card:** Container retangular utilizando a classe `.card-prisma-glass`.
* **Identificação da Mídia:** Exibição em destaque do título do vídeo processado (ex: "Aulas de IA", "Prompt Engineering").
* **Ações Rápidas (Text Links):** Links de atalho em linha para *"Abrir no YouTube"* e *"Mostrar arquivo"*.
* **Logs de Validação:** Linha secundária de texto monoespaçado e opacidade reduzida detalhando o status dos metadados: *"Arquivo validado: áudio, vídeo, duração e resolução conferem com o YouTube."*
* **Modificadores de Estado e Fluxo:**
  * **Durante o Download:** Renderização do ecossistema híbrido de progresso (especificado no Item 5). **É expressamente proibido renderizar valores textuais de porcentagem (ex: "100.0%") no modo fluido**, mantendo o feedback puramente visual e elegante. No modo padrão, o indicador de porcentagem opcional posiciona-se à extrema direita.
  * **Pós-Download / Histórico:** Ocultação automática das barras de progresso e entrada em cena dos botões de ação local para **"Baixar novamente"**, **"Re-Processar"** ou **"Remover do histórico" / "Purge"**.

---

## 5. ENGENHARIA HÍBRIDA DE PROGRESSO (HYBRID-PROGRESS)

Para unir a máxima estabilidade de codificação à experiência tridimensional de nível de premiação, a interface implementa um ecossistema de renderização alternável via controle de usuário.

### A. Mecanismo de Física Fluida (Liquid Neon Glow)

O modo **Fluido Magnético** substitui a barra linear por uma combinação de elementos vetoriais SVG manipulados por funções de onda e filtros de fusão orgânica (*efeito gooey*), simulando o comportamento de um ferrofluido ativo sob estresse de dados (*bitrate*).

1. **Filtro de Fusão SVG (Tensão Superficial de Elementos):**
   Deve ser declarado uma única vez na raiz do DOM (`index.html`) para gerenciar a aglutinação visual das partículas de neon:

   ```html
   <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="display: none;">
     <defs>
       <filter id="liquid-magnetic-goo">
         <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
         <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
         <feBlend in="SourceGraphic" in2="goo" />
       </filter>
     </defs>
   </svg>
   ```

2. **Estilização e Ondulação Cinemática (CSS):**

   ```css
   .liquid-track-container {
     position: relative;
     width: 100%;
     height: 8px;
     background: rgba(20, 28, 47, 0.2);
     border-radius: 4px;
     filter: url('#liquid-magnetic-goo');
     overflow: visible;
   }

   .liquid-core-stream {
     height: 100%;
     background: linear-gradient(90deg, var(--accent-primary), var(--accent-fluid-end));
     border-radius: 4px;
     position: relative;
     transition: width 0.2s cubic-bezier(0.1, 0.8, 0.3, 1);
   }

   /* Gotas satélites simulando o descolamento de ferrofluido */
   .liquid-particle-node {
     position: absolute;
     right: -4px;
     top: 50%;
     width: 12px;
     height: 12px;
     background: var(--accent-fluid-end);
     border-radius: 50%;
     transform: translateY(-50%);
     animation: pulseMagneticFluid 1.2s infinite alternate ease-in-out;
   }
   ```

### B. Componente Toggle & Arquitetura de Persistência (Local Storage)

A alternância entre o modo **Linear Estável (Standard)** e o modo **Fluido Magnético (Cyberpunk)** é gerenciada por um componente seletor do tipo Toggle posicionado estrategicamente na interface (Header ou topo do Feed).

1. **Estrutura de Estado e Chaves:**
   * **Chave do Armazenamento:** `chrono-stream:ui-engine`
   * **Valores Válidos:** `standard` (Barra Linear Tradicional) ou `cyberpunk` (Fluido Magnético Ativo).
   * **Comportamento Padrão:** Na ausência de chave gravada, o sistema inicializa obrigatoriamente no modo `standard` para priorizar a performance imediata.

2. **Mapeamento Lógico de Persistência (JavaScript):**

   ```javascript
   const TOGGLE_KEY = 'chrono-stream:ui-engine';
   const uiToggleInput = document.getElementById('progress-engine-toggle');
   const feedContainer = document.getElementById('monitoring-feed-list');

   function initializeProgressBarMode() {
     const savedMode = localStorage.getItem(TOGGLE_KEY) || 'standard';
     const isCyberpunk = (savedMode === 'cyberpunk');
     
     uiToggleInput.checked = isCyberpunk;
     feedContainer.classList.toggle('mode-cyberpunk-fluid', isCyberpunk);
   }

   uiToggleInput.addEventListener('change', (e) => {
     const currentMode = e.target.checked ? 'cyberpunk' : 'standard';
     localStorage.setItem(TOGGLE_KEY, currentMode);
     feedContainer.classList.toggle('mode-cyberpunk-fluid', e.target.checked);
   });
   ```

3. **Mapeamento Condicional Exclusivo (CSS):**
   Garante a exclusão mútua de renderização, eliminando processamento de layout desnecessário da GPU:

   ```css
   /* Comportamento Padrão: Oculta o container complexo e exibe a barra comum */
   .mode-standard-bar { display: block; }
   .liquid-track-container { display: none; }

   /* Sobrescrita Condicional: Ativada dinamicamente pela classe de escopo */
   .mode-cyberpunk-fluid .mode-standard-bar {
     display: none !important;
   }
   .mode-cyberpunk-fluid .liquid-track-container {
     display: block !important;
   }
   ```
