/**
 * MyWebHome — Service Worker
 * 策略：Network-first（优先网络，离线时用缓存兜底）
 * 好处：代码更新后刷新即生效，无需手动清缓存
 */

const CACHE_NAME = 'mwh-v1';
const SHELL_ASSETS = [
    '/',
    '/css/style.css',
    '/css/theme-light.css',
    '/js/api.js',
    '/js/components.js',
    '/js/router.js',
    '/js/app.js',
];

// 安装：预缓存 Shell 资源（仅作为离线兜底）
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// 拦截请求：统一使用 Network-first 策略
self.addEventListener('fetch', (e) => {
    // 只处理 GET 请求
    if (e.request.method !== 'GET') return;

    e.respondWith(
        fetch(e.request)
            .then(res => {
                // 网络成功：克隆一份存入缓存后返回
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            })
            .catch(() =>
                // 网络失败：尝试从缓存读取，最终兜底到首页（SPA）
                caches.match(e.request).then(cached => cached || caches.match('/'))
            )
    );
});
