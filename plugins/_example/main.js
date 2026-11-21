/* 示例插件（主进程侧）。当前宿主只扫描 manifest、不执行本文件——见 docs/DECISIONS.md §插件加载的四个阶段。
 * 启用后约定：导出一个 register(ctx) 函数，ctx 提供 { app, ipcMain, paths }，插件只能注册自己的 tf:plugin:<id>:* 频道。
 */
module.exports = {
  register(ctx) {
    // ctx.ipcMain.handle('tf:plugin:com.example.hello:ping', () => 'pong');
    void ctx;
  }
};
