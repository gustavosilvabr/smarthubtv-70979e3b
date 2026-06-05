import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IptvSettings } from '../types/iptv';

const SETTINGS_KEY = 'iptv_settings_v2';

// Simple XOR encryption for basic obfuscation (not cryptographically secure, but better than plain text)
const encryptString = (str: string, seed: number = 42): string => {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) ^ (seed % 256));
    seed = (seed * 31 + 1) % 256;
  }
  return Buffer.from(bytes).toString('base64');
};

const decryptString = (encrypted: string, seed: number = 42): string => {
  const bytes = Buffer.from(encrypted, 'base64');
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i] ^ (seed % 256));
    seed = (seed * 31 + 1) % 256;
  }
  return result;
};

export const useSecureSettings = () => {
  const [settings, setSettings] = useState<IptvSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (!active) return;

        if (stored) {
          try {
            const encrypted = JSON.parse(stored);
            const decrypted: IptvSettings = {
              server: decryptString(encrypted.server),
              username: decryptString(encrypted.username),
              password: decryptString(encrypted.password),
              protocol: encrypted.protocol || 'http',
              port: encrypted.port,
            };
            setSettings(decrypted);
          } catch (e) {
            console.error('Failed to decrypt settings:', e);
            setError('Falha ao ler configurações salvas');
          }
        }
        setLoading(false);
      } catch (e) {
        if (active) {
          console.error('Failed to load settings:', e);
          setError('Erro ao carregar configurações');
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: IptvSettings) => {
    try {
      const encrypted = {
        server: encryptString(newSettings.server),
        username: encryptString(newSettings.username),
        password: encryptString(newSettings.password),
        protocol: newSettings.protocol || 'http',
        port: newSettings.port,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(encrypted));
      setSettings(newSettings);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      console.error('Failed to save settings:', e);
      setError(`Falha ao salvar: ${msg}`);
      throw e;
    }
  }, []);

  const clearSettings = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      setSettings(null);
      setError(null);
    } catch (e) {
      console.error('Failed to clear settings:', e);
      setError('Erro ao limpar configurações');
    }
  }, []);

  return { settings, loading, error, saveSettings, clearSettings };
};
