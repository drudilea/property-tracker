import { useState, useEffect, useCallback } from 'react';
import type { AppStatus, UpdateInfo } from '../../shared/ipc-contract';
import type { AppConfig } from '../../main/config';
import type { ThemePref } from './theme';
import { resolveTheme, loadThemePref, saveThemePref } from './theme';
import { api } from './api';
import { Header } from './components/Header';
import { UpdateBanner } from './components/UpdateBanner';
import { Home } from './components/Home';
import { Settings } from './components/Settings';
import { Onboarding } from './components/Onboarding';

type Screen = 'home' | 'settings';

export function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [themePref, setThemePref] = useState<ThemePref>(loadThemePref);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  // Apply resolved theme to document
  useEffect(
    function applyTheme() {
      const theme = resolveTheme(themePref, systemDark);
      document.documentElement.dataset['theme'] = theme === 'dark' ? 'dark' : '';
    },
    [themePref, systemDark],
  );

  // Listen for OS theme changes
  useEffect(function subscribeToSystemTheme() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function handleSystemThemeChange(e: MediaQueryListEvent) {
      setSystemDark(e.matches);
    }
    mq.addEventListener('change', handleSystemThemeChange);
    return () => mq.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const refresh = useCallback(async function refresh() {
    const [nextStatus, nextConfig] = await Promise.all([
      api.getStatus(),
      api.getConfig(),
    ]);
    setStatus(nextStatus);
    setConfig(nextConfig);
  }, []);

  // Load initial data on mount
  useEffect(function loadInitial() {
    void refresh();
  }, [refresh]);

  // Check for a newer release once on mount
  useEffect(function checkUpdate() {
    api.checkForUpdate().then(setUpdate).catch(() => undefined);
  }, []);

  function handleThemeToggle() {
    const next: ThemePref =
      resolveTheme(themePref, systemDark) === 'dark' ? 'light' : 'dark';
    saveThemePref(next);
    setThemePref(next);
  }

  function handleConfigUpdate(next: AppConfig) {
    setConfig(next);
  }

  const currentTheme = resolveTheme(themePref, systemDark);

  if (!status || !config) {
    return (
      <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>
        Cargando…
      </div>
    );
  }

  const showOnboarding = !status.configured;

  return (
    <>
      <Header
        version={status.appVersion}
        configured={status.configured}
        showScreenToggle={status.configured}
        theme={currentTheme}
        screen={screen}
        onThemeToggle={handleThemeToggle}
        onScreenToggle={() => setScreen((s) => (s === 'home' ? 'settings' : 'home'))}
      />
      <UpdateBanner update={update} />
      {showOnboarding ? (
        <Onboarding config={config} onConfigUpdate={handleConfigUpdate} onRefresh={refresh} />
      ) : screen === 'home' ? (
        <Home config={config} />
      ) : (
        <Settings config={config} onConfigUpdate={handleConfigUpdate} onRefresh={refresh} />
      )}
    </>
  );
}
