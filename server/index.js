import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { loadModules, getInstalledModules } from './module-loader.js';
import { ensurePassword, verifyPassword, verifyToken } from './auth.js';

const isDev = process.env.NODE_ENV !== 'production';
const app = new Hono();

// ─── 中间件 ───

if (isDev) {
    app.use('*', logger());
}

app.onError((err, c) => {
    console.error(`❌ ${c.req.method} ${c.req.path}`, err.message);
    return c.json(
        { error: isDev ? err.message : '服务器内部错误' },
        500
    );
});

// ─── 认证 API（不需要 token） ───

ensurePassword();

app.post('/api/auth/login', async (c) => {
    const { password } = await c.req.json();
    const result = verifyPassword(password || '');
    return c.json(result);
});

app.get('/api/auth/check', (c) => {
    const token = c.req.header('X-Auth-Token');
    return c.json({ valid: verifyToken(token || '') });
});

// ─── 认证中间件（保护除 auth 外的所有 API） ───

app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    // auth 接口本身不需要鉴权
    if (path.startsWith('/api/auth/')) return next();

    const token = c.req.header('X-Auth-Token');
    if (!verifyToken(token || '')) {
        return c.json({ error: '未授权，请先登录' }, 401);
    }
    return next();
});

// ─── 系统 API ───

app.get('/api/modules', (c) => {
    const modules = getInstalledModules();
    return c.json({ modules });
});

app.get('/api/health', (c) => {
    return c.json({
        status: 'ok',
        uptime: Math.round(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    });
});

// ─── 加载模块 ───
const loaded = await loadModules(app);

// ─── 静态文件服务 ───
app.use('/modules/*', serveStatic({ root: './' }));
app.use('/*', serveStatic({ root: './public' }));
app.get('*', serveStatic({ path: './public/index.html' }));

// ─── 启动服务 ───
const PORT = process.env.PORT || 9753;

serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log('');
    console.log('🏠 MyWebHome 已启动');
    console.log(`📡 http://localhost:${info.port}`);
    console.log(`📦 已加载 ${loaded.length} 个模块`);
    console.log(`🔧 环境: ${isDev ? '开发' : '生产'}`);
    console.log('');
});
