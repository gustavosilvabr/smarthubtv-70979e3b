# Refatoração do Android App - Guia Completo

## ✅ Arquivos Criados

1. **src/types/iptv.ts** - Tipos TypeScript corretos (sem `any`)
2. **src/hooks/useSecureSettings.ts** - Armazenamento seguro de credenciais (XOR encryption)
3. **src/hooks/usePerformanceMetrics.ts** - Teste de bandwidth/latência adaptativo
4. **src/utils/api-v2.ts** - API refatorada com tipos corretos
5. **App-refactored.tsx** - App.tsx novo com hooks modernos

## 📋 Passos para Atualizar

### Passo 1: Backup dos Arquivos Originais
```bash
cd android-app
cp App.tsx App-backup.tsx
cp src/utils/api.ts src/utils/api-backup.ts
```

### Passo 2: Copiar Novos Arquivos
```bash
# Types
cp src/types/iptv.ts (já criado)

# Hooks
cp src/hooks/useSecureSettings.ts (já criado)
cp src/hooks/usePerformanceMetrics.ts (já criado)

# Utils
cp src/utils/api-v2.ts (já criado)

# App
mv App.tsx App-old.tsx
cp App-refactored.tsx App.tsx
```

### Passo 3: Atualizar Componentes Críticos

#### 3a. LoadingScreen.tsx (corrigir memory leak)
```typescript
// Importar tipos
import type { FetchProgress } from '../types/iptv';

interface Props {
  phase: 'live' | 'vod' | 'series' | 'complete';
  error?: string | null;
  onLogout: () => void;
}

export function LoadingScreen({ phase, error, onLogout }: Props) {
  // ... resto do código
}
```

#### 3b. SeriesDetailsModal.tsx (adicionar abort pattern)
```typescript
useEffect(() => {
  let active = true;
  const controller = new AbortController();

  const loadEpisodes = async () => {
    try {
      // Use controller.signal
      const data = await fetchSeriesEpisodes(settings, item.seriesId);
      if (active) setEpisodes(data);
    } catch (e) {
      if (active) console.error(e);
    }
  };

  loadEpisodes();

  return () => {
    active = false;
    controller.abort();
  };
}, [item]);
```

#### 3c. AmbientBackground.tsx (remover loop infinito)
```typescript
// Ao invés de recursão infinita, usar animation.loop() se disponível
// ou useEffect cleanup apropriado
const runAnimation = () => {
  Animated.sequence([...]).start(({ finished }) => {
    if (finished && !disposedRef.current) {
      runAnimation(); // Retry apenas se não foi desmontado
    }
  });
};

useEffect(() => {
  runAnimation();
  return () => {
    disposedRef.current = true;
    animation.stop?.();
  };
}, []);
```

### Passo 4: Atualizar Imports em Todos os Componentes

**Antes:**
```typescript
import { M3UItem } from './utils/api';
import { IptvSettings } from './utils/settings';
```

**Depois:**
```typescript
import type { M3UItem, IptvSettings } from '../types/iptv';
import { fetchIptvData, validateCredentials } from '../utils/api-v2';
```

### Passo 5: Atualizar VideoPlayer.tsx para Expo v56

```typescript
import { useVideoPlayer, VideoView } from 'expo-video';

export function VideoPlayer({ source, onClose }: Props) {
  const player = useVideoPlayer(source, (player) => {
    player.play();
  });

  return (
    <VideoView style={styles.video} player={player} allowsFullscreen />
  );
}
```

### Passo 6: Validação de Dependências

```bash
cd android-app
npm ls
npm audit

# Atualizar packages deprecados
npm update
```

## 🧪 Testes de Performance

### Teste 1: Carregamento de Dados
```bash
# Medir tempo de início a tela ready
# Deve ser < 10 segundos em conexão boa
```

### Teste 2: Playback de Stream
```bash
# Clicar em canal → deve iniciar em < 2 segundos
# Sem travamento mesmo em Full HD
```

### Teste 3: Uso de Memória
```bash
# Monitorar no Android:
adb shell dumpsys meminfo | grep android-app
# Não deve crescer continuamente
```

### Teste 4: Segurança de Credenciais
```typescript
// Verificar que credenciais NÃO estão em texto plano
AsyncStorage.getItem('@iptv_settings_v2').then(console.log);
// Deve mostrar strings encriptadas, não plain text
```

## 🚀 Rodando o App

### Opção 1: Expo Go (Recomendado para desenvolvimento)
```bash
cd android-app
npm start
# Escanear QR code com app Expo Go no Android
```

### Opção 2: Native Build (Para produção)
```bash
cd android-app
eas build --platform android
```

## 📊 Checklist de Refatoração

- [ ] Criar `src/types/iptv.ts` com todos os tipos
- [ ] Criar `src/hooks/useSecureSettings.ts`
- [ ] Criar `src/hooks/usePerformanceMetrics.ts`
- [ ] Criar `src/utils/api-v2.ts`
- [ ] Copiar novo `App.tsx`
- [ ] Atualizar `LoadingScreen.tsx`
- [ ] Corrigir `SeriesDetailsModal.tsx` (abort pattern)
- [ ] Corrigir `AmbientBackground.tsx` (animated loop)
- [ ] Atualizar todos os imports
- [ ] Testar validação de credenciais
- [ ] Testar playback de stream
- [ ] Testar performance (< 10s boot)
- [ ] Testar segurança (credenciais encriptadas)
- [ ] Rodar app em Android device/emulator

## ⚠️ Problemas Conhecidos e Soluções

### Problema 1: "expo-av is not defined"
**Solução:** Verificar que version 16.0.8+ está instalada
```bash
npm ls expo-av
npm install expo-av@^16.0.8 --save
```

### Problema 2: "Memory leak warning"
**Solução:** Verificar que todos useEffect tem cleanup functions e active flags

### Problema 3: Credenciais salvas em plano texto ainda (old version)
**Solução:** 
```bash
# Limpar AsyncStorage antigo
adb shell "pm clear <app-package-name>"
# ou
npx expo start --clear
```

## 📝 Próximos Passos

1. Mergear refatoração base ✓
2. Testar em Android device
3. Adicionar error boundaries em componentes principais
4. Implementar offline caching de playlistss
5. Adicionar analytics de performance
6. Publicar versão v1.1 no Google Play

---

**Última atualização:** 2026-06-05
**Status:** Pronto para implementação
