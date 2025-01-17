// 检查是否已配置 WebDAV
chrome.storage.local.get('webdavConfig', (result) => {
    if (!result.webdavConfig) {
        // 如果未配置 WebDAV，点击图标时打开配置页面
        chrome.action.onClicked.addListener(() => {
            chrome.tabs.create({ url: chrome.runtime.getURL('config/config.html') });
        });
    }
});

// 右键菜单：打开配置页面
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "open-config",
        title: "打开配置页面",
        contexts: ["action"], // 仅在插件图标上显示
    });
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "open-config") {
        chrome.tabs.create({ url: chrome.runtime.getURL('config/config.html') });
    }
});

let db;
const csvPath = "/accounts.csv";
const dbName = "WebDAVFileStorage";
const storeName = "files";
// 初始化 IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "path" });
            }
        };
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onerror = () => reject(request.error);
    });
}

// 从 IndexedDB 读取文件
function getFileFromDB(path) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(path);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = () => reject(request.error);
    });
}

// 保存文件到 IndexedDB
function saveFileToDB(path, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put({ path, data });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// 导入 CSV 文件
async function importCSV(data, mode) {
    try {
        if (!db) await initDB();

        const existingData = await getFileFromDB(csvPath);
        let updatedData;

        if (mode === "overwrite" || !existingData) {
            updatedData = data; // 覆盖现有数据
        } else {
            updatedData = existingData + "\n" + data; // 追加到现有数据
        }

        await saveFileToDB(csvPath, updatedData);
        return { status: "success" };
    } catch (error) {
        return { status: "error", error: error.message };
    }
}


// 导入 CSV 文件
async function importCSV(data, mode) {
    try {
        if (!db) await initDB();

        const existingData = await getFileFromDB(csvPath);
        let updatedData;

        if (mode === "overwrite" || !existingData) {
            updatedData = data; // 覆盖现有数据
        } else {
            updatedData = existingData + "\n" + data; // 追加到现有数据
        }

        await saveFileToDB(csvPath, updatedData);
        return { status: "success" };
    } catch (error) {
        return { status: "error", error: error.message };
    }
}

// 导出 CSV 文件
async function exportCSV(filename) {
    try {
        if (!db) await initDB();

        const csvData = await getFileFromDB(csvPath);
        if (!csvData) {
            throw new Error("没有数据可导出。");
        }

        // 创建 Blob 对象
        const blob = new Blob([csvData], { type: "text/csv" });

        // 使用 File System Access API 保存文件
        const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: "CSV Files",
                accept: { "text/csv": [".csv"] },
            }, ],
        });

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        return { status: "success" };
    } catch (error) {
        return { status: "error", error: error.message };
    }
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async() => {
        try {
            if (!db) await initDB();

            if (message.action === "importCSV") {
                const result = await importCSV(message.data, message.mode);
                sendResponse(result);
            } else if (message.action === "exportCSV") {
                const result = await exportCSV(message.filename);
                sendResponse(result);
            } else if (message.action === "getCSVData") {
                const data = await getFileFromDB(csvPath);
                if (data) {
                    sendResponse({ status: "success", data });
                } else {
                    sendResponse({ status: "error", error: "没有数据可导出。" });
                }
            }
        } catch (error) {
            sendResponse({ status: "error", error: error.message });
        }
    })();
    return true; // 保持消息端口打开，以便异步发送响应
});