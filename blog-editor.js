// 安全配置
const CONFIG = {
    HASH_ITERATIONS: 1000,       // 哈希迭代次数
    GITHUB_REPO_OWNER: 'tianjinsa', // 替换为你的 GitHub 用户名
    GITHUB_REPO_NAME: 'tianjinsa.github.io',  // 替换为你的仓库名
    BLOG_PATH: 'blog/',          // 博客文件存储路径
    PASSWORD_HASH: '2297df0c72a87f029517c0f127ed499e5e086d45cf4793d4e8767a99c39e1690' // 密码的SHA-256哈希
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

    // 检查并请求Token
    checkAndPromptForToken();

    // 如果cookie中有token，尝试自动登录
    tryAutoLogin();
});

// 缓存DOM元素
function cacheElements() {
    elements = {
        loginForm: document.getElementById('login-form'),
        passwordInput: document.getElementById('password'),
        loginMessage: document.getElementById('login-message'),
        loginContainer: document.querySelector('.login-container'),
        editorContainer: document.querySelector('.editor-container'),
        titleInput: document.getElementById('blog-title'),
        contentTextarea: document.getElementById('blog-content'),
        previewPane: document.getElementById('preview-pane'),
        publishButton: document.getElementById('publish-btn'),
        logoutButton: document.getElementById('logout-btn'),
        togglePassword: document.getElementById('toggle-password'),
        submitStatus: document.getElementById('submit-status'),
        fullscreenButton: document.getElementById('fullscreen-btn') // 新增全屏按钮
    };
}

// 设置事件监听器
function setupEventListeners() {
    // 登录表单提交
    elements.loginForm.addEventListener('submit', handleLogin);
    
    // 密码显示切换
    elements.togglePassword.addEventListener('click', togglePasswordVisibility);
    
    // 实时Markdown预览
    elements.contentTextarea.addEventListener('input', updatePreview);
    
    // 文章发布
    elements.publishButton.addEventListener('click', publishBlog);
    
    // 登出
    elements.logoutButton.addEventListener('click', logout);

    // 全屏切换
    if (elements.fullscreenButton) {
        elements.fullscreenButton.addEventListener('click', toggleFullScreen);
    }
}

// 切换密码可见性
function togglePasswordVisibility() {
    const type = elements.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    elements.passwordInput.setAttribute('type', type);
    elements.togglePassword.textContent = type === 'password' ? '👁️' : '🔒';
}

// 初始化Markdown预览
function initMarkdownPreview() {
    elements.previewPane.innerHTML = `<div class="markdown-content">
        <p>预览将显示在这里...</p>
    </div>`;
    
    // 初始更新预览
    updatePreview();
}

// 更新Markdown预览
function updatePreview() {
    const markdown = elements.contentTextarea.value;
    
    if (markdown.trim() === '') {
        elements.previewPane.innerHTML = `<div class="markdown-content">
            <p>预览将显示在这里...</p>
        </div>`;
        return;
    }
    
    // 使用简单的正则表达式进行基本Markdown转换
    // 注意：在生产环境中，最好使用成熟的Markdown解析库如marked.js
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
    
    elements.previewPane.innerHTML = `<div class="markdown-content">${html}</div>`;
}

// 尝试自动登录
function tryAutoLogin() {
    const token = getCookie('github_token');
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
                deleteCookie('github_token');
                promptForToken(); // 提示输入Token
            }
        })
        .catch(error => {
            console.error('验证token时出错:', error);
            deleteCookie('github_token');
            promptForToken(); // 提示输入Token
        });
    } else {
        promptForToken(); // 如果没有token，提示输入
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
    e.preventDefault();
    
    const password = elements.passwordInput.value;
    
    if (!password) {
        showMessage('请输入密码', 'error');
        return;
    }
    
    try {
        // 计算密码哈希
        const hashedPassword = await hashPassword(password);
        
        // 检查密码是否正确
        if (hashedPassword === CONFIG.PASSWORD_HASH) {
            // 登录成功后，获取或提示用户输入Token
            let token = getCookie('github_token');
            if (!token) {
                token = prompt('请输入您的GitHub Personal Access Token:', '');
                if (token) {
                    setCookie('github_token', token, 7); // 保存7天
                } else {
                    showMessage('需要GitHub Token才能继续操作', 'error');
                    return;
                }
            }
            
            showMessage('登录成功！', 'success');
            setTimeout(() => {
                showEditor();
            }, 1000);
        } else {
            showMessage('密码不正确', 'error');
        }
    } catch (error) {
        console.error('登录时出错:', error);
        showMessage('登录过程中发生错误', 'error');
    }
}

