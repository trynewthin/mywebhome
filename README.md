# 🏠 MyWebHome

> AI 驱动的模块化个人 Web 平台 — 零配置、轻量、可扩展

![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?logo=node.js&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-v4-E36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WASM-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ 特性

- **🧩 模块热插拔** — 在 `modules/` 下创建文件夹，平台自动发现、注册路由、建表、挂载前端
- **🤖 AI 原生开发** — 专为 AI Agent 设计的约定式架构，一条指令即可生成完整模块
- **📱 PWA 支持** — 离线可用、支持安装到主屏幕、移动端底部导航栏
- **🎨 Neo-Brutalist 设计** — 工业风暗色主题 + 可切换浅色模式 + 跟随系统
- **⚡ 极致轻量** — 仅 3 个依赖（Hono + sql.js + @hono/node-server），无构建步骤
- **🔒 访问保护** — 内置密码认证 + 3 次锁定 + CLI 解锁重置
- **🧱 组件库** — 预置 statCard、chartCard、imageCard 等响应式 UI 构件
- **📊 Dashboard Widget** — 模块可通过 `widget()` 导出将摘要钉到首页
- **⚙️ 模块设置** — 模块可通过 `settings()` 导出注册独立设置面板

---

## 🚀 快速开始

```bash
# 1. 克隆项目
git clone <repo-url> mywebhome
cd mywebhome

# 2. 安装依赖（仅 3 个）
npm install

# 3. 启动开发服务器
npm run dev
```

打开 `http://localhost:9753`，默认密码 `123456`。

---

## 📁 项目结构

```
mywebhome/
├── server/                 # 后端
│   ├── index.js            # Hono 主服务 + 认证中间件
│   ├── db.js               # SQLite WASM 数据库 + CRUD 生成器
│   ├── auth.js             # 密码认证 + Token 管理
│   └── module-loader.js    # 模块自动发现 & 加载器
├── public/                 # 前端静态资源
│   ├── index.html          # SPA 入口
│   ├── manifest.json       # PWA 清单
│   ├── sw.js               # Service Worker (Network-first)
│   ├── css/
│   │   ├── style.css       # 主样式 + 组件样式
│   │   └── theme-light.css # 浅色主题覆盖
│   ├── js/
│   │   ├── app.js          # 应用 Shell + 路由 + 设置
│   │   ├── router.js       # Hash 路由器
│   │   ├── api.js          # HTTP 客户端（自动携带 Token）
│   │   └── components.js   # UI 组件库
│   └── icons/              # PWA 图标
├── modules/                # 🧩 模块目录（热插拔）
├── docs/                   # AI 开发指南
├── cli.js                  # CLI 管理工具
└── package.json
```

---

## 🧩 模块开发

在 `modules/` 下创建文件夹即可，平台会自动发现和加载：

```
modules/accounting/
├── manifest.json     # 声明模块元信息
├── schema.sql        # 建表语句（可选）
├── api.js            # Hono 路由（挂载到 /api/m/<id>）
└── page.js           # 前端页面（导出 render/widget/settings）
```

### manifest.json

```json
{
  "id": "accounting",
  "name": "记账",
  "icon": "💰",
  "description": "个人收支记录",
  "version": "1.0.0",
  "dashboard": true
}
```

### page.js 导出约定

| 导出函数 | 必须 | 用途 |
|---------|------|------|
| `render(container)` | ✅ | 模块完整页面 |
| `widget(container, ctx)` | ❌ | 首页仪表盘摘要卡片 |
| `settings(container, ctx)` | ❌ | 全局设置页中的模块设置面板 |

> 详细开发指南见 [`docs/AI_MODULAR_DEVELOPMENT_GUIDE.md`](docs/AI_MODULAR_DEVELOPMENT_GUIDE.md)

---

## 🛠️ CLI 工具

```bash
node cli.js <command> [options]
```

| 命令 | 说明 |
|------|------|
| `modules` | 列出所有已注册模块 |
| `routes` | 查看已挂载的 API 路由 |
| `check` | 检查模块完整性 |
| `status` | 查看服务运行状态 |
| `backup` | 备份数据库 |
| `remove <id> [--data]` | 删除模块（`--data` 同时清除数据表） |
| `passwd <新密码>` | 重置访问密码 & 解锁 |
| `restart` | 重启开发服务器 |
| `help` | 查看帮助 |

---

## 🔧 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 运行时 | Node.js ≥18 | ESM + Top-level Await |
| 后端 | Hono | 轻量级 Web 框架 |
| 数据库 | sql.js (SQLite WASM) | 内存映射，定时持久化 |
| 前端 | Vanilla JS | 零框架，原生 ES Module |
| 样式 | Vanilla CSS | CSS 变量 + 主题系统 |
| PWA | Service Worker | Network-first 缓存策略 |

---

## 📄 License

MIT
