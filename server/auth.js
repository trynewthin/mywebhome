/**
 * MyWebHome — 认证模块
 * 密码哈希使用 Node.js 原生 crypto，零依赖
 */
import { createHash, randomBytes } from 'node:crypto';
import { db, markDirty, saveDb } from './db.js';

// 系统设置表
db.run(`
  CREATE TABLE IF NOT EXISTS _settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

function getSetting(key) {
    const stmt = db.prepare('SELECT value FROM _settings WHERE key = ?');
    try {
        stmt.bind([key]);
        if (stmt.step()) {
            return stmt.getAsObject().value;
        }
        return null;
    } finally {
        stmt.free();
    }
}

function setSetting(key, value) {
    db.run(
        `INSERT INTO _settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value]
    );
    markDirty();
    saveDb();
}

function hashPassword(password) {
    const salt = getSetting('auth_salt') || randomBytes(16).toString('hex');
    if (!getSetting('auth_salt')) {
        setSetting('auth_salt', salt);
    }
    return createHash('sha256').update(salt + password).digest('hex');
}

/** 初始化默认密码（首次启动时） */
export function ensurePassword() {
    if (!getSetting('auth_password')) {
        const defaultPwd = '123456';
        setSetting('auth_password', hashPassword(defaultPwd));
        setSetting('auth_fail_count', '0');
        setSetting('auth_locked', 'false');
        console.log(`🔑 已设置默认访问密码: ${defaultPwd}（请尽快通过 node cli.js passwd 修改）`);
    }
}

/** 验证密码，返回 { success, token?, locked?, remaining? } */
export function verifyPassword(password) {
    const locked = getSetting('auth_locked') === 'true';
    if (locked) {
        return { success: false, locked: true };
    }

    const stored = getSetting('auth_password');
    const hash = hashPassword(password);

    if (hash === stored) {
        // 成功：重置计数，生成新 token 并追加到列表
        setSetting('auth_fail_count', '0');
        const token = randomBytes(32).toString('hex');
        const now = Date.now();

        // 读取现有 token 列表
        let tokens = [];
        try {
            tokens = JSON.parse(getSetting('auth_tokens') || '[]');
        } catch { tokens = []; }

        // 清理过期 token（24h）并限制最多 10 个活跃会话
        const maxAge = 24 * 60 * 60 * 1000;
        tokens = tokens.filter(t => (now - t.time) < maxAge);
        tokens.push({ token, time: now });
        if (tokens.length > 10) tokens = tokens.slice(-10);

        setSetting('auth_tokens', JSON.stringify(tokens));
        return { success: true, token };
    }

    // 失败：累加计数
    const failCount = parseInt(getSetting('auth_fail_count') || '0') + 1;
    setSetting('auth_fail_count', String(failCount));

    if (failCount >= 3) {
        setSetting('auth_locked', 'true');
        return { success: false, locked: true, remaining: 0 };
    }

    return { success: false, locked: false, remaining: 3 - failCount };
}

/** 验证 token 是否有效（24小时过期） */
export function verifyToken(token) {
    if (!token) return false;

    // 兼容旧单 token 格式
    const legacyToken = getSetting('auth_token');
    if (legacyToken && legacyToken === token) {
        const legacyTime = parseInt(getSetting('auth_token_time') || '0');
        if (Date.now() - legacyTime < 24 * 60 * 60 * 1000) return true;
    }

    // 多 token 列表验证
    let tokens = [];
    try {
        tokens = JSON.parse(getSetting('auth_tokens') || '[]');
    } catch { return false; }

    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;
    return tokens.some(t => t.token === token && (now - t.time) < maxAge);
}

/** CLI 用：重置密码并解锁 */
export function resetPassword(newPassword) {
    // 需要重新生成盐
    const salt = randomBytes(16).toString('hex');
    setSetting('auth_salt', salt);
    const hash = createHash('sha256').update(salt + newPassword).digest('hex');
    setSetting('auth_password', hash);
    setSetting('auth_fail_count', '0');
    setSetting('auth_locked', 'false');
    setSetting('auth_token', ''); // 使旧 token 失效
    setSetting('auth_tokens', '[]'); // 清空所有会话
}
