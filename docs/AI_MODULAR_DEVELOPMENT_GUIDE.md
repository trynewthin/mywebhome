# MyWebHome — AI 模块开发指南 (AI Development Guide)

> **致未来的 AI Agent 伙伴**：这是一个为“零配置、内存极简、纯 Vanilla 渲染”而打造的 Neo-Brutalist 风格个人应用中台。用户只需要向你发送指令，你就可以在 `modules/` 目录下创建一个新的文件夹，平台将**全自动**为你挂载 API 路由、执行建表语句、并在左侧导航栏注入前端页面。

---

## 🏗️ 1. 模块生命周期与目录约定

每个模块必须位于 `modules/<模块核心英文名>/` 目录下。最少需要以下 3 到 4 个文件：

```text
modules/
└── example/                   # 模块根目录 (文件夹名称即 moduleId)
    ├── manifest.json          # 📢 第一步：必须存在，声明元数据
    ├── schema.sql             # 💾 第二步：(可选) 如果需要数据库，存放建表 SQL
    ├── api.js                 # 🔌 第三步：Hono Server 导出的路由实例
    └── page.js                # 🖥️ 第四步：导出一个暴露 `render(container)` 的前端脚本
```

> **启动机制**：后端 `module-loader.js` 启动时扫描 `modules/`，读到 `manifest.json` 后，自动 `runInTransaction()` 执行 `schema.sql`，并将 `api.js` 这个 Hono 实例挂载到 `/api/m/<moduleId>/*`，最后在前端仪表盘中注册。全自动，**无需去修改全局的配置文件**。

---

## 📦 2. Manifest 定义 (manifest.json)
这是一个标准的注册表文件，控制模块如何在界面上展示和自我介绍。

```json
{
  "id": "example",
  "name": "示例模块",
  "description": "面向 AI 演示如何构建模块应用",
  "icon": "🧪",
  "version": "1.0.0",
  "dashboard": true
}
```

| 字段 | 说明 |
|------|------|
| `dashboard` | 设为 `true` 后，首页仪表盘会自动加载该模块的 `widget()` 函数并显示一张摘要卡片 |

---

## 💾 3. 极速持久化：`server/db.js` 与 SQL.js

我们没有使用 MySQL 或厚重的 Prisma，整个平台跑在一个极薄的 SQLite WASM (sql.js) 内存映射数据库之上，它会自动通过 `saveDb()` 和 Dirty flag 同步到硬盘文件。
你不需要写原生的 `db.get` 除非很复杂的联表，`server/db.js` 提供了一个**万能 CRUD 发生器**：

**`schema.sql` (创建数据表结构)：**
```sql
CREATE TABLE IF NOT EXISTS example_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  amount REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**`api.js` (极速起草业务路由)：**
```javascript
import { Hono } from 'hono';
import { createCRUD, runInTransaction } from '../../server/db.js';

const app = new Hono();

// 只需要一行，即可拥有该表完整的 insert/findAll/findById/update/remove/count 功能！
const crud = createCRUD('example_data'); 

app.get('/', (c) => {
  // 可以添加 where 条件、排序以及分页
  const items = crud.findAll({ orderBy: 'id DESC', limit: 50 }); 
  const total = crud.count();
  return c.json({ items, total });
});

app.post('/', async (c) => {
  const body = await c.req.json();
  // 务必在这里进行必要的验证（避免安全漏洞）
  const result = crud.insert({ title: body.title, amount: body.amount });
  return c.json({ id: result.lastInsertRowid, success: true });
});

