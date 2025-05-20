// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 添加页面淡入效果
    document.body.classList.add('fade-in');
    
    // 为所有技能添加动画效果
    const skills = document.querySelectorAll('.skill');
    skills.forEach((skill, index) => {
        setTimeout(() => {
            skill.classList.add('animate');
        }, 200 * index);
    });
    
    // 为项目链接添加点击特效
    const links = document.querySelectorAll('.project-links a, .social-link');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            // 只对带有target="_blank"的链接执行特效
            if (this.getAttribute('target') === '_blank') {
                e.preventDefault();
                const href = this.getAttribute('href');
                
                // 添加点击波纹效果
                const ripple = document.createElement('span');
                ripple.classList.add('ripple-effect');
                this.appendChild(ripple);
                
                // 设置波纹位置
                const rect = this.getBoundingClientRect();
                ripple.style.left = `${e.clientX - rect.left}px`;
                ripple.style.top = `${e.clientY - rect.top}px`;
                
                // 等待动画完成后跳转
                setTimeout(() => {
                    window.open(href, '_blank');
                    ripple.remove();
                }, 300);
            }
        });
    });

    // 添加滚动显示动画
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1
    });

    // 观察所有主要部分
    document.querySelectorAll('.profile-section, .skills-section, .project-links, .contact-section').forEach(section => {
        observer.observe(section);
        section.classList.add('animate-on-scroll');
    });
});
