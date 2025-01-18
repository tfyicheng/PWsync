// 检查是否已配置 WebDAV
chrome.storage.local.get('webdavConfig', (result) => {
    if (!result.webdavConfig) {
        // 如果未配置 WebDAV，跳转到配置页面
        chrome.tabs.create({ url: chrome.runtime.getURL('config/config.html') });
    }
    init();
    getData();
});

async function init() {
    // 获取当前网页的 URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = new URL(tab.url).hostname; // 获取当前网页的域名
    const wedurl = document.querySelector('#curl');
    const link = document.querySelector('#clink');
    if (wedurl) {
        wedurl.value = currentUrl;
    }
    if (link) {
        link.value = tab.url;
    }
}
const FILE_PATH = "PWsync/pw.csv"; // WebDAV 中的文件路径

const csvPath = "/accounts.csv"; // 本地数据路径

//初始化文件 //name域名 url完整链接 username password
function initCSV() {
    const csvData = `name,url,username,password`;
    saveFileToDB(csvPath, csvData);
}

//错误提示
function error(msg) {
    const tip = document.querySelector('#tip');
    if (tip) {
        tip.innerText = msg;
        tip.style.color = "red";
    }
    console.error(msg);
    logMessage(`[错误] ${msg}`);
}

//成功提示
function success(msg) {
    const tip = document.querySelector('#tip');
    if (tip) {
        tip.innerText = msg;
        tip.style.color = "green";
    }
    console.log(msg);
    logMessage(`[成功] ${msg}`);
}

// 日志记录
function logMessage(message) {
    const logContainer = document.getElementById("log-container");
    if (logContainer) {
        const logEntry = document.createElement("div");
        logEntry.textContent = message;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight; // 自动滚动到底部
    }
}

function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tab");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}



// 默认打开日志 Tab
document.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".tablinks").click(); // 默认打开第一个 Tab
});

//初始化获取数据
async function getData() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentUrl = new URL(tab.url).hostname;
        if (currentUrl == "extensions") return;


        const result = await chrome.storage.local.get('webdavConfig');
        const { url, username, password } = result.webdavConfig || {};
        if (!url || !username || !password) {
            console.error("未配置 WebDAV，请先设置 WebDAV 信息！");
            return;
        }
        const cloudData = await readWebDAVFile(url, username, password, FILE_PATH);
        if (!cloudData) {
            error("无法从云端拉取 CSV 数据。");
            return;
        }

        // 确保 cloudData 是字符串
        if (typeof cloudData !== "string") {
            error("从云端拉取的数据格式不正确。");
            return;
        }

        const cloudAccounts = parseCSV(cloudData);
        const localData = await loadCSVFile(csvPath);
        let localAccounts = [];
        if (localData) {
            localAccounts = parseCSV(localData);
        } else {
            error("本地无 CSV 文件，初始化新文件。");
            await initCSV();
        }

        const updatedAccounts = mergeAccounts(cloudAccounts, localAccounts);
        const updatedCSVData = stringifyCSV(updatedAccounts);
        await saveFileToDB(csvPath, updatedCSVData);

        success("数据同步完成。");

        const account = updatedAccounts.find((acc) => acc.name === currentUrl);
        if (!account) {
            error("未找到匹配的账号密码。");
            return;
        }

        const usernameInput = document.querySelector('#cname');
        const passwordInput = document.querySelector('#cpw');

        if (!usernameInput || !passwordInput) {
            error("未找到账号密码输入框。");
            return;
        }

        usernameInput.value = account.username;
        passwordInput.value = account.password;

        success("已获取账号密码");

    } catch (error) {
        console.log("初始化获取数据失败：" + error.message);
    }
}

// 打开配置页面
document.getElementById('set-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('config/config.html') });
});


