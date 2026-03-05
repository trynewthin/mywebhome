/**
 * MyWebHome — 前端主应用
 */
import './api.js';
import './components.js';
import router from './router.js';

const app = document.getElementById('app');
let modules = [];
const moduleRenderers = new Map();
const moduleWidgets = new Map();
const moduleSettings = new Map();

async function fetchModules() {
    try {
        const res = await window.api.get('/api/modules');
        modules = Array.isArray(res) ? res : (res.modules ?? []);
    } catch {
        modules = [];
    }
}

async function loadModulePage(moduleId) {
    if (moduleRenderers.has(moduleId)) return;
    try {
        const mod = await import(`/modules/${moduleId}/page.js`);
        if (mod.render) {
            moduleRenderers.set(moduleId, mod.render);
        }
        if (mod.widget) {
            moduleWidgets.set(moduleId, mod.widget);
        }
        if (mod.settings) {
            moduleSettings.set(moduleId, mod.settings);
        }
    } catch (err) {
        console.warn(`模块 ${moduleId} 前端脚本加载失败:`, err);
    }
}

// ─── 渲染 Shell ───
function renderShell() {
    app.innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <div class="sidebar-logo-icon">🏠</div>
            <span class="sidebar-logo-text">MyWebHome</span>
          </div>
          <button class="sidebar-toggle" id="btn-collapse" title="折叠/展开边栏">◀</button>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav">
          <div class="nav-section-title">导航</div>
          <div class="nav-item active" data-route="/" id="nav-home" title="仪表盘">
            <span class="nav-item-icon">📊</span>
            <span>仪表盘</span>
          </div>
          <div class="nav-section-title">应用模块</div>
          <div id="nav-modules"></div>
          <div class="nav-section-title">系统</div>
          <div class="nav-item" data-route="/settings" id="nav-settings" title="设置">
            <span class="nav-item-icon">⚙️</span>
            <span>设置</span>
          </div>
        </nav>
        <div class="sidebar-footer">
          MyWebHome v0.1.0 · Powered by AI
        </div>
      </aside>
      <main class="main">
        <header class="header">
          <div class="header-title" id="header-title">仪表盘</div>
          <div class="header-actions">
            <button class="btn btn-ghost btn-sm" id="btn-theme" title="切换主题">🌞</button>
          </div>
        </header>
        <div class="content" id="content"></div>
      </main>
    </div>
    <!-- 移动端底部导航栏 -->
    <nav class="bottom-bar" id="bottom-bar">
      <div class="bottom-bar-item active" data-route="/" id="btm-home">
        <span class="bottom-bar-icon">📊</span>
        <span class="bottom-bar-label">首页</span>
      </div>
      <div class="bottom-bar-item bottom-bar-launcher" id="btm-launcher">
        <span class="bottom-bar-icon">📦</span>
        <span class="bottom-bar-label">资源库</span>
      </div>
      <div class="bottom-bar-item" data-route="/settings" id="btm-settings">
        <span class="bottom-bar-icon">⚙️</span>
        <span class="bottom-bar-label">设置</span>
      </div>
    </nav>
    <!-- 资源库弹出菜单 -->
    <div class="launcher-overlay" id="launcher-overlay">
      <div class="launcher-panel" id="launcher-panel">
        <div class="launcher-header">
          <span>资源库</span>
          <button class="launcher-close" id="launcher-close">✕</button>
        </div>
        <div class="launcher-search">
          <input type="text" class="form-input" id="launcher-search-input" placeholder="搜索模块...">
        </div>
        <div class="launcher-grid" id="launcher-grid"></div>
      </div>
    </div>
  `;

    renderModuleNav();
    renderLauncherGrid();

    // 绑定导航点击
    document.getElementById('nav-home').addEventListener('click', () => router.navigate('/'));
    document.getElementById('nav-settings').addEventListener('click', () => router.navigate('/settings'));
    document.getElementById('btm-home').addEventListener('click', () => router.navigate('/'));
    document.getElementById('btm-settings').addEventListener('click', () => router.navigate('/settings'));
    initLauncher();

    // ─── 主题系统初始化 ───
    initThemeSystem();

    // ─── 侧边栏折叠 (PC端) ───
    const btnCollapse = document.getElementById('btn-collapse');
    const sidebar = document.getElementById('sidebar');

    const initCollapsed = localStorage.getItem('mywebhome-sidebar-collapsed') === 'true';
    if (initCollapsed) {
        sidebar.classList.add('collapsed');
        btnCollapse.textContent = '▶';
    }

    btnCollapse.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        localStorage.setItem('mywebhome-sidebar-collapsed', isCollapsed);
        btnCollapse.textContent = isCollapsed ? '▶' : '◀';
    });

    // 路由变化时更新导航高亮
    router.onNavigate = (path) => {
        updateActiveNav(path);
        updateBottomBarActive(path);
    };
}

// ─── 主题系统 ───

function initThemeSystem() {
    const btnTheme = document.getElementById('btn-theme');

    // 读取是否显示顶栏按钮
    const showHeaderThemeBtn = localStorage.getItem('mywebhome-show-theme-btn') !== 'false';
    btnTheme.style.display = showHeaderThemeBtn ? 'inline-flex' : 'none';

    applyTheme();

    btnTheme.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('mywebhome-theme', next);
        applyTheme();
    });

    // 监听系统主题变化（auto 模式下实时响应）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (localStorage.getItem('mywebhome-theme') === 'auto') {
            applyTheme();
        }
    });
}

function applyTheme() {
    const setting = localStorage.getItem('mywebhome-theme') || 'dark';
    let resolved;

    if (setting === 'auto') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
        resolved = setting;
    }

    document.documentElement.setAttribute('data-theme', resolved);

    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
        btnTheme.textContent = resolved === 'dark' ? '🌞' : '🌙';
    }
}

// ─── 侧边栏导航 ───

function renderModuleNav() {
    const container = document.getElementById('nav-modules');
    if (!container) return;

    if (modules.length === 0) {
        container.innerHTML = `
      <div style="padding: 12px; color: var(--text-muted); font-size: 0.82rem;">
        暂无模块
      </div>
    `;
        return;
    }

    container.innerHTML = modules.map(m => `
    <div class="nav-item" data-route="/m/${m.id}" id="nav-${m.id}">
      <span class="nav-item-icon">${m.icon}</span>
      <span>${m.name}</span>
    </div>
  `).join('');

    modules.forEach(m => {
        const navEl = document.getElementById(`nav-${m.id}`);
        if (navEl) {
            navEl.addEventListener('click', () => router.navigate(`/m/${m.id}`));
        }
    });
}

function updateActiveNav(path) {
    document.querySelectorAll('.nav-item').forEach(el => {
        const route = el.dataset.route;
        if (route === path || (route && route !== '/' && path.startsWith(route))) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

// ─── 资源库弹出菜单 (移动端) ───

function renderLauncherGrid() {
    const grid = document.getElementById('launcher-grid');
    if (!grid) return;

    if (modules.length === 0) {
        grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);font-size:0.85rem;">
        暂无模块
      </div>
    `;
        return;
    }

    grid.innerHTML = modules.map(m => `
    <div class="launcher-item" data-route="/m/${m.id}">
      <div class="launcher-item-icon">${m.icon}</div>
      <div class="launcher-item-name">${m.name}</div>
    </div>
  `).join('');

    // 绑定点击
    grid.querySelectorAll('.launcher-item').forEach(el => {
        el.addEventListener('click', () => {
            const route = el.dataset.route;
            closeLauncher();
            router.navigate(route);
        });
    });
}

