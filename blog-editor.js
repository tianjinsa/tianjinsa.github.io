// 安全配置
const CONFIG = {
    HASH_ITERATIONS: 1000,       // 哈希迭代次数
    GITHUB_REPO_OWNER: 'tianjinsa', // 替换为你的 GitHub 用户名
    GITHUB_REPO_NAME: 'tianjinsa.github.io',  // 替换为你的仓库名
    BLOG_PATH: 'blog/',          // 博客文件存储路径
    PASSWORD_HASH: '2297df0c72a87f029517c0f127ed499e5e086d45cf4793d4e8767a99c39e1690', // 密码的SHA-256哈希
    TOKEN_COOKIE_NAME: 'github_personal_token', // 用于存储GitHub令牌的cookie名称
    TOKEN_COOKIE_DAYS: 30       // 令牌cookie的保存天数
};

// DOM 元素
let elements = {};

// 初始化编辑器
document.addEventListener('DOMContentLoaded', () => {
    // 缓存DOM元素
    cacheElements();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 初始化Markdown预览
    initMarkdownPreview();
    
    // 初始化Markdown工具栏
    initMarkdownToolbar();
    
    // 添加退出功能
    if (elements.editorSection) {
        const logoutLink = document.createElement('a');
        logoutLink.href = '#';
        logoutLink.className = 'btn btn-secondary';
        logoutLink.textContent = '退出登录';
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
        
        // 添加到导航栏中
        const nav = document.querySelector('.editor-nav .publish-controls');
        if (nav) {
            nav.appendChild(logoutLink);
        }
    }
    
    // 添加保存草稿按钮
    if (elements.editorSection) {
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-secondary';
        saveBtn.textContent = '保存草稿';
        saveBtn.addEventListener('click', saveAsDraft);
        
        // 添加到导航栏中，位于发布按钮之前
        if (elements.publishButton && elements.publishButton.parentNode) {
            elements.publishButton.parentNode.insertBefore(saveBtn, elements.publishButton);
        }
    }
    
    // 初始化自动保存功能
    initAutosave();
    
    // 加载草稿（如果有）
    loadDraft();
    
    // 如果localStorage中有token，尝试自动登录
    tryAutoLogin();
});

// 缓存DOM元素
function cacheElements() {
    elements = {
        // 登录部分元素
        loginBtn: document.getElementById('login-btn'),
        passwordInput: document.getElementById('password'),
        tokenInput: document.getElementById('github-token'),
        tokenSection: document.getElementById('token-section'),
        saveTokenCheckbox: document.getElementById('remember-token'),
        statusMessage: document.getElementById('status-message'),
        loginSection: document.getElementById('login-section'),
        
        // 编辑器部分元素
        editorSection: document.getElementById('editor-section'),
        titleInput: document.getElementById('post-title'),
        slugInput: document.getElementById('post-slug'),
        contentTextarea: document.getElementById('markdown-editor'),
        previewContent: document.getElementById('preview-content'),
        previewContainer: document.getElementById('preview-container'),
        fullscreenBtn: document.getElementById('fullscreen-btn'),
        publishButton: document.getElementById('publish-btn')
    };
}

// 设置事件监听器
function setupEventListeners() {
    // 登录按钮点击
    elements.loginBtn.addEventListener('click', handleLogin);
    
    // 保存令牌按钮点击
    const saveTokenBtn = document.getElementById('save-token-btn');
    if (saveTokenBtn) {
        saveTokenBtn.addEventListener('click', handleLogin);
    }
    
    // 实时Markdown预览
    elements.contentTextarea.addEventListener('input', updatePreview);
    
    // 文章标题变更时自动生成 slug
    elements.titleInput.addEventListener('input', function() {
        elements.slugInput.value = createSafeFileName(this.value);
    });
    
    // 文章发布
    elements.publishButton.addEventListener('click', publishBlog);
    
    // 预览全屏切换
    elements.fullscreenBtn.addEventListener('click', togglePreviewFullscreen);
}

// 切换密码可见性
function togglePasswordVisibility() {
    const type = elements.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    elements.passwordInput.setAttribute('type', type);
    elements.togglePassword.textContent = type === 'password' ? '👁️' : '🔒';
}

