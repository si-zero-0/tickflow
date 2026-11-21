/* 域：系统外壳动作（打开目录）。一律走显式白名单，不接受渲染层传任意路径。 */
const { ipcMain, app, shell } = require('electron');

module.exports = {
  name: 'shell',
  register() {
    ipcMain.handle('tf:shell:open-data-dir', async () => {
      const dir = app.getPath('userData');
      const err = await shell.openPath(dir);
      return { ok: !err, dir, error: err || null };
    });
  }
};