function initLauncher() {
    const overlay = document.getElementById('launcher-overlay');
    const btnLauncher = document.getElementById('btm-launcher');
    const btnClose = document.getElementById('launcher-close');
    const searchInput = document.getElementById('launcher-search-input');

    btnLauncher.addEventListener('click', () => {
        overlay.classList.toggle('open');
        if (overlay.classList.contains('open')) {
            searchInput.value = '';
            filterLauncherItems('');
            setTimeout(() => searchInput.focus(), 200);
        }
    });

    btnClose.addEventListener('click', closeLauncher);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeLauncher();
    });

    searchInput.addEventListener('input', () => {
        filterLauncherItems(searchInput.value.trim().toLowerCase());
    });
}

function filterLauncherItems(keyword) {
    document.querySelectorAll('.launcher-item').forEach(el => {
        const name = el.querySelector('.launcher-item-name')?.textContent.toLowerCase() || '';
        el.style.display = (!keyword || name.includes(keyword)) ? '' : 'none';
    });
}

function closeLauncher() {
    const overlay = document.getElementById('launcher-overlay');
    if (overlay) overlay.classList.remove('open');
}

function updateBottomBarActive(path) {
    // 高亮首页和设置按钮
    document.querySelectorAll('.bottom-bar-item[data-route]').forEach(el => {
        const route = el.dataset.route;
        if (route === path || (route && route !== '/' && path.startsWith(route))) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

// ─── 页面渲染 ───

function renderDashboard() {
    const content = document.getElementById('content');
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) headerTitle.textContent = '仪表盘';

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 6) return '🌙 夜深了';
        if (hour < 12) return '☀️ 早上好';
        if (hour < 18) return '🌤️ 下午好';
        return '🌆 晚上好';
    };

    if (modules.length === 0) {
        content.innerHTML = `
      <div class="fade-in">
        <div class="dashboard-greeting">
          <h1>${getGreeting()}</h1>
          <p>欢迎来到 MyWebHome，你的个人模块化 Web 平台。</p>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">🚀</div>
          <div class="empty-state-title">还没有安装任何模块</div>
          <div class="empty-state-desc">
            用 AI 创建你的第一个模块吧！只需要在 modules/ 目录下创建符合约定的文件夹，平台会自动发现并加载。
          </div>
        </div>
      </div>
    `;
        return;
    }

    content.innerHTML = `
    <div class="fade-in">
      <div class="dashboard-greeting">
        <h1>${getGreeting()}</h1>
        <p>你已安装 ${modules.length} 个模块，快去使用吧。</p>
      </div>
      <div class="module-grid" id="module-grid"></div>
      <div class="dashboard-widgets" id="dashboard-widgets"></div>
    </div>
  `;

    const grid = document.getElementById('module-grid');
    modules.forEach(m => {
        const card = document.createElement('div');
        card.className = 'module-card';
        card.innerHTML = `
      <div class="module-card-icon">${m.icon}</div>
      <div class="module-card-name">${m.name}</div>
      <div class="module-card-desc">${m.description || '暂无描述'}</div>
    `;
        card.addEventListener('click', () => router.navigate(`/m/${m.id}`));
        grid.append(card);
    });

    // 加载 dashboard widget
    loadDashboardWidgets();
}

