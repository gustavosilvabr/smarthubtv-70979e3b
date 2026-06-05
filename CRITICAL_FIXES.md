# 🔧 Correções Críticas - Passo a Passo

Este arquivo detalha EXATAMENTE o que corrigir em cada componente.

## 1️⃣ VideoPlayer.tsx - Atualizar para Expo v56

**Localização:** `android-app/src/components/VideoPlayer.tsx`

### Problema Atual
```typescript
import { Video } from 'expo-av';
// Isso está DEPRECATED em Expo v56
<Video
  source={{ uri: url }}
  useNativeControls
  resizeMode="contain"
/>
```

### Solução (Expo v56)
```typescript
import { useVideoPlayer, VideoView } from 'expo-video';

interface Props {
  source: string;
  onClose: () => void;
}

export function VideoPlayer({ source, onClose }: Props) {
  const [isPlaying, setIsPlaying] = useState(true);
  
  const player = useVideoPlayer(source, (player) => {
    player.play();
  });

  return (
    <View style={styles.container}>
      {source && (
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen
          nativeControls
          onFullscreenUpdate={(isFullscreen) => {
            if (!isFullscreen) {
              onClose();
            }
          }}
        />
      )}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <X color="white" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  closeButton: { position: 'absolute', top: 10, right: 10, zIndex: 10 },
});
```

### Checklist
- [ ] Importar `useVideoPlayer`, `VideoView` ao invés de `Video`
- [ ] Usar hook ao invés de componente
- [ ] Remover props deprecated: `useNativeControls` → `nativeControls`
- [ ] Testar playback em device

---

## 2️⃣ SeriesDetailsModal.tsx - Adicionar Abort Pattern

**Localização:** `android-app/src/components/SeriesDetailsModal.tsx`

### Problema Atual
```typescript
useEffect(() => {
  fetchSeriesDetails(item.id).then((eps) => {
    setEpisodes(eps);
  });
}, [item.id]);
// ❌ Sem abort pattern - Memory leak se desmontar durante fetch
```

### Solução
```typescript
import { fetchSeriesEpisodes } from '../utils/api-v2';

useEffect(() => {
  let active = true;
  const controller = new AbortController();

  const load = async () => {
    try {
      const episodes = await fetchSeriesEpisodes(settings, item.seriesId);
      
      // ✅ Só atualiza state se ainda está montado
      if (active) {
        setEpisodes(episodes);
      }
    } catch (err) {
      if (active && !(err instanceof DOMException)) {
        console.error('Failed to load episodes:', err);
        setError('Falha ao carregar episódios');
      }
    }
  };

  load();

  // ✅ Cleanup: abort fetch se desmontar
  return () => {
    active = false;
    controller.abort();
  };
}, [item.seriesId, settings]);
```

### Checklist
- [ ] Adicionar `active` flag
- [ ] Adicionar `AbortController`
- [ ] Usar `signal: controller.signal` em fetch (já está em api-v2.ts)
- [ ] Testar ao clicar series e fechar rápido (não deve dar warning)
- [ ] Testar ao rodar device durante carregamento

---

## 3️⃣ AmbientBackground.tsx - Remover Loop Infinito

**Localização:** `android-app/src/components/AmbientBackground.tsx`

### Problema Atual
```typescript
const runX = () => {
  Animated.sequence([...]).start(() => runX());
  // ❌ Loop recursivo infinito - memory leak
};

useEffect(() => {
  runX();
  return () => { /* cleanup insuficiente */ };
}, []);
```

### Solução
```typescript
export function AmbientBackground() {
  const disposedRef = useRef(false);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let isMounted = true;

    const animations = [...]; // suas animações aqui

    const runSequence = () => {
      if (!isMounted || disposedRef.current) return;

      animRef.current = Animated.sequence(animations);
      animRef.current.start(({ finished }) => {
        // ✅ Só executa novamente se ainda montado
        if (finished && isMounted && !disposedRef.current) {
          setTimeout(runSequence, 500); // Pequeno delay
        }
      });
    };

    runSequence();

    return () => {
      isMounted = false;
      disposedRef.current = true;
      // ✅ Abort animation
      animRef.current?.stop?.();
    };
  }, []);

  return (
    <Animated.View style={styles.container}>
      {/* seu conteúdo */}
    </Animated.View>
  );
}
```

### Checklist
- [ ] Usar `disposedRef` para controlar cleanup
- [ ] Usar `isMounted` flag
- [ ] Chamar `.stop()` na animation
- [ ] Remover recursão direta (usar setTimeout)
- [ ] Testar por 5 minutos sem memory leak

---

## 4️⃣ LoadingScreen.tsx - Tipificar Props

**Localização:** `android-app/src/components/LoadingScreen.tsx`

### Problema Atual
```typescript
interface Props {
  stage: LoadingStage;  // ❌ Undefined type
  error?: string;
  onLogout: () => void;
}
```

### Solução
```typescript
import type { FetchProgress } from '../types/iptv';

interface Props {
  phase: FetchProgress['stage'];  // ✅ Tipado corretamente
  error?: string | null;
  onLogout: () => void;
}

export function LoadingScreen({ phase, error, onLogout }: Props) {
  const messages = {
    live: 'Carregando canais ao vivo...',
    vod: 'Carregando filmes...',
    series: 'Carregando séries...',
    complete: 'Finalizando...',
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#a855f7" />
      <Text style={styles.text}>{messages[phase]}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
```

