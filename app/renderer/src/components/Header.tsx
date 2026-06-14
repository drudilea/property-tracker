import type { Theme } from '../theme';
import logo from '../assets/logo.png';

type Screen = 'home' | 'settings';

interface HeaderProps {
  version: string;
  configured: boolean;
  theme: Theme;
  screen: Screen;
  onThemeToggle: () => void;
  onScreenToggle: () => void;
}

export function Header({
  version,
  configured,
  theme,
  screen,
  onThemeToggle,
  onScreenToggle,
}: HeaderProps) {
  const isDark = theme === 'dark';

  return (
    <header className="header">
      <span className="header-title" aria-label={`Property Tracker v${version}`}>
        <img className="header-logo" src={logo} alt="" />
        Property Tracker
      </span>
      <span className={`header-pill${configured ? ' configured' : ''}`}>
        {configured ? 'Configurado ✓' : '—'}
      </span>
      <button
        className="header-action"
        onClick={onThemeToggle}
        title={isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
        aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        {isDark ? '☀️' : '🌙'}
      </button>
      <button
        className="header-action"
        onClick={onScreenToggle}
        title={screen === 'settings' ? 'Volver al inicio' : 'Ajustes'}
        aria-label={screen === 'settings' ? 'Volver al inicio' : 'Ajustes'}
      >
        {screen === 'settings' ? '✕' : '⚙️'}
      </button>
    </header>
  );
}