async function loadDashboardWidgets() {
    const container = document.getElementById('dashboard-widgets');
    if (!container) return;

    // 筛选启用了 dashboard 的模块
    const dashboardModules = modules.filter(m => m.dashboard === 1 || m.dashboard === true);
    if (dashboardModules.length === 0) return;

    for (const m of dashboardModules) {
        // 先确保模块的 page.js 已加载
        await loadModulePage(m.id);

        const widgetFn = moduleWidgets.get(m.id);
        if (!widgetFn) continue;

        // 创建 widget 容器卡片
        const widgetWrap = document.createElement('div');
        widgetWrap.className = 'dashboard-widget-card';
        widgetWrap.innerHTML = `
      <div class="dashboard-widget-header">
        <span class="dashboard-widget-title">${m.icon} ${m.name}</span>
        <button class="btn btn-ghost btn-sm dashboard-widget-goto">前往 →</button>
      </div>
      <div class="dashboard-widget-body"></div>
    `;

        widgetWrap.querySelector('.dashboard-widget-goto').addEventListener('click', () => {
            router.navigate(`/m/${m.id}`);
        });

        container.append(widgetWrap);

        // 调用 widget 函数渲染内容
        const body = widgetWrap.querySelector('.dashboard-widget-body');
        try {
            const el = await widgetFn(body, { moduleId: m.id, api: window.api, UI: window.UI });
            if (el instanceof HTMLElement) {
                body.append(el);
            }
        } catch (err) {
            body.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem;padding:12px">Widget 加载失败</div>`;
            console.warn(`模块 ${m.id} widget 加载失败:`, err);
        }
    }
}

