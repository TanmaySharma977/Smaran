import { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export const lightColors = {
  background: '#FFFFFF', surface: '#F7F7F9', primary: '#007AFF',
  text: '#1C1C1E', textSecondary: '#8E8E93', border: '#E5E5EA', danger: '#FF3B30',
};
export const darkColors = {
  background: '#000000', surface: '#1C1C1E', primary: '#0A84FF',
  text: '#FFFFFF', textSecondary: '#98989D', border: '#38383A', danger: '#FF453A',
};

type Mode = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{
  mode: Mode; colors: typeof lightColors; setMode: (m: Mode) => void;
}>({ mode: 'system', colors: lightColors, setMode: () => {} });

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((v) => { if (v) setModeState(v as Mode); });
  }, []);

  function setMode(m: Mode) {
    setModeState(m);
    AsyncStorage.setItem('theme_mode', m);
  }

  const resolved = mode === 'system' ? system ?? 'light' : mode;
  const colors = resolved === 'dark' ? darkColors : lightColors;

  return <ThemeContext.Provider value={{ mode, colors, setMode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);