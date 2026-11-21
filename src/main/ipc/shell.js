/* 域：系统外壳动作（打开目录 / 反馈链接）。一律走显式白名单，不接受渲染层传任意 URL。 */
const { ipcMain, app, shell } = require('electron');

const FEEDBACK_URLS = [
  'https://space.bilibili.com/1138070117',
  'https://github.com/si-zero-0/tickflow',
  'https://github.com/si-zero-0/tickflow/issues',
  'https://github.com/si-zero-0/tickflow/releases/latest'
];

module.exports = {
  name: 'shell',
  register() {
    ipcMain.handle('tf:shell:open-data-dir', async () => {
      const dir = app.getPath('userData');
      const err = await shell.openPath(dir);
      return { ok: !err, dir, error: err || null };
    });
    ipcMain.handle('tf:shell:open-external', async (_e, url) => {
      if (typeof url !== 'string' || FEEDBACK_URLS.indexOf(url) < 0) return { ok: false };
      await shell.openExternal(url);
      return { ok: true };
    });
  }
};
