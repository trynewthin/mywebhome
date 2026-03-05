/**
 * MyWebHome — 基础 UI 组件库
 * 纯 Vanilla JS，AI 可以直接使用这些函数来组装页面
 */

// ─── 工具函数 ───

/** 安全创建 DOM 元素 */
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);

    for (const [key, val] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = val;
        } else if (key === 'style' && typeof val === 'object') {
            Object.assign(el.style, val);
        } else if (key.startsWith('on') && typeof val === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'html') {
            el.innerHTML = val;
        } else {
            el.setAttribute(key, val);
        }
    }

    for (const child of children.flat()) {
        if (child == null || child === false) continue;
        el.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }

    return el;
}

/** 将 HTML 字符串解析为 DOM 元素 */
export function htmlToEl(htmlStr) {
    const t = document.createElement('template');
    t.innerHTML = htmlStr.trim();
    return t.content.firstChild;
}

// ─── Toast 通知 ───

let toastContainer = null;

export function toast(message, type = 'success') {
    if (!toastContainer) {
        toastContainer = h('div', { className: 'toast-container' });
        document.body.append(toastContainer);
    }

    const toastEl = h('div', { className: `toast ${type}` }, message);
    toastContainer.append(toastEl);

    setTimeout(() => toastEl.remove(), 3000);
}

// ─── Modal 弹窗 ───

export function showModal({ title, content, onConfirm, confirmText = '确定', cancelText = '取消' }) {
    const overlay = h('div', { className: 'modal-overlay' });

    const contentEl = typeof content === 'string' ? htmlToEl(`<div>${content}</div>`) : content;

    const modal = h('div', { className: 'modal' },
        h('div', { className: 'modal-title' }, title),
        contentEl,
        h('div', { className: 'modal-actions' },
            h('button', {
                className: 'btn btn-ghost',
                onClick: () => overlay.remove(),
            }, cancelText),
            h('button', {
                className: 'btn btn-primary',
                onClick: () => {
                    if (onConfirm) onConfirm();
                    overlay.remove();
                },
            }, confirmText),
        ),
    );

    overlay.append(modal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.append(overlay);
    return overlay;
}

// ─── 统计卡片 ───

export function statCard({ label, value, change, direction }) {
    const card = h('div', { className: 'stat-card' },
        h('div', { className: 'stat-card-label' }, label),
        h('div', { className: 'stat-card-value' }, String(value)),
    );

    if (change != null) {
        card.append(
            h('div', { className: `stat-card-change ${direction || ''}` },
                `${direction === 'up' ? '↑' : direction === 'down' ? '↓' : ''} ${change}`
            )
        );
    }

    return card;
}

export function statGrid(stats) {
    return h('div', { className: 'stat-grid' }, ...stats.map(s => statCard(s)));
}

// ─── 数据表格 ───

export function dataTable({ columns, rows, onRowClick }) {
    const thead = h('thead', {},
        h('tr', {}, ...columns.map(col =>
            h('th', {}, typeof col === 'string' ? col : col.label)
        ))
    );

    const tbody = h('tbody', {},
        ...rows.map(row => {
            const tr = h('tr', {},
                ...columns.map(col => {
                    const key = typeof col === 'string' ? col : col.key;
                    const render = typeof col === 'object' && col.render;
                    const value = row[key];
                    return h('td', {}, render ? render(value, row) : String(value ?? ''));
                })
            );
            if (onRowClick) {
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => onRowClick(row));
            }
            return tr;
        })
    );

    if (rows.length === 0) {
        tbody.append(
            h('tr', {},
                h('td', {
                    html: `<div style="text-align:center;padding:24px;color:var(--text-muted)">暂无数据</div>`,
                    colspan: String(columns.length),
                })
            )
        );
    }

    return h('div', { className: 'table-wrap' },
        h('table', { className: 'table' }, thead, tbody)
    );
}

// ─── 表单生成器 ───

export function formField({ label, name, type = 'text', placeholder = '', value = '', options = [] }) {
    const group = h('div', { className: 'form-group' });

    if (label) {
        group.append(h('label', { className: 'form-label', for: name }, label));
    }

    let input;
    if (type === 'textarea') {
        input = h('textarea', {
            className: 'form-textarea',
            name,
            id: name,
            placeholder,
        }, value);
    } else if (type === 'select') {
        input = h('select', { className: 'form-select', name, id: name },
            ...options.map(opt => {
                const optEl = h('option', { value: opt.value ?? opt }, opt.label ?? opt);
                if ((opt.value ?? opt) === value) optEl.selected = true;
                return optEl;
            })
        );
    } else {
        input = h('input', {
            className: 'form-input',
            type,
            name,
            id: name,
            placeholder,
            value,
        });
    }

    group.append(input);
    return group;
}

