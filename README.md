# Prompt: Aplicativo IPTV Mobile (Android Horizontal)

> **Objetivo**: Criar, do zero, um aplicativo Android nativo ou React Native para TV Box/Smartphone Android, **sempre em orientação horizontal (landscape)**. O app é um player IPTV completo baseado na experiência web do **Smart Hub Play TV**.

---

## 1. Visão Geral

O app é um player IPTV premium com login Xtream Codes, suportando:
- **Canais ao vivo (Live TV)** com EPG
- **Filmes (VOD)**
- **Séries** com temporadas e episódios
- **Favoritos** e **recentes** para todos os tipos de conteúdo
- Navegação otimizada para **controle remoto / D-pad**

---

## 2. Fluxo de Telas

### 2.1 Tela de Login
- Fundo escuro com efeito de luz roxa/ambiente blur.
- Logo centralizada (Smart Hub Play TV).
- Subtítulo: "Xtream Codes Compatible".
- 3 campos de entrada:
  - **Servidor / URL** (placeholder: `https://servidor.com`)
  - **Usuário**
  - **Senha** (com opção de mostrar/ocultar)
- Botão principal: **Entrar**
- Texto inferior: "Seus dados ficam salvos apenas neste dispositivo."
- Validação: todos os campos obrigatórios.
- Ao logar, salva as credenciais no armazenamento local seguro (SharedPreferences/Keychain).
- Se já houver credenciais salvas, pula direto para a tela de carregamento.

### 2.2 Tela de Carregamento (Loading)
- Fundo escuro com animação de progresso.
- Etapas animadas em sequência (com ~700ms entre cada):
  1. "Carregando canais ao vivo..."
  2. "Carregando filmes..."
  3. "Carregando séries..."
  4. "Carregando guia de programação..."
  5. "Concluído!"
- Durante o carregamento, o app faz uma única requisição ao backend para buscar a lista M3U completa (live + VOD + séries).
- Em caso de erro, mostra a mensagem e um botão **"Tentar novamente"**.

### 2.3 Tela Home (Dashboard)
- Layout em grid com 4 tiles grandes e coloridos:
  - **LIVE TV** (verde/ciano) — tile grande, ocupa 2 linhas na esquerda
  - **MOVIES** (vermelho/laranja)
  - **SERIES** (roxo/fúcsia)
  - **SETTINGS** (verde-água)
- Cada tile mostra o ícone e a quantidade de itens disponíveis.
- No topo: logo + relógio com data/hora em tempo real (atualiza a cada 30s).
- No rodapé: "Smart Hub Play TV · IPTV Player Premium".
- Ao tocar em um tile, navega para a respectiva tela.

---

## 3. Telas Principais (Layout de 3 Colunas)

Todas as telas de conteúdo (Live TV, Movies, Series) compartilham o **mesmo layout horizontal de 3 colunas**:

```
+-----------------------------------------------------------+
| [←]   [Search_________________________]   [⚙] [...] [⛭]  |  <- Top Bar
+-----------------------------------------------------------+
|             |                  |                          |
| CATEGORIAS  |  LISTA DE ITENS  |       PLAYER/PREVIEW     |  <- 3 Colunas
| (esquerda)  |   (centro)       |      (direita)           |
|             |                  |                          |
+-----------------------------------------------------------+
```

### Top Bar (comum a todas)
- **Esquerda**: botão circular com seta para voltar → volta para a Home.
- **Centro**: barra de busca com placeholder **"Search"**. Filtra em tempo real a lista central.
- **Direita**: ícones circulares para:
  - Player / Categorias / Opções / Configurações
  - Configurações abre a tela de ajustes de conta.

---

## 4. Tela LIVE TV

### Coluna 1 — Categorias
- Painel arredondado com fundo escuro translúcido.
- Campo de busca interno: "Search in categories".
- Categorias fixas no topo:
  - **All** (todos os canais)
  - **Recently Viewed** (últimos canais assistidos)
  - **Favorite** (canais favoritos)
- Abaixo: lista de categorias reais do servidor, ordenadas por quantidade de canais.
- Cada item mostra nome da categoria + badge com contagem.
- Item ativo: borda dourada/âmbar, gradiente roxo, texto âmbar.

### Coluna 2 — Lista de Canais
- Painel arredondado com fundo escuro translúcido.
- Lista rolável com os canais da categoria selecionada.
- Cada item mostra:
  - Número da posição (1, 2, 3...)
  - Ícone/logo do canal (quadrado arredondado)
  - Nome do canal
  - Ícone de coração se for favorito
- Item selecionado: borda âmbar, gradiente roxo, texto âmbar, sombra dourada sutil.
- **Comportamento**:
  - Ao clicar em um canal: carrega automaticamente no player da direita.
  - Ao clicar no player: entra em **tela cheia**.
  - Canal assistido é salvo nos "Recentes" (máximo 30).