// 显示消息
function showMessage(message, type) {
    elements.loginMessage.textContent = message;
    elements.loginMessage.className = 'login-message';
    elements.loginMessage.classList.add(type === 'error' ? 'error-message' : 'success-message');
    elements.loginMessage.style.display = 'block';
    
    // 3秒后自动隐藏消息
    setTimeout(() => {
        elements.loginMessage.style.display = 'none';
    }, 3000);
}

// 显示编辑器
function showEditor() {
    elements.loginContainer.style.display = 'none';
    elements.editorContainer.style.display = 'block';
}

// 发布博客
async function publishBlog() {
    const title = elements.titleInput.value.trim();
    const content = elements.contentTextarea.value.trim();
    let token = getCookie('github_token');
    
    if (!title || !content) {
        alert('标题和内容不能为空');
        return;
    }
    
    if (!token) {
        token = promptForToken();
        if (!token) {
             alert('您需要提供GitHub Token才能发布博客');
             return;
        }
    }
    
    // 显示发布状态
    elements.submitStatus.innerHTML = '<span class="loading-spinner"></span> 正在发布，请稍候...';
    elements.submitStatus.style.display = 'block';
    elements.publishButton.disabled = true;
    
    try {
        // 准备文件名和路径
        const fileName = createSafeFileName(title) + '.md';
        const filePath = CONFIG.BLOG_PATH + fileName;
        
        // 准备文件内容（添加frontmatter）
        const date = new Date().toISOString();
        const fileContent = `---
title: "${title}"
date: "${date}"
---

${content}`;
        
        // 在真实环境中，这里应该调用GitHub API来创建或更新文件
        // 以下是通过GitHub API创建文件的示例代码
        const success = await createOrUpdateFileInGitHub(filePath, fileContent, token);
        
        if (success) {
            elements.submitStatus.innerHTML = '✅ 发布成功！';
            elements.submitStatus.className = 'submit-status success-message';
            
            // 清空表单
            setTimeout(() => {
                elements.titleInput.value = '';
                elements.contentTextarea.value = '';
                updatePreview();
                elements.submitStatus.style.display = 'none';
                elements.publishButton.disabled = false;
            }, 2000);
        } else {
            throw new Error('发布失败');
        }
    } catch (error) {
        console.error('发布博客时出错:', error);
        elements.submitStatus.innerHTML = '❌ 发布失败: ' + error.message;
        elements.submitStatus.className = 'submit-status error-message';
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

// 登出
function logout() {
    deleteCookie('github_token');
    elements.loginContainer.style.display = 'block';
    elements.editorContainer.style.display = 'none';
    elements.passwordInput.value = '';
}

// Cookie 操作函数
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax; Secure";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

// 检查并提示输入Token
function checkAndPromptForToken() {
    if (!getCookie('github_token')) {
        promptForToken();
    }
}

function promptForToken() {
    const token = prompt('请输入您的GitHub Personal Access Token (PAT):\n此Token将保存在Cookie中，用于GitHub API操作。', '');
    if (token) {
        setCookie('github_token', token, 7); // 保存7天
        showMessage('Token已保存。', 'success');
        return token;
    } else {
        showMessage('未提供Token。某些功能可能受限。', 'error');
        return null;
    }
}

// 全屏切换功能
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        elements.previewPane.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
        elements.fullscreenButton.textContent = '退出全屏';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            elements.fullscreenButton.textContent = '全屏预览';
        }
    }
}

// 监听全屏变化事件，以便在用户通过ESC键退出全屏时更新按钮文本
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        elements.fullscreenButton.textContent = '全屏预览';
    }
});
