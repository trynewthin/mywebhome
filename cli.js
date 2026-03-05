#!/usr/bin/env node

/**
 * MyWebHome CLI — 平台管理命令行工具
 *
 * 用法: node cli.js <command> [options]
 */

import { existsSync, readdirSync, readFileSync, copyFileSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, 'modules');
const DATA_DIR = join(__dirname, 'data');
const DB_PATH = join(DATA_DIR, 'mywebhome.db');
const BACKUP_DIR = join(DATA_DIR, 'backups');
const SERVER_ENTRY = join(__dirname, 'server', 'index.js');

// ─── 颜色输出 ───

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

const log = {
    title: (text) => console.log(`\n${c.bold}${c.cyan}${text}${c.reset}`),
    success: (text) => console.log(`  ${c.green}✅ ${text}${c.reset}`),
    warn: (text) => console.log(`  ${c.yellow}⚠️  ${text}${c.reset}`),
    error: (text) => console.log(`  ${c.red}❌ ${text}${c.reset}`),
    info: (text) => console.log(`  ${c.blue}ℹ️  ${text}${c.reset}`),
    item: (text) => console.log(`  ${c.dim}│${c.reset}  ${text}`),
    divider: () => console.log(`  ${c.dim}${'─'.repeat(50)}${c.reset}`),
};

// ─── 工具函数 ───

