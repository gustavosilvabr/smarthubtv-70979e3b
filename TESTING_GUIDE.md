# 🧪 Testes de Performance - Android App

## 📱 Setup Inicial

### Pré-requisitos
- Android device ou emulator (API 30+)
- Expo Go instalado no device
- Node.js 18+
- npm ou yarn

### Instalação
```bash
cd android-app
npm install
npm start
```

## ⚡ Teste 1: Boot Performance

### Objetivo
Medir tempo de boot do app até tela de Login/Dashboard

### Procedimento
1. Abrir app em Expo Go
2. Medir tempo até tela estar totalmente carregada (stopwatch)
3. Verificar se ActivityIndicator desaparece

### Métricas
- **Bom:** < 5s (conexão boa)
- **Aceitável:** 5-10s  
- **Ruim:** > 10s

### Checklist
- [ ] Fontes carregam sem lag
- [ ] Sem erros no console
- [ ] AsyncStorage carrega settings corretamente
- [ ] Transition suave para próxima tela

---

## 📊 Teste 2: Fetch de Dados (Loading Phase)

### Objetivo
Medir tempo de sincronização com servidor IPTV

### Procedimento
1. Entrar com credenciais válidas
2. Observar tela LoadingScreen
3. Cronometrar cada fase:
   - Live (canais ao vivo)
   - VOD (filmes)
   - Series (séries)
   - Complete

### Métricas
- **Bom:** 
  - Live: 3-5s
  - VOD: 2-4s
  - Series: 2-4s
  - **Total: < 15s**

- **Aceitável:** Total 15-30s
- **Ruim:** > 30s

### Checklist
- [ ] Progress bar avança suavemente
- [ ] Fases aparecem na ordem correta
- [ ] Sem erros de conexão
- [ ] Dados salvos corretamente
- [ ] Pode fazer logout durante loading

---

## 🎬 Teste 3: Playback de Stream (Live)

### Objetivo
Testar reprodução de stream ao vivo sem travamento

### Procedimento
1. Navegar para aba "Live"
2. Selecionar um canal
3. Cronometrar até começar a reproduzir
4. Observar qualidade de vídeo

### Métricas
- **Bom:** 
  - Start: < 2s
  - Sem travamento/buffering
  - Full HD (1920x1080) fluido

- **Aceitável:** 
  - Start: 2-5s
  - Buffers ocasionais

- **Ruim:** 
  - Start: > 5s
  - Travamentos frequentes

### Checklist
- [ ] Vídeo abre em full screen
- [ ] Controls aparecem ao tocar
- [ ] Sem áudio delay
- [ ] Qualidade adaptativa funcionando
- [ ] Botão close funciona
- [ ] Volta para lista de canais

---

## 🍿 Teste 4: VOD (Filme)

### Objetivo
Testar reprodução de arquivo sob demanda

### Procedimento
1. Navegar para aba "Movies"
2. Selecionar um filme
3. Iniciar reprodução
4. Testar seek forward/backward

### Métricas
- **Bom:** 
  - Start: < 3s
  - Seek instantâneo
  - Sem lag em FF/RW

- **Aceitável:** Start 3-5s
- **Ruim:** > 5s ou lag em seek

### Checklist
- [ ] Poster/thumbnail exibe
- [ ] Play/pause funciona
- [ ] Seek slider funciona
- [ ] FF/RW suave
- [ ] Duração exibe corretamente

---

## 📺 Teste 5: Series (Episódios)

### Objetivo
Testar navegação de série e reprodução de episódios

### Procedimento
1. Navegar para aba "Series"
2. Clicar em uma série
3. Modal abre com episódios
4. Selecionar um episódio
5. Reproduzir

### Métricas
- **Bom:** 
  - Modal abre: < 2s
  - Lista de episódios carrega: < 1s
  - Start playback: < 3s

- **Aceitável:** Modal 2-4s, playback 4-6s
- **Ruim:** > 5s modal ou > 6s playback

### Checklist
- [ ] Série info exibe corretamente
- [ ] Episódios organizados por temporada
- [ ] Modal fecha com back button
- [ ] Episódio reproduz ao selecionar
- [ ] Volta para série ao fechar vídeo

---

## 💾 Teste 6: Performance de Memória

### Objetivo
Verificar se há memory leaks durante navegação

### Procedimento
1. Abrir Android Studio > Device Monitor
2. Monitorar "Memory" durante:
   - 30 segundos navegação entre telas
   - 5 minutos reproduzindo vídeo
   - Trocar canal 10x

### Métricas
- **Bom:** 
  - Uso estável (não cresce contínuamente)
  - < 300MB
  - Garbage collection automático

- **Aceitável:** 
  - Cresce lentamente
  - < 500MB
  - GC limpa memória

- **Ruim:** 
  - Cresce rapidamente
  - > 500MB
  - App fica lento