export default app; // 务必挂载 default 导出
```

---

## 🎨 4. 前端开发与极速搭建 (Vanilla + `window.UI`)

平台是**单页渲染 (SPA)** 驱动，绝不可直接撰写需要整页刷新的 HTML 页面。所有页面的挂载点由 `app.js` 决定，他会调用你的 `page.js` 下的 `render(container)` 函数。

**最核心的一点**：你不需要手写复杂的 DOM 拼装或 `<style>` 标签！我们有 `public/js/components.js`。在宿主环境里，直接使用 **`window.UI`** 就能调取已经高度美化（纯黑白工业风、极具冲击力的断层阴影、且百分百响应式）的 100% 可用组件。

**`page.js` 示例（含 dashboard widget）**：
```javascript
const API_BASE = '/api/m/example';

// ─── 完整页面渲染（必须导出） ───
export async function render(container) {
    const { h, modulePage, statGrid, emptyState, chartCard, toast } = window.UI;
    const { api } = window;

    const { items, total } = await api.get(API_BASE);

    const page = modulePage({
        title: '🧪 示例模块',
        actions: [
            h('button', { 
                className: 'btn btn-primary', 
                onClick: () => toast("你点击了新建按钮！") 
            }, '新建条目')
        ],
        children: [
            statGrid([
                { label: '总数', value: total },
            ]),
            chartCard({
                title: '示例趋势',
                data: [10, 50, 20, 90, 45],
                labels: ['周一', '周二', '周三', '周四', '周五'],
            }),
            items.length > 0 
                ? h('div', {}, "列表内容...")
                : emptyState({ icon: '👻', title: '啥也没有' })
        ]
    });

    container.innerHTML = '';
    container.append(page);
}

// ─── Dashboard Widget（可选导出，仅在 manifest.dashboard:true 时被调用） ───
// 会被自动渲染为首页仪表盘上的一张小卡片
export async function widget(container, { api, UI }) {
    const { items, total } = await api.get(API_BASE);
    const { h, statGrid } = UI;

    // widget 应该轻量，只展示关键摘要信息
    container.append(
        statGrid([
            { label: '总条目', value: total },
            { label: '今日新增', value: 3, change: '+2', direction: 'up' },
        ])
    );
}
```

---

## 🛠️ 5. 其他内置 CSS 类，可随意组合
如果不满足于 `window.UI` 提供的卡片，需要用 `h('div', { className: '...' })` 自己画，请善用平台已注册的美化样式，它们都会完全服从主题切换系统（如 Neo-Brutalist 或 Swiss Editorial）：

- **盒子/容器**：`class="table-wrap"`, `class="module-card"` (带有悬停投影)
- **表单控件**：`class="form-group"`, `class="form-label"`, `class="form-input"`, `class="form-select"`, `class="form-textarea"`
- **徽章特效**：`class="badge badge-primary"` / `badge-danger` / `badge-warning` / `badge-success`
- **极致反差按钮**：`class="btn btn-primary"` (实心黑客风/克莱因蓝) / `class="btn btn-ghost"` (白色阴影突刺风) / `class="btn btn-sm btn-danger"` (警告删除)

## 🚨 6. 避雷指南 (严格禁止)
1. **禁止越权修改**：新建模块开发只需在 `modules/<你的新名字>/` 里干活！不需要改动 `server/index.js`，不需要改动 `app.js` 路由，不需要自己写 SQL 初始化连接。它们统统是自动被扫描挂载的！
2. **永远不要写内联色彩**：不要写 `.style.color = "red"`，如果要着色，一定要调取 `var(--color-primary)` 或者 `var(--text-secondary)` 等全套色彩 Token，因为应用带有主题一键无缝切换功能，乱写颜色的话，浅色主题下该颜色就会看不清或刺眼。
3. **注意异步加载**：如果 `db.exec` / `page.js` 里有重量级计算，务必放在外层异步并带有合适的 Loading 反馈。
4. **CSS安全**：尽量把组件的特殊小修饰 CSS 以内联对象形式塞进 `h(tag, { style: { ... } })` 里面，以缩减应用文件数量。切勿大量声明全局 CSS 污染其它模块，确有需要的极其繁杂的特化再以 JS 动态植入 `<style>` 到本页头部。
