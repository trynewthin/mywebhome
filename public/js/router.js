/**
 * MyWebHome — 轻量级 Hash 路由器
 */

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.onNavigate = null; // 路由变化回调

        window.addEventListener('hashchange', () => this._handleRoute());
    }

    /** 注册路由 */
    register(path, handler) {
        this.routes.set(path, handler);
    }

    /** 导航到指定路径 */
    navigate(path) {
        window.location.hash = path;
    }

    /** 获取当前路径 */
    get current() {
        return window.location.hash.slice(1) || '/';
    }

    /** 初始化 — 触发首次路由 */
    init() {
        this._handleRoute();
    }

    /** 内部：处理路由变化 */
    _handleRoute() {
        const path = this.current;
        this.currentRoute = path;

        // 精确匹配
        if (this.routes.has(path)) {
            this.routes.get(path)(path);
            if (this.onNavigate) this.onNavigate(path);
            return;
        }

        // 前缀匹配（支持 /module/:id 这类动态路由通过前缀查找）
        for (const [pattern, handler] of this.routes) {
            if (path.startsWith(pattern + '/') || path === pattern) {
                const params = path.slice(pattern.length + 1);
                handler(path, params);
                if (this.onNavigate) this.onNavigate(path);
                return;
            }
        }

        // 404 fallback → 回到首页
        if (this.routes.has('/')) {
            this.routes.get('/')('/');
            if (this.onNavigate) this.onNavigate('/');
        }
    }
}

const router = new Router();
export default router;

// 挂载到 window 供模块使用
window.router = router;