### Checklist
- [ ] Sem memory leak warnings
- [ ] App não fica lento com o tempo
- [ ] Sem crashes por memory

---

## 🔒 Teste 7: Segurança de Credenciais

### Objetivo
Verificar que credenciais não estão em texto plano

### Procedimento
1. Abrir app e entrar com credenciais
2. Abrir Android Studio > Device File Explorer
3. Navegar para `/data/data/com.smarthub-play-tv/`
4. Procurar arquivo AsyncStorage
5. Verificar conteúdo

### Métricas
- **✅ BOM:** 
  - Credenciais encriptadas (base64/XOR)
  - Não legível em texto plano

- **❌ RUIM:** 
  - Credenciais em texto plano
  - Username/password visíveis

### Checklist
- [ ] Settings estão encriptados
- [ ] Não consegue ler credenciais direto
- [ ] Após logout, credenciais apagadas
- [ ] Após login novo, credenciais atualizadas

---

## 🌐 Teste 8: Adaptação de Bandwidth

### Objetivo
Verificar se app se adapta à conexão

### Procedimento
1. Abrir Settings > Network
2. Simular diferentes conexões:
   - WiFi 5GHz (fast)
   - WiFi 2.4GHz (medium)
   - Mobile 4G (slow)

3. Observar comportamento em cada um

### Métricas
- **WiFi Fast (>20Mbps):**
  - Buffer maior = mais fluido
  - Quality = "excellent"

- **Mobile (5-10Mbps):**
  - Buffer médio = balanceado
  - Quality = "fair"

- **Slow (<5Mbps):**
  - Buffer minimal = mais responsivo
  - Quality = "poor"

### Checklist
- [ ] App detecta conexão
- [ ] Buffer ajusta automaticamente
- [ ] Qualidade de vídeo adapta
- [ ] Sem travamentos mesmo em conexão lenta

---

## 🐛 Teste 9: Tratamento de Erros

### Procedimento
Testar situações de erro:

### Cenário 1: Credenciais Inválidas
```
1. Abrir app
2. Entrar com user inválido
3. Deve mostrar erro e voltar para login
```
✅ Esperado: Erro claro, volta para login

### Cenário 2: Servidor Offline
```
1. Desligar wifi
2. Tentar login
3. Deve timeout com mensagem clara
```
✅ Esperado: "Servidor indisponível" após 10s

### Cenário 3: Stream Indisponível
```
1. Selecionar canal que está offline
2. Tocar play
3. Deve mostrar erro ou tentar fallback URL
```
✅ Esperado: "Canal temporariamente indisponível" ou retry automático

### Checklist
- [ ] Erros são claros e em português
- [ ] Sem crashes
- [ ] App fica em estado consistente
- [ ] Pode fazer logout qualquer hora

---

## 📋 Teste 10: Rotação de Tela

### Procedimento
Testar behavior ao rodar device

### Cenário 1: Rotação em Login
```
1. Login screen
2. Rotacionar device
3. Layout deve se adaptar
```

### Cenário 2: Rotação em Playback
```
1. Reproduzindo vídeo
2. Rotacionar device
3. Vídeo deve entrar em fullscreen landscape
```

### Cenário 3: Rotação em Dashboard
```
1. Tela de canais/filmes
2. Rotacionar device
3. Tiles devem se reorganizar
```

### Checklist
- [ ] Sem crashes ao rotacionar
- [ ] Layout responsivo
- [ ] Vídeo fullscreen em landscape
- [ ] Volta normal em portrait

---

## 📊 Relatório Final

Preencher após testes:

```markdown
# Relatório de Testes - Android App

**Data:** [data]
**Device:** [modelo + Android version]
**Conexão:** [WiFi/4G + speed]

## Resultados

| Teste | Status | Tempo | Obs |
|-------|--------|-------|-----|
| Boot | ✅/⚠️/❌ | XXs | - |
| Fetch Dados | ✅/⚠️/❌ | XXs | - |
| Live Playback | ✅/⚠️/❌ | XXs | - |
| VOD Playback | ✅/⚠️/❌ | XXs | - |
| Series | ✅/⚠️/❌ | XXs | - |
| Memória | ✅/⚠️/❌ | XXMb | - |
| Segurança | ✅/⚠️/❌ | - | - |
| Bandwidth | ✅/⚠️/❌ | - | - |
| Erros | ✅/⚠️/❌ | - | - |
| Rotação | ✅/⚠️/❌ | - | - |

## Problemas Encontrados

1. [Problema]
   - Severidade: Alta/Média/Baixa
   - Reprodução: [como reproduzir]
   - Solução: [proposta]

## Aprovação

- [ ] Todos os testes passaram
- [ ] App pronto para produção
- [ ] Pronto para publicar Google Play

---
**Testado por:** [seu nome]
**Versão:** [app version]
```

---

**Dúvidas?** Consulte REFACTORING_GUIDE.md
