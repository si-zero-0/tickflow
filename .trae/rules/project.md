# TickFlow v1.13.0 · Trae 项目规则

1. 先读根目录 `START-HERE.md`、`AGENTS.md`、`docs/handoff/01-PRD-v1.13.md`、`02-UI-SPEC.md`。
2. 按 `docs/handoff/06-TASK-BREAKDOWN.md` 的 T0→T1→T2→T3 顺序做，不跳阶段。
3. 现有项目是 Electron + 原生 HTML/CSS/JS，不换框架、不引入 React/Vue/Tailwind。
4. 不复制参考应用的 AI 业务（模型供应商/MCP/子代理/终端/手机/代码工作区）；只借视觉与设置 IA。
5. 渲染层不 `require`；系统能力走 `preload.js` 的 `tfBridge` 白名单。
6. 主窗口持有唯一 Store，不设独立岛窗口。
7. 颜色只用 token；组件禁止裸 hex；9 套配色见 `docs/handoff/schemes.json`。
8. 不新增运行时依赖。
9. 每阶段跑 `npm run verify && npm test && npm run stage`；Phase 2 加 `cd src/main && npx electron stage`。
10. 偏差写 `docs/handoff/IMPLEMENTATION-NOTES.md`，不要停下来问。
11. 每次交付前按 `docs/handoff/DELIVERY-CHECKLIST.md` 逐项检查；汇报必须附六项结果，未做或未过写明原因。