function readManifests() {
    if (!existsSync(MODULES_DIR)) return [];

    return readdirSync(MODULES_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
        .map(d => {
            const manifestPath = join(MODULES_DIR, d.name, 'manifest.json');
            if (!existsSync(manifestPath)) return null;
            try {
                const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
                return { dir: d.name, ...manifest };
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(date) {
    return date.toLocaleString('zh-CN', { hour12: false });
}

function fileExists(path) {
    return existsSync(path);
}

// ─── 命令：routes ───

function cmdRoutes() {
    log.title('📡 路由列表');
    console.log('');

    // 系统路由
    console.log(`  ${c.bold}系统路由${c.reset}`);
    log.divider();

    const systemRoutes = [
        { method: 'GET', path: '/api/modules', desc: '获取所有已安装模块的列表' },
        { method: 'GET', path: '/api/health', desc: '服务健康检查（状态、运行时间、内存）' },
        { method: 'GET', path: '/*', desc: '静态文件服务 (public/)' },
        { method: 'GET', path: '/modules/*', desc: '模块前端文件服务' },
    ];

    for (const r of systemRoutes) {
        const method = `${c.magenta}${r.method.padEnd(6)}${c.reset}`;
        log.item(`${method} ${c.cyan}${r.path.padEnd(24)}${c.reset} ${c.dim}${r.desc}${c.reset}`);
    }

    // 前端页面路由
    console.log('');
    console.log(`  ${c.bold}前端页面路由 (Hash)${c.reset}`);
    log.divider();

    const pageRoutes = [
        { path: '#/', desc: '仪表盘 — 模块概览卡片' },
    ];

    const manifests = readManifests();
    for (const m of manifests) {
        pageRoutes.push({
            path: `#/m/${m.id || m.dir}`,
            desc: `${m.icon || '📦'} ${m.name || m.dir} — ${m.description || '无描述'}`,
        });
    }

    for (const r of pageRoutes) {
        log.item(`${c.cyan}${r.path.padEnd(24)}${c.reset} ${c.dim}${r.desc}${c.reset}`);
    }

    // 模块 API 路由
    console.log('');
    console.log(`  ${c.bold}模块 API 路由${c.reset}`);
    log.divider();

    if (manifests.length === 0) {
        log.item(`${c.dim}暂无模块${c.reset}`);
    }

    for (const m of manifests) {
        const moduleId = m.id || m.dir;
        const apiPath = join(MODULES_DIR, m.dir, 'api.js');
        console.log('');
        log.item(`${c.bold}${m.icon || '📦'} ${m.name || m.dir}${c.reset} ${c.dim}(${moduleId})${c.reset}`);

        if (fileExists(apiPath)) {
            // 简单解析 api.js 中的路由定义
            const apiContent = readFileSync(apiPath, 'utf-8');
            const routeRegex = /app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/gi;
            let match;
            while ((match = routeRegex.exec(apiContent)) !== null) {
                const method = match[1].toUpperCase();
                const route = match[2];
                const fullPath = `/api/m/${moduleId}${route === '/' ? '' : route}`;
                const methodColor = {
                    GET: c.green, POST: c.yellow, PUT: c.blue, PATCH: c.magenta, DELETE: c.red,
                }[method] || c.dim;
                log.item(`  ${methodColor}${method.padEnd(8)}${c.reset}${c.cyan}${fullPath}${c.reset}`);
            }
        } else {
            log.item(`  ${c.dim}无 API 路由${c.reset}`);
        }
    }

    console.log('');
}

// ─── 命令：modules ───

function cmdModules() {
    log.title('📦 已安装模块');

    const manifests = readManifests();

    if (manifests.length === 0) {
        log.warn('暂无模块');
        console.log('');
        return;
    }

    console.log('');
    for (const m of manifests) {
        const moduleId = m.id || m.dir;
        const modulePath = join(MODULES_DIR, m.dir);

        console.log(`  ${c.bold}${m.icon || '📦'} ${m.name || m.dir}${c.reset} ${c.dim}v${m.version || '1.0.0'}${c.reset}`);
        log.item(`ID:          ${moduleId}`);
        log.item(`描述:        ${m.description || '—'}`);
        log.item(`目录:        modules/${m.dir}/`);

        // 检查文件完整性
        const files = ['manifest.json', 'api.js', 'page.js', 'schema.sql'];
        const status = files.map(f =>
            fileExists(join(modulePath, f)) ? `${c.green}${f}${c.reset}` : `${c.dim}${f}${c.reset}`
        ).join('  ');
        log.item(`文件:        ${status}`);
        console.log('');
    }
}

// ─── 命令：backup ───

function cmdBackup() {
    log.title('💾 数据库备份');

    if (!fileExists(DB_PATH)) {
        log.error('数据库文件不存在，无需备份');
        console.log('');
        return;
    }

    if (!existsSync(BACKUP_DIR)) {
        mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `mywebhome_${timestamp}.db`;
    const backupPath = join(BACKUP_DIR, backupName);

    copyFileSync(DB_PATH, backupPath);

    const size = statSync(backupPath).size;
    log.success(`备份完成: ${backupName}`);
    log.info(`大小: ${formatBytes(size)}`);
    log.info(`位置: data/backups/${backupName}`);

    // 清理旧备份（保留最近 10 个）
    const backups = readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('mywebhome_') && f.endsWith('.db'))
        .sort()
        .reverse();

    if (backups.length > 10) {
        const toDelete = backups.slice(10);
        for (const f of toDelete) {
            unlinkSync(join(BACKUP_DIR, f));
        }
        log.info(`已清理 ${toDelete.length} 个旧备份（保留最近 10 个）`);
    }

    console.log('');
}

// ─── 命令：check ───

async function cmdCheck() {
    log.title('🔍 预检查');
    console.log('');

    let allOk = true;
    const check = (ok, pass, fail) => {
        if (ok) {
            log.success(pass);
        } else {
            log.error(fail);
            allOk = false;
        }
    };

    // 1. Node.js 版本
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1));
    check(major >= 18, `Node.js ${nodeVersion}`, `Node.js ${nodeVersion} — 需要 >= 18`);

    // 2. 依赖安装
    check(
        fileExists(join(__dirname, 'node_modules', 'hono')),
        '依赖已安装',
        '依赖未安装 — 请运行 npm install'
    );

    // 3. 目录结构
    check(fileExists(join(__dirname, 'server', 'index.js')), 'server/index.js 存在', 'server/index.js 缺失');
    check(fileExists(join(__dirname, 'public', 'index.html')), 'public/index.html 存在', 'public/index.html 缺失');
    check(fileExists(join(__dirname, 'modules')), 'modules/ 目录存在', 'modules/ 目录缺失');

    // 4. 数据库
    if (fileExists(DB_PATH)) {
        const dbSize = statSync(DB_PATH).size;
        log.success(`数据库存在 (${formatBytes(dbSize)})`);

        // 尝试打开数据库做完整性检查
        try {
            const initSqlJs = (await import('sql.js')).default;
            const SQL = await initSqlJs();
            const buffer = readFileSync(DB_PATH);
            const db = new SQL.Database(buffer);
            const result = db.exec('PRAGMA integrity_check');
            const integrityOk = result[0]?.values[0]?.[0] === 'ok';
            check(integrityOk, '数据库完整性校验通过', '数据库完整性校验失败');

            // 检查模块注册数
            const moduleCount = db.exec('SELECT COUNT(*) FROM _modules');
            const count = moduleCount[0]?.values[0]?.[0] ?? 0;
            log.info(`已注册模块: ${count} 个`);

            db.close();
        } catch (err) {
            log.error(`数据库检查失败: ${err.message}`);
            allOk = false;
        }
    } else {
        log.info('数据库尚未创建（首次启动会自动创建）');
    }

    // 5. 模块完整性
    const manifests = readManifests();
    if (manifests.length > 0) {
        console.log('');
        console.log(`  ${c.bold}模块完整性${c.reset}`);
        for (const m of manifests) {
            const moduleId = m.id || m.dir;
            const modulePath = join(MODULES_DIR, m.dir);
            const hasApi = fileExists(join(modulePath, 'api.js'));
            const hasPage = fileExists(join(modulePath, 'page.js'));
            const hasSchema = fileExists(join(modulePath, 'schema.sql'));

            if (hasApi && hasPage) {
                log.success(`${m.icon || '📦'} ${moduleId} — api.js ✓  page.js ✓  schema.sql ${hasSchema ? '✓' : '○'}`);
            } else {
                log.warn(`${m.icon || '📦'} ${moduleId} — api.js ${hasApi ? '✓' : '✗'}  page.js ${hasPage ? '✓' : '✗'}`);
            }
        }
    }

    // 6. 端口占用
    console.log('');
    const port = process.env.PORT || 3000;
    try {
        const result = execSync(
            process.platform === 'win32'
                ? `netstat -ano | findstr :${port} | findstr LISTENING`
                : `lsof -i :${port} -t`,
            { encoding: 'utf-8', timeout: 3000 }
        ).trim();
        if (result) {
            log.warn(`端口 ${port} 已被占用（服务可能正在运行）`);
        } else {
            log.success(`端口 ${port} 可用`);
        }
    } catch {
        log.success(`端口 ${port} 可用`);
    }

    // 7. 磁盘空间 (简化检查)
    try {
        if (process.platform === 'win32') {
            // Windows: 用 wmic 查
            const driveMatch = __dirname.match(/^([A-Z]):/i);
            if (driveMatch) {
                const drive = driveMatch[1];
                const output = execSync(
                    `wmic logicaldisk where "DeviceID='${drive}:'" get FreeSpace /format:value`,
                    { encoding: 'utf-8', timeout: 3000 }
                );
                const freeMatch = output.match(/FreeSpace=(\d+)/);
                if (freeMatch) {
                    const freeBytes = parseInt(freeMatch[1]);
                    const freeGB = (freeBytes / (1024 ** 3)).toFixed(1);
                    check(freeBytes > 100 * 1024 * 1024,
                        `磁盘剩余空间: ${freeGB} GB`,
                        `磁盘空间不足: 仅剩 ${freeGB} GB`
                    );
                }
            }
        } else {
            const output = execSync(`df -B1 "${__dirname}" | tail -1`, { encoding: 'utf-8', timeout: 3000 });
            const parts = output.trim().split(/\s+/);
            const freeBytes = parseInt(parts[3]);
            const freeGB = (freeBytes / (1024 ** 3)).toFixed(1);
            check(freeBytes > 100 * 1024 * 1024,
                `磁盘剩余空间: ${freeGB} GB`,
                `磁盘空间不足: 仅剩 ${freeGB} GB`
            );
        }
    } catch {
        // 获取磁盘信息失败，跳过
    }

    console.log('');
    if (allOk) {
        console.log(`  ${c.bold}${c.green}🎉 所有检查通过，可以启动！${c.reset}`);
    } else {
        console.log(`  ${c.bold}${c.red}⛔ 存在问题，请先修复再启动。${c.reset}`);
    }
    console.log('');
}

// ─── 命令：status ───

async function cmdStatus() {
    log.title('📊 服务状态');

    const port = process.env.PORT || 3000;

    try {
        const res = await fetch(`http://localhost:${port}/api/health`);
        const data = await res.json();

        log.success('服务正在运行');
        log.info(`运行时间: ${data.uptime} 秒`);
        log.info(`内存占用: ${data.memory}`);
        log.info(`监听端口: ${port}`);

        // 获取模块信息
        const modRes = await fetch(`http://localhost:${port}/api/modules`);
        const modData = await modRes.json();
        log.info(`已加载模块: ${modData.modules.length} 个`);

        if (modData.modules.length > 0) {
            console.log('');
            for (const m of modData.modules) {
                log.item(`${m.icon} ${m.name} (${m.id})`);
            }
        }
    } catch {
        log.error(`服务未运行（端口 ${port} 无响应）`);
    }

    console.log('');
}

// ─── 命令：restart ───

function cmdRestart() {
    log.title('🔄 重启服务');

    const port = process.env.PORT || 3000;

    // 查找并终止已有进程
    try {
        if (process.platform === 'win32') {
            // Windows: 通过端口查找 PID
            const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
                encoding: 'utf-8',
                timeout: 3000,
            }).trim();

            if (output) {
                const lines = output.split('\n');
                const pids = new Set();
                for (const line of lines) {
                    const pid = line.trim().split(/\s+/).pop();
                    if (pid && pid !== '0') pids.add(pid);
                }
                for (const pid of pids) {
                    try {
                        execSync(`taskkill /PID ${pid} /F`, { timeout: 3000 });
                        log.info(`已终止进程 PID ${pid}`);
                    } catch {
                        // 进程可能已退出
                    }
                }
            }
        } else {
            // Linux/macOS
            try {
                const pids = execSync(`lsof -i :${port} -t`, { encoding: 'utf-8', timeout: 3000 }).trim();
                if (pids) {
                    execSync(`kill ${pids}`, { timeout: 3000 });
                    log.info(`已终止旧进程: ${pids}`);
                }
            } catch {
                // 没有运行中的进程
            }
        }
    } catch {
        log.info('未发现运行中的服务');
    }

    // 启动新进程
    log.info('正在启动服务...');
    const child = spawn('node', [SERVER_ENTRY], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
    });
    child.unref();

    log.success(`服务已在后台启动 (PID: ${child.pid})`);
    log.info(`端口: ${port}`);
    console.log('');
}