// ─── 设置页面 ───

function renderSettings() {
    const content = document.getElementById('content');
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) headerTitle.textContent = '设置';

    const currentTheme = localStorage.getItem('mywebhome-theme') || 'dark';
    const showBtn = localStorage.getItem('mywebhome-show-theme-btn') !== 'false';

    content.innerHTML = `
    <div class="module-page fade-in">

      <div class="settings-search">
        <input type="text" class="form-input" id="settings-search-input" placeholder="搜索设置项...">
      </div>

      <div id="settings-cards-area">
      <div class="settings-section">
        <div class="settings-card" data-settings-title="外观">
          <div class="settings-card-title">外观</div>

          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">颜色模式</div>
              <div class="settings-row-desc">选择界面的深浅色方案</div>
            </div>
            <select class="form-select" id="setting-theme" style="width: auto; min-width: 120px;">
              <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>深色</option>
              <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>浅色</option>
              <option value="auto" ${currentTheme === 'auto' ? 'selected' : ''}>跟随系统</option>
            </select>
          </div>

          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-label">顶栏主题切换按钮</div>
              <div class="settings-row-desc">是否在页面顶部导航栏显示快捷切换按钮</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-show-theme-btn" ${showBtn ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
      </div>
      <div id="module-settings-area"></div>
    </div>
  `;

    // 绑定事件
    document.getElementById('setting-theme').addEventListener('change', (e) => {
        localStorage.setItem('mywebhome-theme', e.target.value);
        applyTheme();
    });

    document.getElementById('setting-show-theme-btn').addEventListener('change', (e) => {
        const show = e.target.checked;
        localStorage.setItem('mywebhome-show-theme-btn', show);
        const btnTheme = document.getElementById('btn-theme');
        if (btnTheme) btnTheme.style.display = show ? 'inline-flex' : 'none';
    });

    // 设置页搜索过滤
    document.getElementById('settings-search-input').addEventListener('input', (e) => {
        const keyword = e.target.value.trim().toLowerCase();
        document.querySelectorAll('.settings-card').forEach(card => {
            const title = (card.dataset.settingsTitle || card.querySelector('.settings-card-title')?.textContent || '').toLowerCase();
            const labels = [...card.querySelectorAll('.settings-row-label')].map(l => l.textContent.toLowerCase()).join(' ');
            const match = !keyword || title.includes(keyword) || labels.includes(keyword);
            card.closest('.settings-section').style.display = match ? '' : 'none';
        });
    });

    // 加载模块设置面板
    loadModuleSettings();
}

async function loadModuleSettings() {
    const area = document.getElementById('module-settings-area');
    if (!area) return;

    for (const m of modules) {
        await loadModulePage(m.id);

        const settingsFn = moduleSettings.get(m.id);
        if (!settingsFn) continue;

        // 创建模块设置卡片
        const card = document.createElement('div');
        card.className = 'settings-section';
        card.innerHTML = `
      <div class="settings-card">
        <div class="settings-card-title">${m.icon} ${m.name}</div>
        <div class="settings-card-body"></div>
      </div>
    `;
        area.append(card);

        const body = card.querySelector('.settings-card-body');
        try {
            const el = await settingsFn(body, { moduleId: m.id, api: window.api, UI: window.UI });
            if (el instanceof HTMLElement) {
                body.append(el);
            }
        } catch (err) {
            body.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:0.8rem">设置加载失败</div>`;
            console.warn(`模块 ${m.id} settings 加载失败:`, err);
        }
    }
}