// 切换预览全屏模式
function togglePreviewFullscreen() {
    const previewContainer = elements.previewContainer;
    
    if (previewContainer.classList.contains('fullscreen')) {
        // 退出全屏
        previewContainer.classList.remove('fullscreen');
        elements.fullscreenBtn.innerHTML = '<i class="icon">⛶</i>';
        elements.fullscreenBtn.title = '全屏预览';
    } else {
        // 进入全屏
        previewContainer.classList.add('fullscreen');
        elements.fullscreenBtn.innerHTML = '<i class="icon">✕</i>';
        elements.fullscreenBtn.title = '退出全屏';
    }
}

// Cookie管理函数
function setCookie(name, value, days) {
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Strict; Secure';
}

function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/; SameSite=Strict; Secure';
}

// 初始化Markdown预览
function initMarkdownPreview() {
    elements.previewContent.innerHTML = `<div class="markdown-content">
        <p>预览将显示在这里...</p>
    </div>`;
    
    // 初始更新预览
    updatePreview();
}

// 更新Markdown预览
function updatePreview() {
    const markdown = elements.contentTextarea.value;
    
    if (markdown.trim() === '') {
        elements.previewContent.innerHTML = `<div class="markdown-content">
            <p>预览将显示在这里...</p>
        </div>`;
        return;
    }
    
    // 使用 marked.js 进行 Markdown 转换
    const rawHtml = marked.parse(markdown);
    
    // 使用 DOMPurify 进行 XSS 过滤
    const safeHtml = DOMPurify.sanitize(rawHtml);
    
    elements.previewContent.innerHTML = safeHtml;
}

// 尝试自动登录
function tryAutoLogin() {
    // 首先检查localStorage中是否有token
    let token = localStorage.getItem('github_token');
    
    // 如果localStorage中没有token，检查cookie
    if (!token) {
        token = getCookie(CONFIG.TOKEN_COOKIE_NAME);
        // 如果找到cookie令牌，同时保存到localStorage以便使用
        if (token) {
            localStorage.setItem('github_token', token);
        }
    }
    
    if (token) {
        // 验证token有效性
        fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}`, {
            headers: {
                'Authorization': `token ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                showEditor();
            } else {
                // Token无效，清除并要求重新登录
                localStorage.removeItem('github_token');
                eraseCookie(CONFIG.TOKEN_COOKIE_NAME);
            }
        })
        .catch(error => {
            console.error('验证token时出错:', error);
            localStorage.removeItem('github_token');
            eraseCookie(CONFIG.TOKEN_COOKIE_NAME);
        });
    }
}

