// 引入本地库文件
importScripts("./lib/axios.min.js");
importScripts("./lib/xlsx.full.min.js");

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     console.log("Message received in content script:", message);
//     sendResponse({ status: "success" });
// });

// 监听消息
chrome.runtime.onMessage.addListener(async(request, sender, sendResponse) => {
    // 从 chrome.storage.local 中读取 WebDAV 配置
    const result = await chrome.storage.local.get('webdavConfig');
    const { url, username, password } = result.webdavConfig || {};
    if (!url || !username || !password) {
        console.error("未配置 WebDAV，请先设置 WebDAV 信息！");
        sendResponse({ error: "未配置 WebDAV" });
        return;
    }

    const FILE_PATH = "PWsync/pw.xls"; // WebDAV 中的文件路径

    if (request.action === 'getData') {
        // 读取 WebDAV 文件
        const fileContent = await readWebDAVFile(url, username, password, FILE_PATH);
        if (fileContent) {
            // 解析表格文件内容（假设是 Excel 文件）
            const workbook = XLSX.read(fileContent, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet); // 将表格数据转换为 JSON
            sendResponse({ data });
        } else {
            sendResponse({ data: [] });
        }
    } else if (request.action === 'saveData') {
        // 将数据保存到 WebDAV 文件
        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(request.data);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
        const fileContent = XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
        const success = await updateWebDAVFile(url, username, password, FILE_PATH, fileContent);
        sendResponse({ success });
    } else if (request.action === 'test') {
        console.log("a", axios);
        console.log("b", XLSX);
        sendResponse({ status: "success" });
    }
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
        console.error("读取文件失败：", error.response ? .status || error.message);
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
        console.error("更新文件失败：", error.response ? .status || error.message);
        return false;
    }
}