// ─── 命令：help ───

function cmdHelp() {
    console.log('');
    console.log(`  ${c.bold}${c.cyan}🏠 MyWebHome CLI${c.reset}`);
    console.log(`  ${c.dim}模块化 Web 平台管理工具${c.reset}`);
    console.log('');
    console.log(`  ${c.bold}用法:${c.reset}  node cli.js <command>`);
    console.log('');
    console.log(`  ${c.bold}命令:${c.reset}`);
    console.log('');

    const commands = [
        ['routes', '查看所有路由及其用途'],
        ['modules', '查看已安装模块及其详情'],
        ['status', '检查服务运行状态'],
        ['check', '预检查（环境、依赖、数据库完整性、端口）'],
        ['backup', '备份数据库（保留最近 10 个）'],
        ['restart', '重启服务（终止旧进程 → 启动新进程）'],
        ['remove', '删除模块（目录+注册，可选 --data 删数据表）'],
        ['help', '显示此帮助信息'],
    ];

    for (const [name, desc] of commands) {
        console.log(`    ${c.cyan}${name.padEnd(12)}${c.reset} ${desc}`);
    }

    console.log('');
    console.log(`  ${c.bold}示例:${c.reset}`);
    console.log(`    ${c.dim}$ node cli.js check           # 部署前预检查${c.reset}`);
    console.log(`    ${c.dim}$ node cli.js backup           # 备份数据库${c.reset}`);
    console.log(`    ${c.dim}$ node cli.js routes           # 检查路由清单${c.reset}`);
    console.log(`    ${c.dim}$ node cli.js remove todo       # 删除 todo 模块${c.reset}`);
    console.log(`    ${c.dim}$ node cli.js remove todo --data # 连数据表也一并删除${c.reset}`);
    console.log('');
}