// 密码哈希计算函数
async function hashPassword(password) {
    // 使用 SHA-256 算法
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // 使用 SubtleCrypto API 计算哈希
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

// 处理登录
async function handleLogin(e) {
    if (e) e.preventDefault();
    
    const password = elements.passwordInput.value;
    const githubToken = elements.tokenInput.value;
    const saveToken = elements.saveTokenCheckbox.checked;
    
    if (!password && elements.tokenSection.classList.contains('hidden')) {
        showMessage('请输入密码', 'error');
        return;
    }
    
    try {
        // 如果token部分可见，则直接处理token
        if (!elements.tokenSection.classList.contains('hidden')) {
            if (!githubToken) {
                showMessage('请输入GitHub令牌', 'error');
                return;
            }
            
            // 验证令牌有效性
            try {
                const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}`, {
                    headers: {
                        'Authorization': `token ${githubToken}`
                    }
                });
                
                if (response.ok) {
                    // 令牌有效，保存到localStorage
                    localStorage.setItem('github_token', githubToken);
                    
                    // 如果用户选择了保存令牌，则也保存到cookie
                    if (saveToken) {
                        setCookie(CONFIG.TOKEN_COOKIE_NAME, githubToken, CONFIG.TOKEN_COOKIE_DAYS);
                    }
                    
                    showMessage('登录成功！', 'success');
                    setTimeout(() => {
                        showEditor();
                    }, 1000);
                } else {
                    showMessage('GitHub令牌无效，请检查后重试', 'error');
                }
            } catch (error) {
                console.error('验证GitHub令牌时出错:', error);
                showMessage('验证GitHub令牌时出错', 'error');
            }
            return;
        }
        
        // 如果是密码验证阶段
        // 计算密码哈希
        const hashedPassword = await hashPassword(password);
        
        // 检查密码是否正确
        if (hashedPassword === CONFIG.PASSWORD_HASH) {
            // 显示令牌输入界面
            showTokenInput();
        } else {
            showMessage('密码不正确', 'error');
        }
    } catch (error) {
        console.error('登录时出错:', error);
        showMessage('登录过程中发生错误', 'error');
    }
}

// 显示GitHub令牌输入界面
function showTokenInput() {
    elements.passwordInput.disabled = true;
    elements.tokenSection.classList.remove('hidden');
    elements.tokenInput.focus();
    showMessage('请输入GitHub个人访问令牌以继续', 'info');
}

// 显示消息
function showMessage(message, type) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = 'status-message';
    
    if (type === 'error') {
        elements.statusMessage.classList.add('error');
    } else if (type === 'success') {
        elements.statusMessage.classList.add('success');
    }
    
    elements.statusMessage.style.display = 'block';
    
    // 如果不是info类型的消息，3秒后自动隐藏
    if (type !== 'info') {
        setTimeout(() => {
            elements.statusMessage.style.display = 'none';
        }, 3000);
    }
}

// 显示编辑器
function showEditor() {
    elements.loginSection.classList.add('hidden');
    elements.tokenSection.classList.add('hidden');
    elements.editorSection.classList.remove('hidden');
}

// 发布博客
async function publishBlog() {
    const title = elements.titleInput.value.trim();
    const slug = elements.slugInput.value.trim() || createSafeFileName(title);
    const content = elements.contentTextarea.value.trim();
    const token = localStorage.getItem('github_token');
    
    if (!title || !content) {
        showMessage('标题和内容不能为空', 'error');
        return;
    }
    
    if (!token) {
        showMessage('您需要登录并提供GitHub访问令牌才能发布博客', 'error');
        logout();
        return;
    }
    
    // 显示发布状态
    elements.statusMessage.innerHTML = '<span class="loading-spinner"></span> 正在发布，请稍候...';
    elements.statusMessage.style.display = 'block';
    elements.publishButton.disabled = true;
    
    try {
        // 准备文件名和路径
        const fileName = slug + '.md';
        const filePath = CONFIG.BLOG_PATH + fileName;
        
        // 准备文件内容（添加frontmatter）
        const date = new Date().toISOString();
        const fileContent = `---
title: "${title}"
date: "${date}"
---

${content}`;
        
        // 首先确保blog/posts目录存在
        await ensureDirectoryExists('blog/posts', token);
        
        // 调用GitHub API来创建或更新文件
        const success = await createOrUpdateFileInGitHub(filePath, fileContent, token);
        
        if (success) {
            // 创建HTML页面
            const htmlSuccess = await createBlogHtmlPage(filePath, title, date, content);
            
            if (htmlSuccess) {
                elements.statusMessage.innerHTML = '✅ 发布成功！';
                elements.statusMessage.className = 'status-message success';
                
                // 清空表单
                setTimeout(() => {
                    elements.titleInput.value = '';
                    elements.slugInput.value = '';
                    elements.contentTextarea.value = '';
                    updatePreview();
                    elements.statusMessage.style.display = 'none';
                    elements.publishButton.disabled = false;
                }, 2000);
            } else {
                throw new Error('发布HTML页面失败');
            }
        } else {
            throw new Error('发布Markdown文件失败');
        }
    } catch (error) {
        console.error('发布博客时出错:', error);
        elements.statusMessage.innerHTML = '❌ 发布失败: ' + error.message;
        elements.statusMessage.className = 'status-message error';
        elements.publishButton.disabled = false;
    }
}

// 创建安全的文件名
function createSafeFileName(title) {
    // 生成基于日期和标题的文件名
    const date = new Date().toISOString().split('T')[0]; // 格式: YYYY-MM-DD
    const safeName = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // 移除特殊字符
        .replace(/\s+/g, '-')     // 将空格替换为短横线
        .replace(/-+/g, '-');     // 合并多个短横线
    
    return `${date}-${safeName}`;
}

// 通过GitHub API创建或更新文件
async function createOrUpdateFileInGitHub(path, content, token) {
    // 这个函数在实际使用中需要完整实现
    // 以下是一个简化的示例，仅作为参考
    
    try {
        // 1. 检查文件是否已存在
        let sha = null;
        try {
            const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                sha = data.sha;
            }
        } catch (error) {
            // 文件不存在，忽略错误
        }
        
        // 2. 创建或更新文件
        const endpoint = `https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}/contents/${path}`;
        const body = {
            message: sha ? `更新博客: ${path}` : `创建博客: ${path}`,
            content: btoa(unescape(encodeURIComponent(content))), // Base64编码
            branch: 'main' // 或者是你的默认分支
        };
        
        if (sha) {
            body.sha = sha;
        }
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '请求失败');
        }
        
        return true;
    } catch (error) {
        console.error('GitHub API请求失败:', error);
        throw error;
    }
}

// 创建博客HTML页面
async function createBlogHtmlPage(path, title, date, content) {
    try {
        // 获取博客模板
        const templateResponse = await fetch(`/blog/template.html`);
        if (!templateResponse.ok) {
            throw new Error('无法获取博客模板');
        }
        
        let templateHtml = await templateResponse.text();
        
        // 提取博客内容的前150个字符作为描述
        const description = content.substring(0, 150).replace(/\n/g, ' ') + (content.length > 150 ? '...' : '');
        
        // 将Markdown转换为HTML（使用marked.js库）
        const rawHtml = marked.parse(content);
        const contentHtml = DOMPurify.sanitize(rawHtml);
        
        // 格式化日期
        const formattedDate = new Date(date).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // 替换模板中的占位符
        templateHtml = templateHtml
            .replace(/BLOG_TITLE/g, title)
            .replace(/BLOG_DESCRIPTION/g, description)
            .replace(/BLOG_DATE/g, formattedDate)
            .replace(/BLOG_URL/g, `https://${CONFIG.GITHUB_REPO_OWNER}.github.io${path.replace('.md', '.html')}`)
            .replace(/BLOG_CONTENT/g, contentHtml);
        
        // 计算HTML文件路径
        const htmlPath = path.replace('.md', '.html').replace(CONFIG.BLOG_PATH, 'blog/posts/');
        
        // 创建HTML文件
        const token = localStorage.getItem('github_token');
        const success = await createOrUpdateFileInGitHub(htmlPath, templateHtml, token);
        
        return success;
    } catch (error) {
        console.error('创建博客HTML页面失败:', error);
        return false;
    }
}

// 简化的Markdown转HTML函数（实际应用中应使用成熟的库）
function convertMarkdownToHtml(markdown) {
    // 这里使用与预览相同的转换逻辑
    let html = markdown
        // 标题
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        // 粗体和斜体
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // 链接
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // 图片
        .replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        // 代码块
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // 行内代码
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 引用
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        // 列表
        .replace(/^\s*\d+\. (.*$)/gm, '<ol><li>$1</li></ol>')
        .replace(/^\s*- (.*$)/gm, '<ul><li>$1</li></ul>')
        // 段落
        .replace(/^(?!<[a-z])/gm, '<p>')
        .replace(/^(.*?)$/gm, function(match) {
            return match.startsWith('<') ? match : match + '</p>';
        });
    
    // 清理重复的列表标签
    html = html.replace(/<\/ol><ol>/g, '').replace(/<\/ul><ul>/g, '');
    
    return html;
}

// 确保目录存在（如果不存在则创建）
async function ensureDirectoryExists(path, token) {
    try {
        // 检查目录是否存在
        try {
            const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            if (response.ok) {
                // 目录已存在
                return true;
            }
        } catch (error) {
            // 忽略错误，继续创建目录
        }
        
        // 目录不存在，创建一个.gitkeep文件来创建目录
        const endpoint = `https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}/contents/${path}/.gitkeep`;
        const body = {
            message: `创建目录: ${path}`,
            content: btoa(''), // 空文件内容的Base64编码
            branch: 'main' // 或者是你的默认分支
        };
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '创建目录失败');
        }
        
        return true;
    } catch (error) {
        console.error('确保目录存在时出错:', error);
        throw error;
    }
}

