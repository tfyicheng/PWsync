// 检查是否已配置 WebDAV
chrome.storage.local.get('webdavConfig', (result) => {
    if (!result.webdavConfig) {
        // 如果未配置 WebDAV，跳转到配置页面
        chrome.tabs.create({ url: chrome.runtime.getURL('config/config.html') });
    }
});

// 加密函数
function encryptData(data, key) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

// 解密函数
function decryptData(encryptedData, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

// 刷新数据
document.getElementById('refresh-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getData' }, (response) => {
            chrome.storage.local.get('encryptionKey', (result) => {
                const key = result.encryptionKey;
                if (key) {
                    const decryptedData = decryptData(response.data, key);
                    const container = document.getElementById('data-container');
                    container.innerHTML = '';
                    decryptedData.forEach((item) => {
                        const div = document.createElement('div');
                        div.innerHTML = `
              <label>网站: <input type="text" value="${item.website}" readonly></label>
              <label>账号: <input type="text" value="${item.username}"></label>
              <label>密码: <input type="password" value="${item.password}"></label>
            `;
                        container.appendChild(div);
                    });
                } else {
                    alert('请先配置加密密钥！');
                }
            });
        });
    });
});

// 保存数据
document.getElementById('save-btn').addEventListener('click', () => {
    const inputs = document.querySelectorAll('#data-container input');
    const data = [];
    for (let i = 0; i < inputs.length; i += 3) {
        data.push({
            website: inputs[i].value,
            username: inputs[i + 1].value,
            password: inputs[i + 2].value,
        });
    }
    chrome.storage.local.get('encryptionKey', (result) => {
        const key = result.encryptionKey;
        if (key) {
            const encryptedData = encryptData(data, key);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'saveData', data: encryptedData });
            });
        } else {
            alert('请先配置加密密钥！');
        }
    });
});

// 测试按钮
document.getElementById('test-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'test' });
    });
});