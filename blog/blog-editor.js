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
    
    // 直接显示编辑器，不再需要管理员登录
    showEditor(); 
});

// 缓存DOM元素
function cacheElements() {
    elements = {
        loginContainer: document.querySelector('.login-container'), // Will be kept hidden
        editorContainer: document.querySelector('.editor-container'),
        titleInput: document.getElementById('blog-title'),
        contentTextarea: document.getElementById('blog-content'),
        previewPane: document.getElementById('preview-pane'),
        previewPaneContainer: document.getElementById('preview-pane-container'), 
        fullscreenPreviewBtn: document.getElementById('fullscreen-preview-btn'), 
        publishButton: document.getElementById('publish-btn'),
        logoutButton: document.getElementById('logout-btn'),
        submitStatus: document.getElementById('submit-status')
    };
    // Ensure login container is hidden by default if it exists
    if (elements.loginContainer) {
        elements.loginContainer.style.display = 'none';
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 实时Markdown预览
    elements.contentTextarea.addEventListener('input', updatePreview);
    
    // 文章发布
    elements.publishButton.addEventListener('click', publishBlog);
    
    // 登出
    elements.logoutButton.addEventListener('click', logout);

    // 全屏预览按钮
    if (elements.fullscreenPreviewBtn) {
        elements.fullscreenPreviewBtn.addEventListener('click', toggleFullScreenPreview);
    }
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

    // 使用 marked.js 进行Markdown转换
    if (typeof marked === 'undefined') {
        console.error('marked.js 未加载');
        elements.previewPane.innerHTML = `<div class="markdown-content"><p style="color: red;">错误：Markdown预览功能不可用，marked.js 未加载。</p></div>`;
        return;
    }
    const html = marked.parse(markdown);

    elements.previewPane.innerHTML = `<div class="markdown-content">${html}</div>`;
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
    if(elements.loginContainer) elements.loginContainer.style.display = 'none'; // Ensure login form is hidden
    if(elements.editorContainer) elements.editorContainer.style.display = 'block';
}

// 发布博客文章
async function publishBlog() {
    const title = elements.titleInput.value.trim();
    const content = elements.contentTextarea.value.trim();
    let token = localStorage.getItem('github_token');

    if (!title || !content) {
        displaySubmitStatus('标题和内容不能为空', 'error');
        return;
    }

    if (!token) {
        const userProvidedToken = prompt('请输入您的 GitHub 个人访问令牌 (Personal Access Token):');
        if (userProvidedToken && userProvidedToken.trim() !== '') {
            localStorage.setItem('github_token', userProvidedToken);
            token = userProvidedToken;
        } else {
            displaySubmitStatus('需要 GitHub 个人访问令牌才能发布。', 'error');
            // 确保按钮在用户取消提示后恢复可用状态
            elements.publishButton.disabled = false;
            elements.publishButton.textContent = '发布博客';
            return;
        }
    }

    // 显示加载状态
    elements.publishButton.disabled = true;
    elements.publishButton.textContent = '发布中...';
    displaySubmitStatus('正在准备发布...', 'info');

    try {
        // 生成文件名 (基于标题和日期)
        const date = new Date();
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        // 移除非法字符，并将空格替换为连字符
        const safeTitle = title.replace(/[\\/:*?"<>|\s]/g, '-').toLowerCase();
        const fileName = `${dateString}-${safeTitle}.md`;

        // 创建Markdown文件内容，包含元信息 (Front Matter)
        const fileContent = `---
title: "${title}"
date: ${date.toISOString()}
layout: post
---

${content}`;

        const filePath = `${CONFIG.BLOG_PATH}_posts/${fileName}`; // 修改路径以符合Jekyll的 _posts 结构

        // 检查文件是否存在
        let fileExists = false;
        let existingFileSha = null;
        try {
            const existingFile = await getGithubFile(filePath, token);
            if (existingFile) {
                fileExists = true;
                existingFileSha = existingFile.sha;
                displaySubmitStatus('文件已存在，将进行更新。', 'info');
            }
        } catch (error) {
            // 文件不存在是正常的，继续创建
            if (error.message.includes('404')) {
                displaySubmitStatus('创建新博文...', 'info');
            } else {
                throw error; // 其他错误则抛出
            }
        }

        // 上传或更新文件到GitHub
        await uploadToGithub(filePath, fileContent, token, existingFileSha);

        displaySubmitStatus('博客发布成功！', 'success');
        elements.titleInput.value = '';
        elements.contentTextarea.value = '';
        updatePreview(); // 清空预览

    } catch (error) {
        console.error('发布失败:', error);
        let errorMessage = '发布失败，请检查网络连接或GitHub配置。';
        if (error.message.includes('401')) {
            errorMessage = 'GitHub Token无效或已过期，请重新登录。';
            logout(); // Token无效，强制登出
        } else if (error.message.includes('404') && error.message.includes('repository not found')) {
            errorMessage = '仓库未找到，请检查GitHub用户名和仓库名配置。';
        } else if (error.message.includes('rate limit exceeded')) {
            errorMessage = 'GitHub API请求频率超限，请稍后再试。';
        }
        displaySubmitStatus(errorMessage, 'error');
    } finally {
        elements.publishButton.disabled = false;
        elements.publishButton.textContent = '发布博客';
    }
}

// 从GitHub获取文件 (用于检查文件是否存在及其SHA)
async function getGithubFile(filePath, token) {
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}/contents/${filePath}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (response.status === 404) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`File not found (404): ${errorData.message || 'Unknown error'}`);
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`获取文件失败 (${response.status}): ${errorData.message || 'Unknown error'}`);
    }
    return await response.json();
}

