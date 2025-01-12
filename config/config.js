// 页面加载时读取已保存的配置
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get('webdavConfig', (result) => {
        if (result.webdavConfig) {
            // 如果已保存配置，填充到输入框中
            document.getElementById('webdav-url').value = result.webdavConfig.url;
            document.getElementById('webdav-username').value = result.webdavConfig.username;
            document.getElementById('webdav-password').value = result.webdavConfig.password;
        }
    });
});

// 保存 WebDAV 配置
document.getElementById('save-config-btn').addEventListener('click', () => {
    const url = document.getElementById('webdav-url').value;
    const username = document.getElementById('webdav-username').value;
    const password = document.getElementById('webdav-password').value;

    if (url && username && password) {
        chrome.storage.local.set({ webdavConfig: { url, username, password } }, () => {
            alert('配置已保存！');
            window.close(); // 关闭配置页面
        });
    } else {
        alert('请填写完整的配置信息！');
    }
});

// 重置 WebDAV 配置
document.getElementById('reset-config-btn').addEventListener('click', () => {
    chrome.storage.local.remove('webdavConfig', () => {
        alert('配置已重置！');
        // 清空输入框
        document.getElementById('webdav-url').value = '';
        document.getElementById('webdav-username').value = '';
        document.getElementById('webdav-password').value = '';
    });
});