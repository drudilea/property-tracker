import { contextBridge, ipcRenderer } from 'electron';
import { IpcInvokeChannel, IpcEvent } from '../shared/ipc-contract';
import type { AppStatus, IpcInvokeApi, RendererApi } from '../shared/ipc-contract';

/** Build the invoke half of the bridge by wrapping each registered channel in
 * an ipcRenderer.invoke call, so adding a method to the registry auto-generates
 * its wrapper. */
function buildInvokeApi(): IpcInvokeApi {
  const entries = Object.entries(IpcInvokeChannel) as [
    keyof IpcInvokeApi,
    string,
  ][];
  const api = {} as Record<string, (...args: unknown[]) => Promise<unknown>>;
  for (const [name, channel] of entries) {
    api[name] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);
  }
  return api as unknown as IpcInvokeApi;
}

const api: RendererApi = {
  ...buildInvokeApi(),
  onStatusChanged: (listener: (status: AppStatus) => void) => {
    const handler = (_e: unknown, status: AppStatus) => listener(status);
    ipcRenderer.on(IpcEvent.StatusChanged, handler);
    return () => ipcRenderer.removeListener(IpcEvent.StatusChanged, handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
