import { useReducer, useCallback } from 'react';

export interface ActionState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  message?: string;
}

type ActionEvent =
  | { type: 'start' }
  | { type: 'ok'; message?: string }
  | { type: 'error'; message: string };

/** Pure reducer — unit-testable without React. */
export function actionReducer(state: ActionState, event: ActionEvent): ActionState {
  switch (event.type) {
    case 'start':
      return { status: 'loading' };
    case 'ok':
      return { status: 'ok', message: event.message };
    case 'error':
      return { status: 'error', message: event.message };
    default:
      return state;
  }
}

type TaskResult = { ok: boolean; message?: string } | void;

/** Standardizes idle→loading→ok/error for every button action. */
export function useAsyncAction() {
  const [state, dispatch] = useReducer(actionReducer, { status: 'idle' });

  const run = useCallback(async (task: () => Promise<TaskResult>) => {
    dispatch({ type: 'start' });
    try {
      const result = await task();
      if (result && !result.ok) {
        dispatch({ type: 'error', message: result.message ?? 'Error desconocido' });
      } else {
        dispatch({ type: 'ok', message: result?.message });
      }
    } catch (e) {
      dispatch({
        type: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  return { state, run };
}
