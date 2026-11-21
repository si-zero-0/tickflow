/* 安全桥：渲染层只能看到这里显式暴露的方法。
 * 规则：新增能力必须在 src/main/ipc/ 注册 handler，并在此加一行；不要在渲染层直接用 require。
 */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  info: () => ipcRenderer.invoke('tf:app:info'),
  plugins: () => ipcRenderer.invoke('tf:plugins:list'),
  openDataDir: () => ipcRenderer.invoke('tf:shell:open-data-dir'),
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
  },
  /* M3 顶部岛：主窗单向推送快照/提醒；动作由主进程回推到主窗 */
  topIsland: {
    configure: (cfg) => ipcRenderer.invoke('tf:top-island:configure', cfg),
    snapshot: (snap) => ipcRenderer.send('tf:top-island:snapshot', snap),
    remind: (task) => ipcRenderer.send('tf:top-island:remind', task),
    dismiss: (id) => ipcRenderer.send('tf:top-island:dismiss', id),
    onAction(handler) {
      if (typeof handler !== 'function') return () => {};
      const listener = (_event, action) => handler(action);
      ipcRenderer.on('tf:island:action', listener);
      return () => ipcRenderer.removeListener('tf:island:action', listener);
    },
    onStatus(handler) {
      if (typeof handler !== 'function') return () => {};
      const listener = (_event, status) => handler(status);
      ipcRenderer.on('tf:island:status', listener);
      return () => ipcRenderer.removeListener('tf:island:status', listener);
    }
  }
};

contextBridge.exposeInMainWorld('tfBridge', Object.freeze(api));
