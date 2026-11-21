/* 域：插件目录扫描（只读，不执行插件代码）。
 * 扫描根：%APPDATA%\TickFlow\plugins（用户装）→ 包内 resources\plugins（随包内置）→ 仓库 plugins\（开发期）
 * 约定：以 _ 或 . 开头的目录跳过（_example 是契约示例，不参与加载）。
 */
const fs = require('fs');
const path = require('path');
const { ipcMain, app } = require('electron');

function roots() {
  const list = [path.join(app.getPath('userData'), 'plugins')];
  if (app.isPackaged) list.push(path.join(process.resourcesPath, 'plugins'));
  else list.push(path.join(__dirname, '..', '..', '..', 'plugins'));
  return list;
}

function readManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return { valid: false, error: '缺少 manifest.json' };
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    const missing = ['id', 'name', 'version'].filter((k) => !manifest[k]);
    if (missing.length) return { valid: false, manifest, error: 'manifest 缺字段: ' + missing.join(', ') };
    return { valid: true, manifest };
  } catch (e) {
    return { valid: false, error: 'manifest 解析失败: ' + e.message };
  }
}

function scan() {
  const found = [];
  for (const root of roots()) {
    if (!fs.existsSync(root)) continue;
    let names = [];
    try { names = fs.readdirSync(root); } catch (e) { continue; }
    for (const name of names) {
      if (!name || name[0] === '_' || name[0] === '.') continue;
      const dir = path.join(root, name);
      try { if (!fs.statSync(dir).isDirectory()) continue; } catch (e) { continue; }
      const { valid, manifest, error } = readManifest(dir);
      const m = manifest || {};
      found.push({
        id: m.id || name,
        name: m.name || name,
        version: m.version || null,
        enabled: m.enabled !== false,
        dir,
        root,
        valid,
        error: error || null
      });
    }
  }
  return found;
}

module.exports = {
  name: 'plugins',
  register() {
    ipcMain.handle('tf:plugins:list', () => scan());
  },
  scan
};
