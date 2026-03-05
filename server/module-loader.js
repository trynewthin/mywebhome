import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import db, { saveDb, markDirty, execToObjects, runInTransaction } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, '..', 'modules');

/**
 * 扫描 modules/ 目录，自动发现并加载所有模块
 * 每个模块目录必须包含：
 *   - manifest.json  (声明模块元信息)
 *   - api.js         (导出 Hono 子路由)
 *   - schema.sql     (可选，数据库建表语句)
 */
export async function loadModules(app) {
    if (!existsSync(MODULES_DIR)) {
        console.log('📁 modules/ 目录不存在，跳过模块加载');
        return [];
    }

    const dirs = readdirSync(MODULES_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'));

    const loaded = [];

    for (const dir of dirs) {
        const modulePath = join(MODULES_DIR, dir.name);
        const manifestPath = join(modulePath, 'manifest.json');

        if (!existsSync(manifestPath)) {
            console.warn(`⚠️  模块 ${dir.name} 缺少 manifest.json，跳过`);
            continue;
        }

        try {
            // 1. 读取 manifest
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
            const moduleId = manifest.id || dir.name;

            // 2. 执行 schema.sql（在事务中，确保原子性）
            const schemaPath = join(modulePath, 'schema.sql');
            if (existsSync(schemaPath)) {
                const schema = readFileSync(schemaPath, 'utf-8');
                runInTransaction(() => db.exec(schema));
            }

            // 3. 加载 api.js 并挂载路由
            const apiPath = join(modulePath, 'api.js');
            if (existsSync(apiPath)) {
                const apiModule = await import(pathToFileURL(apiPath).href);
                if (apiModule.default) {
                    app.route(`/api/m/${moduleId}`, apiModule.default);
                }
            }

            // 4. 注册到系统表
            const existing = execToObjects(
                db.exec('SELECT id FROM _modules WHERE id = ?', [moduleId])
            );
            if (existing.length === 0) {
                db.run(
                    `INSERT INTO _modules (id, name, description, icon, version, dashboard) VALUES (?, ?, ?, ?, ?, ?)`,
                    [moduleId, manifest.name || moduleId, manifest.description || '', manifest.icon || '📦', manifest.version || '1.0.0', manifest.dashboard ? 1 : 0]
                );
                markDirty();
                saveDb();
            }

            loaded.push({ id: moduleId, name: manifest.name || moduleId });
            console.log(`✅ 模块加载成功: ${manifest.name || moduleId} (${moduleId})`);
        } catch (err) {
            console.error(`❌ 模块 ${dir.name} 加载失败:`, err.message);
        }
    }

    return loaded;
}

/**
 * 获取所有已注册模块的信息
 */
export function getInstalledModules() {
    return execToObjects(
        db.exec('SELECT * FROM _modules WHERE enabled = 1 ORDER BY installed_at DESC')
    );
}