### Checklist
- [ ] Importar types de `src/types/iptv.ts`
- [ ] Remover LoadingStage custom
- [ ] Testar loading screen em App.tsx
- [ ] Verificar mensagens aparecem certas

---

## 5️⃣ LoginScreen.tsx - Adicionar Validação

**Localização:** `android-app/src/components/LoginScreen.tsx`

### Adicionar Validação de URL
```typescript
function validateServer(server: string): boolean {
  if (!server) return false;
  try {
    const url = new URL(
      server.startsWith('http') ? server : `http://${server}`
    );
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// No submit:
const handleSubmit = async () => {
  if (!validateServer(settings.server)) {
    setError('URL do servidor inválida');
    return;
  }

  if (!settings.username || !settings.password) {
    setError('Usuário e senha obrigatórios');
    return;
  }

  try {
    const valid = await validateCredentials(settings);
    if (valid) {
      onSubmit(settings);
    } else {
      setError('Credenciais inválidas');
    }
  } catch (e) {
    setError(`Erro: ${e.message}`);
  }
};
```

### Checklist
- [ ] Adicionar validação de URL
- [ ] Testar com URL inválida
- [ ] Testar com credenciais inválidas
- [ ] Mostrar erro amigável
- [ ] Desabilitar botão durante validação

---

## 6️⃣ DashboardScreen.tsx - Adicionar Error Boundary

**Localização:** `android-app/src/components/DashboardScreen.tsx`

### Adicionar Tratamento de Erro
```typescript
interface Props {
  items: M3UItem[];
  settings: IptvSettings;
  onLogout: () => void;
  onRefresh: () => void;
}

export function DashboardScreen({ items, settings, onLogout, onRefresh }: Props) {
  const [error, setError] = useState<string | null>(null);

  // Tratamento global de erros
  const handleStreamError = useCallback((err: Error) => {
    setError(err.message);
    setTimeout(() => setError(null), 5000);
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => setError(null)} style={styles.button}>
          <Text>Fechar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    // seu dashboard aqui
  );
}
```

### Checklist
- [ ] Adicionar error state
- [ ] Passar handleStreamError para VideoPlayer
- [ ] Mostrar erro em toast/banner
- [ ] Auto-fechar erro após 5s

---

## 7️⃣ App.tsx - Usar Novos Hooks

**Localização:** `android-app/App.tsx`

### Substituir
```typescript
// ❌ Antigo
import AsyncStorage from '@react-native-async-storage/async-storage';
// Credenciais em texto plano
AsyncStorage.setItem(IPTV_SETTINGS_KEY, JSON.stringify(settings));

// ✅ Novo
import { useSecureSettings } from './src/hooks/useSecureSettings';
const { settings, saveSettings, clearSettings } = useSecureSettings();

// Usar em async handlers
await saveSettings(newSettings);
```

### Substituir fetchIptvData
```typescript
// ❌ Antigo
import { fetchIptvData } from './src/utils/api';
fetchIptvData(settings, (currentPhase) => {
  setLoadingStage(currentPhase);
});

// ✅ Novo
import { fetchIptvData } from './src/utils/api-v2';
import type { FetchProgress } from './src/types/iptv';

const result = await fetchIptvData(settings, (progress: FetchProgress) => {
  setLoadingPhase(progress.stage);
});
```

### Checklist
- [ ] Remover imports de api.ts antigo
- [ ] Usar api-v2.ts
- [ ] Usar useSecureSettings hook
- [ ] Testar boot completo
- [ ] Verificar credenciais encriptadas

---

## 📋 Ordem de Implementação

1. **Copiar novos arquivos:**
   - ✅ `src/types/iptv.ts`
   - ✅ `src/hooks/useSecureSettings.ts`
   - ✅ `src/hooks/usePerformanceMetrics.ts`
   - ✅ `src/utils/api-v2.ts`

2. **Atualizar App.tsx** (mais crítico)
   - Nova importação
   - Novo estado
   - Novos hooks

3. **Atualizar componentes críticos:**
   - LoadingScreen.tsx
   - VideoPlayer.tsx (Expo v56)
   - SeriesDetailsModal.tsx (abort pattern)
   - AmbientBackground.tsx (memory leak)

4. **Atualizar componentes suporte:**
   - LoginScreen.tsx (validação)
   - DashboardScreen.tsx (error boundary)

5. **Teste completo:**
   - npm start
   - Testar todas as telas
   - Rodar TESTING_GUIDE.md

---

## ✅ Validação Final

Após todas as mudanças:

```bash
# 1. Verificar tipos
npx tsc --noEmit

# 2. Verificar imports
grep -r "from './utils/api'" android-app/src
# Deve retornar 0 (nenhum)

grep -r "from '../utils/api-v2'" android-app/src
# Deve retornar > 0 (novo import)

# 3. Verificar compilação
npm start

# 4. Testar no device
# Seguir TESTING_GUIDE.md
```

---

**Tempo estimado:** 2-3 horas
**Complexidade:** Média
**Risco:** Baixo (mudanças progressivas)
