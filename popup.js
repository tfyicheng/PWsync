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


// 读取 WebDAV 文件
async function readWebDAVFile(url, username, password, filePath) {
    try {
        const response = await axios.get(`${url}${filePath}`, {
            auth: { username, password },
            responseType: "arraybuffer",
        });
        return response.data; // 返回文件内容
    } catch (error) {
        console.error("更新文件失败：", error.response ? error.response.status || error.message : error.message);
        return null;
    }
}

// 修改 WebDAV 文件
async function updateWebDAVFile(url, username, password, filePath, data) {
    try {
        const response = await axios.put(`${url}${filePath}`, data, {
            auth: { username, password },
        });
        console.log("文件更新成功！");
        return true;
    } catch (error) {
        console.error("更新文件失败：", error.response ? error.response.status || error.message : error.message);
        return false;
    }
}

// 获取文件列表
async function listFiles(url, username, password, path = "") {
    try {
        const response = await axios.request({
            method: "PROPFIND",
            url: `${url}${path}`,
            auth: { username: username, password: password },
        });
        console.log("文件列表：", response.data);
    } catch (error) {
        console.error("请求失败：", error.response.status);
    }
}

// 测试按钮
document.getElementById('test-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async(tabs) => {
        console.log("test");
        //  console.log("a", axios);
        //  console.log("b", XLSX);
        const result = await chrome.storage.local.get('webdavConfig');
        const { url, username, password } = result.webdavConfig || {};
        if (!url || !username || !password) {
            console.error("未配置 WebDAV，请先设置 WebDAV 信息！");
            sendResponse({ error: "未配置 WebDAV" });
            return;
        }

        const FILE_PATH = "PWsync/pw.xls"; // WebDAV 中的文件路径
        const fileContent = "test";

        const success = await updateWebDAVFile(url, username, password, FILE_PATH, fileContent);
        console.log("success", success);


        return;
        // chrome.tabs.sendMessage(tabs[0].id, { action: 'test' });
        chrome.tabs.sendMessage(tabs[0].id, { action: "test" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error:", chrome.runtime.lastError);
            } else {
                console.log("Response:", response);
            }
        });
    });
});

const dbName = "WebDAVFileStorage";
const storeName = "files";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "path" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveFileToDB(path, data) {
    const db = await openDB();
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.put({ path, data });
}

async function getFileFromDB(path) {
    const db = await openDB();
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.get(path);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = () => reject(request.error);
    });
}