async function renderModulePage(path, moduleId) {
    const content = document.getElementById('content');
    const headerTitle = document.getElementById('header-title');

    if (!moduleId) {
        moduleId = path.replace(/^\/m\//, '').split('/')[0];
    }

    const moduleInfo = modules.find(m => m.id === moduleId);
    if (headerTitle) {
        headerTitle.textContent = moduleInfo ? moduleInfo.name : moduleId;
    }

    await loadModulePage(moduleId);

    const renderer = moduleRenderers.get(moduleId);
    if (renderer) {
        content.innerHTML = '';
        const el = await renderer(content, { moduleId, path, api: window.api, UI: window.UI });
        if (el instanceof HTMLElement) {
            content.append(el);
        }
    } else {
        content.innerHTML = `
      <div class="empty-state fade-in">
        <div class="empty-state-icon">🔧</div>
        <div class="empty-state-title">模块页面加载失败</div>
        <div class="empty-state-desc">模块 "${moduleId}" 未提供前端页面 (page.js)。</div>
      </div>
    `;
    }
}

// ─── 启动 ───
// ─── 登录界面 ───

function renderLogin() {
    app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-header">
          <div class="sidebar-logo-icon" style="width:40px;height:40px;font-size:20px;margin-bottom:16px">🏠</div>
          <h1>MYWEBHOME</h1>
          <p>请输入访问密码</p>
        </div>
        <div class="login-body" id="login-body">
          <input type="password" class="form-input" id="login-pwd" placeholder="密码" autofocus>
          <button class="btn btn-primary" id="login-btn" style="width:100%;margin-top:12px">进入系统</button>
          <div id="login-msg" style="margin-top:12px;font-size:0.8rem;min-height:1.5em"></div>
        </div>
      </div>
    </div>
  `;

    const pwdInput = document.getElementById('login-pwd');
    const loginBtn = document.getElementById('login-btn');
    const msgEl = document.getElementById('login-msg');

    const doLogin = async () => {
        const pwd = pwdInput.value.trim();
        if (!pwd) return;

        loginBtn.disabled = true;
        loginBtn.textContent = '验证中...';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd }),
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('mywebhome-token', data.token);
                init();
            } else if (data.locked) {
                msgEl.style.color = 'var(--color-danger)';
                msgEl.textContent = '⛔ 账号已锁定，请联系管理员使用 CLI 重置密码：node cli.js passwd';
                loginBtn.disabled = true;
                loginBtn.textContent = '已锁定';
                pwdInput.disabled = true;
            } else {
                msgEl.style.color = 'var(--color-warning)';
                msgEl.textContent = `❌ 密码错误，剩余 ${data.remaining} 次机会`;
                pwdInput.value = '';
                pwdInput.focus();
                loginBtn.disabled = false;
                loginBtn.textContent = '进入系统';
            }
        } catch {
            msgEl.style.color = 'var(--color-danger)';
            msgEl.textContent = '网络错误，请稍后重试';
            loginBtn.disabled = false;
            loginBtn.textContent = '进入系统';
        }
    };

    loginBtn.addEventListener('click', doLogin);
    pwdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doLogin();
    });
}

// ─── 启动 ───
async function init() {
    // 先检查现有 token 是否有效
    const token = localStorage.getItem('mywebhome-token');
    if (token) {
        try {
            const res = await fetch('/api/auth/check', {
                headers: { 'X-Auth-Token': token },
            });
            const data = await res.json();
            if (!data.valid) {
                localStorage.removeItem('mywebhome-token');
                renderLogin();
                return;
            }
        } catch {
            renderLogin();
            return;
        }
    } else {
        renderLogin();
        return;
    }

    await fetchModules();
    renderShell();

    router.register('/', () => renderDashboard());
    router.register('/settings', () => renderSettings());

    modules.forEach(m => {
        router.register(`/m/${m.id}`, (path) => renderModulePage(path, m.id));
    });

    router.init();
}

init();
