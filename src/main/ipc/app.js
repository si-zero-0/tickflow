/* 域：应用元信息。渲染层用它显示版本、定位数据目录，避免再硬编码版本号。 */
const { ipcMain, app } = require('electron');
const path = require('path');

module.exports = {
  name: 'app',
  register() {
    ipcMain.handle('tf:app:info', () => ({
      name: 'TickFlow',
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      packaged: app.isPackaged,
      userData: app.getPath('userData'),
      pluginsDir: path.join(app.getPath('userData'), 'plugins')
    }));
  }
};
