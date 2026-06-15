import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

interface HelpProps {
  children: React.ReactNode;
  href?: string;
}

export function Help({ children, href }: HelpProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(function closeOnOutside() {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeydown);

    return function cleanup() {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [open]);

  return (
    <span className="help" ref={containerRef}>
      <button
        type="button"
        className="help-btn"
        aria-label="Ayuda"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div className="help-popover" role="tooltip">
          <div className="help-popover-body">{children}</div>
          {href && (
            <button
              type="button"
              className="btn-secondary help-guide-btn"
              onClick={() => api.openExternal(href)}
            >
              Abrir guía
            </button>
          )}
        </div>
      )}
    </span>
  );
}