### Coluna 3 — Player + EPG
- **Player de vídeo** (aspecto 16:9, arredondado):
  - Usa biblioteca nativa de vídeo (ExoPlayer no Android) com suporte a HLS (.m3u8), MPEG-TS (.ts) e fallback.
  - Mostra spinner âmbar "Carregando canal..." enquanto bufferiza.
  - Em erro: overlay escuro com mensagem + botão "Tentar novamente".
  - Sem canal selecionado: ícone de TV cinza no centro.
  - Ícone de fullscreen no canto superior direito (aparece no hover/focus).
- **Barra de ações abaixo do player** (quando canal selecionado):
  - Nome do canal + categoria
  - Botões: **Favorite** (coração), **Catch Up**, **Tela cheia**
- **Painel EPG (Guia de Programação)** abaixo:
  - Título: "Guia de programação" com ícone de calendário.
  - Lista horizontal rolável de programas em cards.
  - Cada card mostra: horário início–fim, título, dia da semana.
  - Programa ao vivo: badge "Ao vivo" + barra de progresso âmbar.
  - Programa selecionado: card com borda e gradiente ativo.
  - Abaixo dos cards: detalhe do programa selecionado (título, horário, descrição, badge "Agora" se for o atual).

---

## 5. Tela MOVIES

Mesmo layout de 3 colunas, adaptado para filmes.

### Coluna 1 — Categorias
- Igual à Live TV: All, Recently Viewed, Favorite + categorias reais.

### Coluna 2 — Lista de Filmes
- Lista rolável de filmes.
- Cada item mostra:
  - Número da posição
  - Poster do filme (thumbnail 2:3)
  - Nome do filme
  - Ícone de coração se favorito
- **Performance**: carregar os primeiros 200 itens; botão "Carregar mais" para exibir o restante em lotes de 300.
- Busca com debounce de 180ms para não travar ao digitar.

### Coluna 3 — Player / Poster
- Se nenhum filme estiver em reprodução: mostra o **poster do filme selecionado** com opacidade reduzida.
- Overlay com botão grande **"Assistir"** (âmbar, com ícone play).
- Ao clicar em "Assistir" ou dar duplo-clique no item: inicia a reprodução no player.
- Player nativo com HLS/MP4, fullscreen ao tocar.
- Barra de ações: Favorite, Play, Tela cheia.
- Timeout de carregamento VOD: **60 segundos** (mais tolerante que live).

---

## 6. Tela SERIES

Mesmo layout de 3 colunas, adaptado para séries.

### Coluna 1 — Categorias
- Igual às outras telas.

### Coluna 2 — Lista de Séries
- Lista rolável de séries.
- Cada item mostra:
  - Número da posição
  - Capa da série
  - Nome da série
  - Ícone de coração se favorito
- Mesma otimização de performance (carga gradual + debounce).

### Coluna 3 — Player + Episódios
- **Área superior**: poster da série selecionada (se não estiver reproduzindo).
  - Mostra nome, gênero e sinopse (2 linhas) sobrepostos.
  - Ao clicar: inicia o player.
- **Player**: reproduz episódio selecionado (HLS/MP4, fullscreen ao tocar, timeout 60s).
- **Barra de ações**: Favorite, Voltar (quando player ativo), Tela cheia.
- **Painel de Episódios** abaixo:
  - Tabs horizontais: "Temporada 1", "Temporada 2", etc.
  - Lista rolável de episódios da temporada selecionada.
  - Cada episódio: número redondo + título + "T1 · E5" + ícone play.
  - Episódio em reprodução: destaque com borda âmbar e gradiente roxo.
  - Ao clicar no episódio: carrega no player.

---

## 7. Tela de Configurações (Settings)
- Tela simples, fundo escuro.
- Título: "Configurações".
- 3 campos editáveis: Servidor, Usuário, Senha (preenchidos com os dados atuais).
- Botões:
  - **Salvar e atualizar** — salva e recarrega a lista M3U do zero.
  - **Voltar para Home**
  - **Sair / Trocar conta** — limpa credenciais e volta para a tela de login.

---

## 8. Backend / APIs

O app se comunica com um backend intermediário (ou pode chamar a API Xtream diretamente no mobile). As APIs necessárias são:

### 8.1 Autenticação & Lista M3U
```
GET /api/m3u?server={url}&username={u}&password={p}
```
- Retorna uma playlist M3U completa com:
  - Canais ao vivo (`.m3u8` + fallback `.ts`)
  - Filmes (`.mp4`/`.mkv`)
  - Séries (`xtream-series://{id}`)