// 上传文件到GitHub
async function uploadToGithub(filePath, content, token, sha) {
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}/contents/${filePath}`;
    
    const body = {
        message: `博客文章: ${elements.titleInput.value.trim()}`, // 提交信息
        content: btoa(unescape(encodeURIComponent(content))), // Base64编码，并处理UTF-8字符
        branch: 'main' // 或者你的默认分支
    };

    if (sha) {
        body.sha = sha; // 如果是更新操作，需要提供文件的SHA
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // 尝试解析错误信息
        let errorMessage = `GitHub API错误 (${response.status})`;
        if (errorData && errorData.message) {
            errorMessage += `: ${errorData.message}`;
        }
        // 特别处理401和404错误
        if (response.status === 401) {
            throw new Error('GitHub Token无效或已过期 (401)');
        } else if (response.status === 404 && errorData.message && errorData.message.toLowerCase().includes('repository not found')) {
            throw new Error('仓库未找到 (404)');
        } else if (response.status === 422 && errorData.message && errorData.message.toLowerCase().includes('sha' )) {
             throw new Error('文件内容冲突或SHA已过时 (422)，请刷新页面重试。');
        }
        throw new Error(errorMessage);
    }

    return await response.json();
}

// 显示发布状态
function displaySubmitStatus(message, type) {
    elements.submitStatus.textContent = message;
    elements.submitStatus.className = 'submit-status';
    elements.submitStatus.classList.add(type === 'error' ? 'error-message' : type === 'success' ? 'success-message' : 'info-message');
    elements.submitStatus.style.display = 'block';
}

// 切换预览区域全屏
function toggleFullScreenPreview() {
    if (elements.previewPaneContainer) {
        elements.previewPaneContainer.classList.toggle('fullscreen');
        // 更新按钮文本/图标
        if (elements.previewPaneContainer.classList.contains('fullscreen')) {
            elements.fullscreenPreviewBtn.textContent = '↙️'; // 指向左下的箭头，表示退出全屏
            elements.fullscreenPreviewBtn.title = '退出全屏';
        } else {
            elements.fullscreenPreviewBtn.textContent = '↗️'; // 指向右上的箭头，表示全屏
            elements.fullscreenPreviewBtn.title = '全屏预览';
        }
    }
}

// 登出
function logout() {
    localStorage.removeItem('github_token');
    if(elements.editorContainer) elements.editorContainer.style.display = 'none';
    if(elements.loginContainer) elements.loginContainer.style.display = 'none'; // Keep login form hidden
    if(elements.submitStatus) displaySubmitStatus('您已登出。下次发布时将需要 GitHub 令牌。', 'info');
    else alert('您已登出。下次发布时将需要 GitHub 令牌。');
}
