import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel, IpcEvent } from '../shared/ipc-contract';
import type { AppConfig } from '../main/config';
import type { AppStatus, RendererApi } from '../shared/ipc-contract';

const api: RendererApi = {
  getConfig: () => ipcRenderer.invoke(IpcChannel.GetConfig),
  setConfig: (config: AppConfig) => ipcRenderer.invoke(IpcChannel.SetConfig, config),
  getStatus: () => ipcRenderer.invoke(IpcChannel.GetStatus),
  scrape: (url: string) => ipcRenderer.invoke(IpcChannel.Scrape, url),
  onStatusChanged: (listener: (status: AppStatus) => void) => {
    const handler = (_e: unknown, status: AppStatus) => listener(status);
    ipcRenderer.on(IpcEvent.StatusChanged, handler);
    return () => ipcRenderer.removeListener(IpcEvent.StatusChanged, handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
