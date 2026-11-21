/* 安全桥：渲染层只能看到这里显式暴露的方法。
 * 规则：新增能力必须在 src/main/ipc/ 注册 handler，并在此加一行；不要在渲染层直接用 require。
 */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  info: () => ipcRenderer.invoke('tf:app:info'),
  plugins: () => ipcRenderer.invoke('tf:plugins:list'),
  openDataDir: () => ipcRenderer.invoke('tf:shell:open-data-dir'),
  openExternal: (url) => ipcRenderer.invoke('tf:shell:open-external', String(url || '')),
  onCommand(handler) {
    if (typeof handler !== 'function') return () => {};
    const listener = (_event, command, payload) => handler(command, payload);
    ipcRenderer.on('tf:command', listener);
    return () => ipcRenderer.removeListener('tf:command', listener);
  },
  /* 应用更新：检查/下载/安装；进度由主进程单向推回 */
  update: {
    check: (force) => ipcRenderer.invoke('tf:update:check', { force: !!force }),
    download: () => ipcRenderer.invoke('tf:update:download'),
    install: () => ipcRenderer.invoke('tf:update:install'),
    state: () => ipcRenderer.invoke('tf:update:state'),
    openReleasePage: () => ipcRenderer.invoke('tf:update:open-release'),
    onStatus(handler) {
      if (typeof handler !== 'function') return () => {};
      const listener = (_event, status) => handler(status);
      ipcRenderer.on('tf:update:status', listener);
      return () => ipcRenderer.removeListener('tf:update:status', listener);
    }
  }
};

contextBridge.exposeInMainWorld('tfBridge', Object.freeze(api));