// 登出
function logout() {
    localStorage.removeItem('github_token');
    eraseCookie(CONFIG.TOKEN_COOKIE_NAME);
    elements.loginSection.classList.remove('hidden');
    elements.editorSection.classList.add('hidden');
    elements.passwordInput.value = '';
    elements.passwordInput.disabled = false;
    elements.tokenInput.value = '';
    elements.tokenSection.classList.add('hidden');
    elements.saveTokenCheckbox.checked = false;
}

// 添加Markdown编辑工具栏功能
function initMarkdownToolbar() {
    const toolbar = document.getElementById('markdown-toolbar');
    if (!toolbar) return;
    
    // 定义工具栏按钮及其对应的Markdown语法
    const tools = [
        { id: 'heading', icon: 'H', title: '标题', prefix: '# ', placeholder: '标题文本' },
        { id: 'bold', icon: 'B', title: '粗体', prefix: '**', suffix: '**', placeholder: '粗体文本' },
        { id: 'italic', icon: 'I', title: '斜体', prefix: '*', suffix: '*', placeholder: '斜体文本' },
        { id: 'link', icon: '🔗', title: '链接', prefix: '[', suffix: '](url)', placeholder: '链接文本' },
        { id: 'image', icon: '🖼️', title: '图片', prefix: '![', suffix: '](url)', placeholder: '图片描述' },
        { id: 'code', icon: '`', title: '代码', prefix: '```\n', suffix: '\n```', placeholder: '代码块' },
        { id: 'quote', icon: '"', title: '引用', prefix: '> ', placeholder: '引用文本' },
        { id: 'list', icon: '•', title: '无序列表', prefix: '- ', placeholder: '列表项' },
        { id: 'orderedList', icon: '1.', title: '有序列表', prefix: '1. ', placeholder: '列表项' }
    ];
    
    // 为每个工具创建按钮
    tools.forEach(tool => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'markdown-tool';
        button.title = tool.title;
        button.textContent = tool.icon;
        
        button.addEventListener('click', () => {
            applyMarkdownSyntax(tool);
        });
        
        toolbar.appendChild(button);
    });
}

