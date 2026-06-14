import { describe, it, expect } from 'vitest';
import { actionReducer, type ActionState } from './useAsyncAction';

const idle: ActionState = { status: 'idle' };
describe('actionReducer', () => {
  it('start → loading', () => {
    expect(actionReducer(idle, { type: 'start' })).toEqual({ status: 'loading' });
  });
  it('ok → ok with message', () => {
    expect(actionReducer({ status: 'loading' }, { type: 'ok', message: 'hecho' })).toEqual({
      status: 'ok',
      message: 'hecho',
    });
  });
  it('error → error with message', () => {
    expect(
      actionReducer({ status: 'loading' }, { type: 'error', message: 'mal' }),
    ).toEqual({ status: 'error', message: 'mal' });
  });
});
