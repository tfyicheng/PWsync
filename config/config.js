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

// 导入按钮点击事件
document.getElementById("import-btn").addEventListener("click", async() => {
    const fileInput = document.getElementById("import-file");
    if (fileInput.files.length === 0) {
        alert("请选择 CSV 文件。");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async(event) => {
        const csvData = event.target.result;

        // 提示用户选择覆盖还是追加
        const action = confirm("是否覆盖现有数据？\n点击“确定”覆盖，点击“取消”追加。") ?
            "overwrite" :
            "append";

        // 向后台脚本发送导入请求
        chrome.runtime.sendMessage({
                action: "importCSV",
                data: csvData,
                mode: action,
            },
            (response) => {
                if (response.status === "success") {
                    alert("导入成功！");
                } else {
                    alert("导入失败：" + response.error);
                }
            }
        );
    };

    reader.readAsText(file);
});

// 导出按钮点击事件
document.getElementById("export-btn").addEventListener("click", async() => {
    const filename = document.getElementById("export-filename").value;
    if (!filename) {
        alert("请输入文件名。");
        return;
    }

    // 向后台脚本发送导出请求
    chrome.runtime.sendMessage({
            action: "exportCSV",
            filename: filename,
        },
        (response) => {
            if (response.status === "success") {
                alert("导出成功！");
            } else {
                alert("导出失败：" + response.error);
            }
        }
    );
});