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