- Cada item tem metadados: `tvg-name`, `tvg-logo`, `group-title`, `tvg-id`.
- Comentários `#SMART-HUB:` indicam `type` (live/movie/series) e `stream-id`.

### 8.2 EPG (Guia de Programação)
```
GET /api/epg?streamId={id}&limit=24&server={url}&username={u}&password={p}
```
- Retorna JSON: `{ programs: [{ id, title, description, start, stop }] }`.
- `start` e `stop` são timestamps Unix (segundos).
- Títulos e descrições vêm Base64 — precisam ser decodificados.

### 8.3 Info da Série
```
GET /api/series-info?id={seriesId}&server={url}&username={u}&password={p}
```
- Retorna JSON com: `name`, `plot`, `cover`, `backdrop`, `rating`, `genre`, `cast`, `director`, `seasons[]`, `episodes[]`.
- Cada episódio: `id`, `title`, `season`, `episode`, `url`, `cover`, `duration`, `plot`.

### 8.4 Proxy de Stream (opcional, para CORS)
```
GET /api/stream?u={url}
```
- Faz proxy do stream HTTP para HTTPS, reescrevendo playlists `.m3u8` internas.
- Headers CORS liberados. User-Agent: `VLC/3.0.20`.

---

## 9. Comportamentos e Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Orientação** | Sempre landscape (horizontal). Travar rotação no AndroidManifest. |
| **Armazenamento local** | SharedPreferences: credenciais, favoritos, recentes (live/movies/series separados). |
| **Favoritos** | Um Set de IDs salvos localmente. Ícone de coração preenchido quando ativo. |
| **Recentes** | Máximo 30 itens por tipo (live, movie, series). Último assistido fica no topo. |
| **Busca** | Filtra pelo nome, case-insensitive. Debounce de 180ms nas listas grandes. |
| **Reprodução** | Prioridade: HLS (.m3u8) → MPEG-TS (.ts) → Native (MP4/etc). Fallback automático. |
| **Timeout Live** | 20 segundos para canais ao vivo. |
| **Timeout VOD** | 60 segundos para filmes e séries. |
| **Fullscreen** | Ao tocar no player ou no botão fullscreen. Sai com botão voltar do Android. |
| **EPG** | Atualiza a cada 30 segundos a barra de progresso do programa ao vivo. |
| **Navegação remota** | Todos os elementos focáveis devem ter foco visível (borda âmbar/destaque) para D-pad. |
| **Lazy loading imagens** | Thumbnails carregam sob demanda (`loading="lazy"` equivalente nativo). |

---

## 10. Design System

- **Tema**: Escuro profundo, estilo premium IPTV.
- **Cores principais**:
  - Fundo: `#0a0613` (quase preto com tom roxo)
  - Painéis: `#140a24` com transparência 80%
  - Destaque / Acento: **âmbar/dourado** (`#fbbf24` / `#f59e0b`)
  - Gradientes ativos: roxo (`#7e22ce` → `#4c1d95`)
- **Bordas**: arredondadas (`rounded-2xl`), borda sutil branca 10% opacidade.
- **Tipografia**: Sans-serif moderna, títulos em bold, labels em uppercase tracking wide.
- **Sombras**: sombras suaves roxas/âmbar em itens ativos.
- **Blur**: backdrop blur nos painéis para efeito de vidro fosco.

---

## 11. Stack Sugerido

- **Android Nativo**: Kotlin + Jetpack Compose (Compose TV para foco em TV Box)
- **Ou React Native**: React Native + `react-native-video` (ExoPlayer) + `react-native-tvos` (focus engine)
- **Player**: ExoPlayer (Android) — suporta HLS, DASH, MP4, TS nativamente.
- **HTTP**: OkHttp / Retrofit (nativo) ou Fetch API (RN).
- **Imagens**: Coil (Kotlin) ou FastImage (RN) com lazy loading.
- **Navegação**: Compose Navigation (nativo) ou React Navigation (RN).

---

## 12. Checklist de Entrega

- [ ] Login com Xtream Codes (server, user, pass)
- [ ] Tela de loading com etapas animadas
- [ ] Home com 4 tiles (Live, Movies, Series, Settings)
- [ ] Live TV: 3 colunas (categorias, canais, player+EPG)
- [ ] Movies: 3 colunas (categorias, filmes, player/poster)
- [ ] Series: 3 colunas (categorias, séries, player+episódios)
- [ ] EPG com grade horizontal, programa ao vivo e barra de progresso
- [ ] Player com HLS/TS/MP4, fullscreen, loading e retry
- [ ] Favoritos e Recentes em todas as telas
- [ ] Busca com debounce nas listas
- [ ] Configurações para editar/trocar conta
- [ ] Layout sempre horizontal, otimizado para controle remoto
- [ ] Navegação por D-pad com foco visível
