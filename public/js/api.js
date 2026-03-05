/**
 * MyWebHome — HTTP API 客户端
 */

const BASE = '';

async function request(path, options = {}) {
    const { method = 'GET', body, params } = options;

    let url = `${BASE}${path}`;
    if (params) {
        const qs = new URLSearchParams(params).toString();
        url += `?${qs}`;
    }

    const init = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    // 自动附加认证 token
    const token = localStorage.getItem('mywebhome-token');
    if (token) {
        init.headers['X-Auth-Token'] = token;
    }

    if (body && method !== 'GET') {
        init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
    }

    return res.json();
}

export const api = {
    get: (path, params) => request(path, { params }),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
};

// 挂载到 window 供模块页面使用
window.api = api;