// ─── 命令：remove ───

async function cmdRemove() {
    const moduleId = args[0];

    if (!moduleId) {
        log.title('🗑️  删除模块');
        log.error('请指定要删除的模块 ID');
        console.log('');
        console.log(`  ${c.bold}用法:${c.reset}  node cli.js remove <moduleId> [--data]`);
        console.log('');
        console.log(`  ${c.bold}参数:${c.reset}`);
        console.log(`    ${c.cyan}moduleId${c.reset}     模块目录名/ID`);
        console.log(`    ${c.cyan}--data${c.reset}       同时删除该模块在数据库中的数据表`);
        console.log('');
        console.log(`  ${c.bold}示例:${c.reset}`);
        console.log(`    ${c.dim}$ node cli.js remove todo${c.reset}`);
        console.log(`    ${c.dim}$ node cli.js remove todo --data${c.reset}`);
        console.log('');

        // 列出可用模块
        const manifests = readManifests();
        if (manifests.length > 0) {
            console.log(`  ${c.bold}可删除的模块:${c.reset}`);
            for (const m of manifests) {
                console.log(`    ${c.cyan}${m.id || m.dir}${c.reset}  ${c.dim}${m.name || ''}${c.reset}`);
            }
        }

        // 检查数据库中有无孤立模块注册（文件已删但注册还在）
        if (fileExists(DB_PATH)) {
            try {
                const initSqlJs = (await import('sql.js')).default;
                const SQL = await initSqlJs();
                const buffer = readFileSync(DB_PATH);
                const db = new SQL.Database(buffer);
                const result = db.exec('SELECT id, name FROM _modules');
                if (result.length > 0) {
                    const registered = result[0].values;
                    const orphans = registered.filter(([id]) =>
                        !fileExists(join(MODULES_DIR, id, 'manifest.json'))
                    );
                    if (orphans.length > 0) {
                        console.log('');
                        console.log(`  ${c.yellow}${c.bold}⚠️  以下模块已无文件但仍在数据库中注册:${c.reset}`);
                        for (const [id, name] of orphans) {
                            console.log(`    ${c.yellow}${id}${c.reset}  ${c.dim}${name}${c.reset}`);
                        }
                        console.log(`  ${c.dim}运行 node cli.js remove <id> 来清理${c.reset}`);
                    }
                }
                db.close();
            } catch { /* ignore */ }
        }

        console.log('');
        return;
    }

    const withData = args.includes('--data');
    const modulePath = join(MODULES_DIR, moduleId);

    log.title(`🗑️  删除模块: ${moduleId}`);

    // 1. 删除模块目录
    if (fileExists(modulePath)) {
        const { rmSync } = await import('node:fs');
        rmSync(modulePath, { recursive: true, force: true });
        log.success(`已删除目录: modules/${moduleId}/`);
    } else {
        log.info(`目录 modules/${moduleId}/ 不存在（可能已手动删除）`);
    }

    // 2. 清理数据库中的注册记录
    if (fileExists(DB_PATH)) {
        try {
            const initSqlJs = (await import('sql.js')).default;
            const SQL = await initSqlJs();
            const buffer = readFileSync(DB_PATH);
            const db = new SQL.Database(buffer);

            // 检查是否存在注册
            const existing = db.exec('SELECT id FROM _modules WHERE id = ?', [moduleId]);
            if (existing.length > 0 && existing[0].values.length > 0) {
                db.run('DELETE FROM _modules WHERE id = ?', [moduleId]);
                log.success('已从数据库注册表 _modules 中移除');
            } else {
                log.info('数据库中未找到该模块的注册记录');
            }

            // 3. 可选：删除模块的数据表
            if (withData) {
                // 查找该模块可能创建的表（以 moduleId_ 为前缀的表）
                const tables = db.exec(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '${moduleId}_%'`
                );
                if (tables.length > 0 && tables[0].values.length > 0) {
                    for (const [tableName] of tables[0].values) {
                        db.run(`DROP TABLE IF EXISTS "${tableName}"`);
                        log.success(`已删除数据表: ${tableName}`);
                    }
                } else {
                    log.info(`未找到以 "${moduleId}_" 开头的数据表`);
                }
            } else {
                log.info('数据表已保留（如需删除请加 --data 参数）');
            }

            // 持久化
            const data = db.export();
            const { writeFileSync } = await import('node:fs');
            writeFileSync(DB_PATH, Buffer.from(data));
            db.close();
        } catch (err) {
            log.error(`数据库操作失败: ${err.message}`);
        }
    }

    console.log('');
    log.success('模块已彻底移除，正在自动重启服务...');
    console.log('');
    cmdRestart();
}

// ─── 命令：passwd ───

async function cmdPasswd() {
    const newPwd = args[0];

    log.title('🔑 密码管理');

    if (!newPwd) {
        console.log('');
        console.log(`  ${c.bold}用法:${c.reset}  node cli.js passwd <新密码>`);
        console.log('');
        console.log(`  ${c.bold}功能:${c.reset}`);
        console.log(`    - 重置访问密码`);
        console.log(`    - 自动解除账号锁定`);
        console.log(`    - 使所有已登录的 token 失效`);
        console.log('');
        console.log(`  ${c.bold}示例:${c.reset}`);
        console.log(`    ${c.dim}$ node cli.js passwd myNewPassword${c.reset}`);
        console.log('');
        return;
    }

    if (newPwd.length < 4) {
        log.error('密码长度不能少于 4 位');
        return;
    }

    try {
        // 动态导入 auth 模块
        const { resetPassword } = await import('./server/auth.js');
        resetPassword(newPwd);
        log.success('密码已重置');
        log.success('账号已解锁');
        log.success('所有旧 token 已失效');
        console.log('');
        log.info(`新密码: ${c.cyan}${newPwd}${c.reset}`);
        console.log('');
    } catch (err) {
        log.error(`操作失败: ${err.message}`);
    }
}

// ─── 入口 ───

const [, , command, ...args] = process.argv;

const commands = {
    routes: cmdRoutes,
    modules: cmdModules,
    backup: cmdBackup,
    check: cmdCheck,
    status: cmdStatus,
    restart: cmdRestart,
    remove: cmdRemove,
    passwd: cmdPasswd,
    help: cmdHelp,
};

if (!command || !commands[command]) {
    if (command) {
        log.error(`未知命令: ${command}`);
    }
    cmdHelp();
    process.exit(command ? 1 : 0);
} else {
    await commands[command]();
}