// 刷新数据
document.getElementById('refresh-btn').addEventListener('click', () => {
    getData();
    return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getData' }, (response) => {
            // console.log("response", response);

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
document.getElementById('save-btn').addEventListener('click', async() => {
    const link = document.querySelector('#clink');
    const urlInput = document.querySelector('#curl');
    const usernameInput = document.querySelector('#cname');
    const passwordInput = document.querySelector('#cpw');
    if (link.value && urlInput.value && usernameInput.value && passwordInput.value) {
        const newData = `${urlInput.value},${link.value},${usernameInput.value},${passwordInput.value}`;
        // appendDataToCSV(csvPath, newData)
        //     .then(() => success("数据已保存"))
        //     .catch((error) => error("数据保存失败：" + error.message));

        try {
            // 追加数据到 CSV
            await appendDataToCSV(csvPath, newData);

            // 从 IndexedDB 读取更新后的 CSV 数据
            const updatedCSVData = await getFileFromDB(csvPath);


            const result = await chrome.storage.local.get('webdavConfig');
            const { url, username, password } = result.webdavConfig || {};
            if (!url || !username || !password) {
                console.error("未配置 WebDAV，请先设置 WebDAV 信息！");
                return;
            }




            const success = await updateWebDAVFile(url, username, password, FILE_PATH, updatedCSVData);
            if (success) {
                console.log("数据已保存到 WebDAV。");
            } else {
                console.error("数据保存到 WebDAV 失败。");
            }
        } catch (error) {
            console.error("数据保存失败：" + error.message);
        }

    } else {
        error("数据保存失败：缺少url或其他信息");
    }

    return;
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

// 读取 CSV 文件并填充账号密码
document.getElementById("fill-credentials").addEventListener("click", async() => {
    // 获取当前激活的标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
        console.error("未找到激活的标签页。");
        return;
    }

    // 读取 CSV 文件
    const csvData = await loadCSVFile(csvPath);
    if (!csvData) {
        console.error("无法读取 CSV 文件。");
        return;
    }

    // 解析 CSV 文件
    // const accounts = parseCSV(csvData);

    // // 获取当前网页的 URL
    // const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // const currentUrl = new URL(tab.url).hostname; // 获取当前网页的域名

    // // 查找匹配的账号密码
    // const account = accounts.find((acc) => acc.Website === currentUrl);
    // if (!account) {
    //     console.error("未找到匹配的账号密码。");
    //     return;
    // }

    // 从 popup.html 中获取用户输入的账号密码
    const usernameInput = document.querySelector('#cname');
    const passwordInput = document.querySelector('#cpw');

    if (!usernameInput || !passwordInput) {
        error("未找到账号密码输入框。");
        return;
    }

    const username = usernameInput.value;
    const password = passwordInput.value;

    // 向内容脚本发送消息，填充账号密码
    chrome.tabs.sendMessage(tab.id, {
        action: "fillCredentials",
        username: username,
        password: password,
    });
});

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

        //  const success = await updateWebDAVFile(url, username, password, FILE_PATH, fileContent);
        // console.log("success", success);


        //  return;
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

// 导出按钮点击事件
document.getElementById("export-btn").addEventListener("click", async() => {
    // 向后台脚本请求 CSV 数据
    chrome.runtime.sendMessage({ action: "getCSVData" },
        async(response) => {
            if (response.status === "success") {
                const csvData = response.data;

                try {
                    // 使用 File System Access API 保存文件
                    const blob = new Blob([csvData], { type: "text/csv" });
                    const handle = await window.showSaveFilePicker({
                        suggestedName: "data.csv", // 默认文件名,
                        types: [{
                            description: "CSV Files",
                            accept: { "text/csv": [".csv"] },
                        }, ],
                    });

                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    alert("导出成功！");
                } catch (error) {
                    alert("导出失败：" + error.message);
                }
            } else {
                alert("导出失败：" + response.error);
            }
        }
    );
});

//#region 加密解密

// 加密函数
function encryptData(data, key) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

// 解密函数
function decryptData(encryptedData, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

//#endregion

//#region  WebDAV 操作

//创建目录
async function createParentDirectory(url, username, password, path) {
    const parentPath = path.split("/").slice(0, -1).join("/"); // 获取父目录路径
    try {
        const response = await axios.request({
            method: "MKCOL",
            url: `${url}${parentPath}`,
            auth: { username, password },
        });
        console.log("父目录创建成功：", parentPath);
        return true;
    } catch (error) {
        console.error("父目录创建失败：", error.response ? error.response.status || error.message : error.message);
        return false;
    }
}

// 读取 WebDAV 文件
async function readWebDAVFile(url, username, password, filePath) {
    try {
        const response = await axios.get(`${url}${filePath}`, {
            auth: { username, password },
            responseType: "arraybuffer",
        });
        // return response.data; // 返回文件内容

        // 将 ArrayBuffer 转换为字符串
        const decoder = new TextDecoder("utf-8");
        const csvData = decoder.decode(response.data);
        return csvData;
    } catch (error) {
        console.error("更新文件失败：", error.response ? error.response.status || error.message : error.message);
        return null;
    }
}

// 修改 WebDAV 文件
async function updateWebDAVFile(url, username, password, filePath, data) {
    try {
        // 检查并创建父目录
        await createParentDirectory(url, username, password, filePath);

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

// 获取dev文件列表
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

//#endregion

//#region  本地数据库操作

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
    console.log("文件已保存到 IndexedDB");
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

async function appendDataToCSV(path, newData) {
    try {
        // 从 IndexedDB 中读取 CSV 数据
        const csvData = await getFileFromDB(path);
        if (!csvData) {
            throw new Error("无法读取 CSV 文件。");
        }

        // 解析 CSV 数据
        const rows = csvData.split("\n");
        const headers = rows[0].split(","); // 第一行为表头
        const data = rows.slice(1).map((row) => {
            const values = row.split(",");
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index];
                return obj;
            }, {});
        });

        // 解析新数据
        const newValues = newData.split(",");
        const newRow = headers.reduce((obj, header, index) => {
            obj[header] = newValues[index];
            return obj;
        }, {});

        // 查找是否已存在相同 name 的数据
        const existingIndex = data.findIndex((row) => row.name === newRow.name);

        if (existingIndex !== -1) {
            // 如果存在，更新数据
            data[existingIndex] = newRow;
        } else {
            // 如果不存在，追加新数据
            data.push(newRow);
        }

        // 将数据转换回 CSV 格式
        const updatedCSVData = [
            headers.join(","), // 表头
            ...data.map((row) => headers.map((header) => row[header]).join(",")), // 数据行
        ].join("\n");

        // 保存更新后的 CSV 数据回 IndexedDB
        await saveFileToDB(path, updatedCSVData);
        console.log("数据已更新并保存。");
    } catch (error) {
        console.error("数据更新失败：", error);
    }
}

//#endregion

//#region  CSV 文件操作

// 从 IndexedDB 读取 CSV 文件
async function loadCSVFile(filePath) {
    const db = await openDB(); // 打开 IndexedDB
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.get(filePath);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = () => reject(request.error);
    });
}

// 解析 CSV 文件内容
function parseCSV(csvData) {
    const rows = csvData.split("\n");
    const headers = rows[0].split(","); // 第一行为表头
    const data = rows.slice(1).map((row) => {
        const values = row.split(",");
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
        }, {});
    });
    return data;
}

// 合并云端和本地数据
function mergeAccounts(cloudAccounts, localAccounts) {
    const mergedAccounts = [...localAccounts];

    cloudAccounts.forEach((cloudAccount) => {
        const existingIndex = mergedAccounts.findIndex((localAccount) => localAccount.name === cloudAccount.name);
        if (existingIndex !== -1) {
            mergedAccounts[existingIndex] = cloudAccount;
        } else {
            mergedAccounts.push(cloudAccount);
        }
    });

    return mergedAccounts;
}

// 将数据转换回 CSV 格式
function stringifyCSV(data) {
    const headers = Object.keys(data[0]);
    const rows = data.map((item) => headers.map((header) => item[header]).join(","));
    return [headers.join(","), ...rows].join("\n");
}


// 示例：读取并解析 CSV 文件
// loadCSVFile("/accounts.csv").then((csvData) => {
//     if (csvData) {
//         const accounts = parseCSV(csvData);
//         console.log("解析后的账号数据：", accounts);
//     } else {
//         console.error("无法读取 CSV 文件。");
//     }
// });

//#endregion