/** 从表单容器收集所有 input/select/textarea 的值 */
export function collectFormData(container) {
    const data = {};
    container.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.name) {
            if (el.type === 'number') {
                data[el.name] = el.value === '' ? null : Number(el.value);
            } else if (el.type === 'checkbox') {
                data[el.name] = el.checked ? 1 : 0;
            } else {
                data[el.name] = el.value;
            }
        }
    });
    return data;
}

// ─── 页面骨架 ───

export function modulePage({ title, actions = [], children = [] }) {
    return h('div', { className: 'module-page fade-in' },
        h('div', { className: 'module-page-header' },
            h('h1', { className: 'module-page-title' }, title),
            h('div', { className: 'header-actions' }, ...actions),
        ),
        ...children,
    );
}

// ─── 空状态 ───

export function emptyState({ icon = '📭', title = '暂无内容', desc = '' }) {
    return h('div', { className: 'empty-state' },
        h('div', { className: 'empty-state-icon' }, icon),
        h('div', { className: 'empty-state-title' }, title),
        desc ? h('div', { className: 'empty-state-desc' }, desc) : null,
    );
}

// ─── 图表封装卡片 ───

export function chartCard({ title, type = 'bar', data = [], labels = [], height = '200px' }) {
    const card = h('div', { className: 'chart-card', style: { padding: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', marginBottom: '24px' } });

    if (title) {
        card.append(h('h3', { style: { fontFamily: 'var(--font-display)', textTransform: 'uppercase', marginBottom: '24px', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '12px' } }, title));
    }

    const chartWrap = h('div', { className: 'chart-wrap', style: { height, display: 'flex', alignItems: 'flex-end', gap: '8px', position: 'relative' } });
    const maxVal = Math.max(...data, 1); // 避免除以0

    data.forEach((val, i) => {
        const percent = (val / maxVal) * 100;
        const barCol = h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative', group: 'bar' } });

        // 数值提示
        const valLabel = h('div', { className: 'chart-val', style: { fontSize: '0.75rem', marginBottom: '4px', opacity: 0, transition: 'opacity var(--transition-fast)', position: 'absolute', top: `calc(${100 - percent}% - 24px)` } }, String(val));

        // 柱体
        const bar = h('div', { className: 'chart-bar', style: { width: '100%', height: `${percent}%`, background: 'var(--color-primary)', border: '1px solid var(--border-default)', transition: 'all var(--transition-normal)' } });

        barCol.addEventListener('mouseenter', () => {
            bar.style.background = 'var(--text-inverse)';
            bar.style.borderColor = 'var(--color-primary)';
            valLabel.style.opacity = '1';
        });
        barCol.addEventListener('mouseleave', () => {
            bar.style.background = 'var(--color-primary)';
            bar.style.borderColor = 'var(--border-default)';
            valLabel.style.opacity = '0';
        });

        // 底部标签
        const labelText = labels[i] || '';
        const xLabel = h('div', { style: { fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' } }, String(labelText));

        barCol.append(valLabel, bar, xLabel);
        chartWrap.append(barCol);
    });

    if (data.length === 0) {
        chartWrap.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-muted); align-self: center;">没有数据</div>';
    }

    card.append(chartWrap);
    return card;
}

// ─── 图片显示卡片 ───

export function imageCard({ src, alt = '', caption = '', objectFit = 'cover', height = 'auto' }) {
    const card = h('div', { className: 'image-card', style: { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '12px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' } });

    // 强制把模块内的图片路径解析为绝对，避免路由影响
    const imgSrc = src.startsWith('http') || src.startsWith('data:') || src.startsWith('/') ? src : `/modules/${src}`;

    const imgWrap = h('div', { style: { width: '100%', height, overflow: 'hidden', border: '1px solid var(--border-default)', background: 'var(--bg-base)' } });
    const img = h('img', { src: imgSrc, alt, style: { width: '100%', height: '100%', objectFit, display: 'block', filter: 'grayscale(1) contrast(1.2)', transition: 'all var(--transition-normal)' } });

    imgWrap.append(img);
    card.append(imgWrap);

    // 悬停恢复色彩
    card.addEventListener('mouseenter', () => img.style.filter = 'grayscale(0) contrast(1)');
    card.addEventListener('mouseleave', () => img.style.filter = 'grayscale(1) contrast(1.2)');

    if (caption) {
        card.append(h('div', { style: { fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right', fontStyle: 'italic' } }, `// ${caption}`));
    }

    return card;
}

// 挂载到 window 供模块使用
window.UI = {
    h, htmlToEl, toast, showModal,
    statCard, statGrid, dataTable,
    formField, collectFormData,
    modulePage, emptyState,
    chartCard, imageCard,
};