// 应用Markdown语法到文本区域
function applyMarkdownSyntax(tool) {
    const textarea = elements.contentTextarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let insertText;
    if (selectedText) {
        // 已选择文本，应用语法
        insertText = tool.prefix + selectedText + (tool.suffix || '');
    } else {
        // 未选择文本，插入带占位符的语法
        insertText = tool.prefix + tool.placeholder + (tool.suffix || '');
    }
    
    // 更新文本区域内容
    textarea.value = textarea.value.substring(0, start) + insertText + textarea.value.substring(end);
    
    // 设置新的光标位置
    const newCursorPos = selectedText ? start + insertText.length : start + tool.prefix.length + tool.placeholder.length;
    textarea.focus();
    textarea.setSelectionRange(selectedText ? start + insertText.length : start + tool.prefix.length, newCursorPos);
    
    // 更新预览
    updatePreview();
}

// 保存草稿功能
function saveAsDraft() {
    const title = elements.titleInput.value;
    const content = elements.contentTextarea.value;
    
    if (!title && !content) return; // 如果没有内容，不保存
    
    const draft = {
        title,
        content,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('blog_draft', JSON.stringify(draft));
    showMessage('草稿已保存', 'success');
}

// 加载草稿
function loadDraft() {
    const draftJson = localStorage.getItem('blog_draft');
    if (!draftJson) return;
    
    try {
        const draft = JSON.parse(draftJson);
        elements.titleInput.value = draft.title || '';
        elements.contentTextarea.value = draft.content || '';
        updatePreview();
        
        // 如果标题有内容，自动生成slug
        if (draft.title) {
            elements.slugInput.value = createSafeFileName(draft.title);
        }
        
        showMessage(`已加载上次编辑的草稿 (${new Date(draft.timestamp).toLocaleString()})`, 'info');
    } catch (error) {
        console.error('加载草稿时出错:', error);
    }
}

// 自动保存功能
function initAutosave() {
    // 每60秒自动保存一次
    setInterval(saveAsDraft, 60000);
    
    // 页面关闭前保存
    window.addEventListener('beforeunload', saveAsDraft);
}
