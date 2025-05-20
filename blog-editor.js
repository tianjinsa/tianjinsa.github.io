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
    
    // 如果localStorage中有token，尝试自动登录
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
        githubTokenInput: document.getElementById('github-token'),
        toggleToken: document.getElementById('toggle-token'),
        githubTokenContainer: document.querySelector('.github-token-container'),
        fullscreenPreviewBtn: document.getElementById('fullscreen-preview'),
        fullscreenModal: document.getElementById('fullscreen-preview-modal'),
        fullscreenContent: document.getElementById('fullscreen-content'),
        closeFullscreenBtn: document.getElementById('close-fullscreen'),
        fullscreenTitle: document.getElementById('fullscreen-title')
    };
}

// 设置事件监听器
function setupEventListeners() {
    // 登录表单提交
    elements.loginForm.addEventListener('submit', handleLogin);
    
    // 密码显示切换
    elements.togglePassword.addEventListener('click', togglePasswordVisibility);
    
    // Token显示切换
    elements.toggleToken && elements.toggleToken.addEventListener('click', toggleTokenVisibility);
    
    // 实时Markdown预览
    elements.contentTextarea.addEventListener('input', updatePreview);
    
    // 文章发布
    elements.publishButton.addEventListener('click', publishBlog);
    
    // 登出
    elements.logoutButton.addEventListener('click', logout);
    
    // 全屏预览
    elements.fullscreenPreviewBtn && elements.fullscreenPreviewBtn.addEventListener('click', toggleFullscreenPreview);
    
    // 关闭全屏预览
    elements.closeFullscreenBtn && elements.closeFullscreenBtn.addEventListener('click', toggleFullscreenPreview);
}

// 切换密码可见性
function togglePasswordVisibility() {
    const type = elements.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    elements.passwordInput.setAttribute('type', type);
    elements.togglePassword.textContent = type === 'password' ? '👁️' : '🔒';
}

// 切换令牌可见性
function toggleTokenVisibility() {
    if (!elements.githubTokenInput) return;
    
    const type = elements.githubTokenInput.getAttribute('type') === 'password' ? 'text' : 'password';
    elements.githubTokenInput.setAttribute('type', type);
    elements.toggleToken.textContent = type === 'password' ? '👁️' : '🔒';
}

// 初始化Markdown预览
function initMarkdownPreview() {
    elements.previewPane.innerHTML = `<div class="markdown-content">
        <p>预览将显示在这里...</p>
    </div>`;
    
    // 初始更新预览
    updatePreview();
}

// 切换全屏预览模式
function toggleFullscreenPreview() {
    if (!elements.fullscreenModal) return;
    
    const isActive = elements.fullscreenModal.classList.contains('active');
    
    if (isActive) {
        // 关闭全屏预览
        elements.fullscreenModal.classList.remove('active');
        document.body.style.overflow = '';
    } else {
        // 打开全屏预览
        // 更新标题
        elements.fullscreenTitle.textContent = elements.titleInput.value || '博客预览';
        
        // 更新预览内容
        updateFullscreenPreview();
        
        // 显示全屏模式
        elements.fullscreenModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }
}

// 更新全屏预览内容
function updateFullscreenPreview() {
    if (!elements.fullscreenContent) return;
    
    // 获取预览内容
    const previewContent = elements.previewPane.innerHTML;
    elements.fullscreenContent.innerHTML = previewContent;
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
    
    // 如果全屏预览模式是打开的，也更新全屏预览
    if (elements.fullscreenModal && elements.fullscreenModal.classList.contains('active')) {
        updateFullscreenPreview();
    }
}

// 尝试自动登录
function tryAutoLogin() {
    // 优先从localStorage获取令牌
    let token = localStorage.getItem('github_token');
    
    // 如果localStorage中没有，则尝试从Cookie获取
    if (!token) {
        token = getCookie('github_token');
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
                // 清除Cookie中的令牌
                document.cookie = 'github_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            }
        })
        .catch(error => {
            console.error('验证token时出错:', error);
            localStorage.removeItem('github_token');
            // 清除Cookie中的令牌
            document.cookie = 'github_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
            // 检查是否有已保存的令牌
            const savedToken = getCookie('github_token');
            if (savedToken) {
                // 验证令牌有效性
                if (await validateGithubToken(savedToken)) {
                    localStorage.setItem('github_token', savedToken);
                    showMessage('登录成功！', 'success');
                    setTimeout(() => {
                        showEditor();
                    }, 1000);
                    return;
                }
            }
            
            // 显示GitHub令牌输入框
            elements.githubTokenContainer.style.display = 'block';
            
            // 如果已有令牌输入，则验证并登录
            if (elements.githubTokenInput.value) {
                const token = elements.githubTokenInput.value;
                if (await validateGithubToken(token)) {
                    saveGithubToken(token);
                    showMessage('登录成功！', 'success');
                    setTimeout(() => {
                        showEditor();
                    }, 1000);
                } else {
                    showMessage('GitHub令牌无效，请重新输入', 'error');
                }
            }
        } else {
            showMessage('密码不正确', 'error');
        }
    } catch (error) {
        console.error('登录时出错:', error);
        showMessage('登录过程中发生错误', 'error');
    }
}

// 验证GitHub令牌是否有效
async function validateGithubToken(token) {
    try {
        const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}`, {
            headers: {
                'Authorization': `token ${token}`
            }
        });
        return response.ok;
    } catch (error) {
        console.error('验证GitHub令牌时出错:', error);
        return false;
    }
}

// 保存GitHub令牌到Cookie
function saveGithubToken(token) {
    // 保存令牌到localStorage用于当前会话
    localStorage.setItem('github_token', token);
    
    // 保存令牌到Cookie，有效期30天
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    document.cookie = `github_token=${token}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict; Secure`;
}

// 从Cookie中获取GitHub令牌
function getCookie(name) {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${name}=`));
    
    return cookieValue ? cookieValue.split('=')[1] : null;
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
    const token = localStorage.getItem('github_token');
    
    if (!title || !content) {
        alert('标题和内容不能为空');
        return;
    }
    
    if (!token) {
        alert('您需要登录才能发布博客');
        logout();
        return;
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
    localStorage.removeItem('github_token');
    // 清除Cookie中的令牌
    document.cookie = 'github_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    elements.loginContainer.style.display = 'block';
    elements.editorContainer.style.display = 'none';
    elements.passwordInput.value = '';
    elements.githubTokenInput.value = '';
    elements.githubTokenContainer.style.display = 'none';
}
