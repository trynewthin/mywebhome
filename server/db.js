import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, 'mywebhome.db');
const DB_TMP_PATH = DB_PATH + '.tmp';

if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

// sql.js 需要异步初始化
const SQL = await initSqlJs();

// 如果数据库文件已存在，则加载；否则创建新数据库
let db;
if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
} else {
    db = new SQL.Database();
}

// 开启外键约束
db.run('PRAGMA foreign_keys = ON');

// 系统表：记录已安装的模块
db.run(`
  CREATE TABLE IF NOT EXISTS _modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '📦',
    version TEXT DEFAULT '1.0.0',
    enabled INTEGER DEFAULT 1,
    installed_at TEXT DEFAULT (datetime('now')),
    config TEXT DEFAULT '{}',
    dashboard INTEGER DEFAULT 0
  )
`);

// 兼容旧表：如果 dashboard 列不存在则添加
try { db.run('ALTER TABLE _modules ADD COLUMN dashboard INTEGER DEFAULT 0'); } catch { /* 列已存在 */ }

// ─── 持久化 ───

let dirty = false;

/** 标记数据库已修改，等待下一次批量保存 */
export function markDirty() {
    dirty = true;
}

/**
 * 将数据库持久化到磁盘（原子写入：先写临时文件，再 rename）
 * 只在有变更时才写入，避免无意义 I/O
 */
export function saveDb() {
    if (!dirty) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        writeFileSync(DB_TMP_PATH, buffer);
        renameSync(DB_TMP_PATH, DB_PATH);
        dirty = false;
    } catch (err) {
        console.error('💾 数据库保存失败:', err.message);
    }
}

// 定期自动保存（每 10 秒检查一次，有变更才写）
setInterval(saveDb, 10_000);

// 进程退出时强制保存
function onExit() {
    dirty = true; // 强制保存一次
    saveDb();
}
process.on('exit', onExit);
process.on('SIGINT', () => { onExit(); process.exit(0); });
process.on('SIGTERM', () => { onExit(); process.exit(0); });

// ─── 安全校验 ───

/** 合法 SQL 标识符：字母/下划线开头，只含字母数字下划线 */
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSafeIdent(name) {
    if (!SAFE_IDENT.test(name)) {
        throw new Error(`非法 SQL 标识符: "${name}"`);
    }
}

// ─── 工具函数 ───

/**
 * 将 db.exec() 返回的 { columns, values } 格式转为对象数组
 */
export function execToObjects(result) {
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
    });
}

/**
 * 在事务中执行一段 SQL（多语句安全）
 */
export function runInTransaction(fn) {
    db.run('BEGIN TRANSACTION');
    try {
        fn();
        db.run('COMMIT');
    } catch (err) {
        db.run('ROLLBACK');
        throw err;
    }
}

// ─── CRUD 工厂 ───

/**
 * 通用 CRUD 工具 — 给模块用的数据库操作工厂
 * @param {string} table - 表名（必须为合法标识符）
 */
export function createCRUD(table) {
    assertSafeIdent(table);

    return {
        /** 插入一行，返回 lastInsertRowid */
        insert(data) {
            const keys = Object.keys(data);
            keys.forEach(assertSafeIdent);
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => data[k]);
            db.run(
                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                values
            );
            const result = db.exec('SELECT last_insert_rowid() as id');
            markDirty();
            return { lastInsertRowid: result[0]?.values[0]?.[0] ?? 0 };
        },

        /** 查询全部，支持可选 where 条件和排序 */
        findAll({ where = '', params = [], orderBy = 'rowid DESC', limit = 100, offset = 0 } = {}) {
            const whereClause = where ? `WHERE ${where}` : '';
            const sql = `SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
            const stmt = db.prepare(sql);
            try {
                stmt.bind([...params, limit, offset]);
                const rows = [];
                while (stmt.step()) {
                    rows.push(stmt.getAsObject());
                }
                return rows;
            } finally {
                stmt.free();
            }
        },

        /** 按 ID 查单行 */
        findById(id) {
            const stmt = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
            try {
                stmt.bind([id]);
                return stmt.step() ? stmt.getAsObject() : null;
            } finally {
                stmt.free();
            }
        },

        /** 更新指定 ID 的行（只更新传入的字段） */
        update(id, data) {
            const keys = Object.keys(data);
            keys.forEach(assertSafeIdent);
            const sets = keys.map(k => `${k} = ?`).join(', ');
            const values = [...keys.map(k => data[k]), id];
            db.run(`UPDATE ${table} SET ${sets} WHERE id = ?`, values);
            markDirty();
            return { changes: db.getRowsModified() };
        },

        /** 删除指定 ID 的行 */
        remove(id) {
            db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
            markDirty();
            return { changes: db.getRowsModified() };
        },

        /** 计数 */
        count(where = '', params = []) {
            const whereClause = where ? `WHERE ${where}` : '';
            const stmt = db.prepare(`SELECT COUNT(*) as total FROM ${table} ${whereClause}`);
            try {
                if (params.length) stmt.bind(params);
                stmt.step();
                return stmt.getAsObject().total ?? 0;
            } finally {
                stmt.free();
            }
        },
    };
}

/** 暴露原始 db 对象（供模块直接执行 SQL） */
export { db };
export default db;
