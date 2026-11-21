/* 顶部岛专用桥：比主窗桥更窄，只有快照/提醒/动作三件事。
 * 岛不能读 Store、不能 require、不能直接操作主窗。
 */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  ready: () => ipcRenderer.send('island:ready'),
  resize: (h) => ipcRenderer.send('island:resize', Number(h) || 52),
  act: (action) => {
    if (!action || typeof action !== 'object') return;
    ipcRenderer.send('island:act', { type: String(action.type || ''), id: String(action.id || '') });
  },
  openMain: () => ipcRenderer.send('island:open-main'),
  dismissed: (id) => ipcRenderer.send('island:dismissed', String(id || '')),
  onSnapshot(cb) {
    if (typeof cb !== 'function') return () => {};
    const fn = (_e, data) => cb(data);
    ipcRenderer.on('island:snapshot', fn);
    return () => ipcRenderer.removeListener('island:snapshot', fn);
  },
  onRemind(cb) {
    if (typeof cb !== 'function') return () => {};
    const fn = (_e, data) => cb(data);
    ipcRenderer.on('island:remind', fn);
    return () => ipcRenderer.removeListener('island:remind', fn);
  },
  onDismiss(cb) {
    if (typeof cb !== 'function') return () => {};
    const fn = (_e, id) => cb(id);
    ipcRenderer.on('island:dismiss', fn);
    return () => ipcRenderer.removeListener('island:dismiss', fn);
  }
};

contextBridge.exposeInMainWorld('islandBridge', Object.freeze(api));
