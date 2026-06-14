import type { ActionState } from '../hooks/useAsyncAction';

interface StatusLineProps {
  state: ActionState;
}

export function StatusLine({ state }: StatusLineProps) {
  if (state.status === 'idle') return null;

  if (state.status === 'loading') {
    // The triggering button already shows a spinner, so we only surface the
    // (optional) informative loading message here — no second spinner.
    if (!state.message) return null;
    return <p className="status loading">{state.message}</p>;
  }

  if (state.status === 'ok') {
    return <p className="status ok">{state.message}</p>;
  }

  return <p className="status err">{state.message}</p>;
}
