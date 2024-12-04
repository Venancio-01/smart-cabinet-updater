'use strict';

var node_path = require('node:path');
var node_url = require('node:url');
var node_fs = require('node:fs');
var node_readline = require('node:readline');
var SftpClient = require('ssh2-sftp-client');
var ssh2 = require('ssh2');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
// 检查路径是否存在
function checkPathExists(targetPath, type = 'all') {
    try {
        if (targetPath instanceof RegExp) {
            // 如果是正则表达式，则在当前目录查找匹配的文件
            const files = node_fs.readdirSync(process.cwd());
            return files.some(file => {
                if (targetPath.test(file)) {
                    const fullPath = `${process.cwd()}/${file}`;
                    const stats = node_fs.statSync(fullPath);
                    switch (type.toLowerCase()) {
                        case 'file':
                            return stats.isFile();
                        case 'directory':
                            return stats.isDirectory();
                        default:
                            return true;
                    }
                }
                return false;
            });
        }
        else {
            // 原有的直接路径检查逻辑
            if (!node_fs.existsSync(targetPath)) {
                return false;
            }
            const stats = node_fs.statSync(targetPath);
            switch (type.toLowerCase()) {
                case 'file':
                    return stats.isFile();
                case 'directory':
                    return stats.isDirectory();
                default:
                    return true;
            }
        }
    }
    catch (error) {
        console.error(`检查路径出错: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

// 获取用户输入
async function getUserInput(prompt) {
    const rl = node_readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    try {
        return await new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                resolve(answer);
            });
        });
    }
    finally {
        rl.close();
    }
}
// 获取用户确认
async function getUserConfirmation(prompt) {
    const rl = node_readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    try {
        const answer = await new Promise((resolve) => {
            rl.question(`${prompt} (Y/N): `, (answer) => {
                resolve(answer.trim().toUpperCase());
            });
        });
        return answer === 'Y';
    }
    finally {
        rl.close();
    }
}

// SSH 配置
const cabinetSSHConfig = {
    host: 'qingshan@172.30.35.203',
    port: 2222,
    remotePath: '/home/qingshan/'
};
// 服务器 SSH 配置
const serverSSHConfig = {
    host: 'root@192.168.1.50',
    port: 22,
    remotePath: '/opt/hjrich/smart-cabinet/cabinet-server-update'
};

// 存储 SSH 连接
const sshConnections = new Map();
async function uploadPath(localPath, config, password) {
    const { host, remotePath, port } = config;
    console.log(`正在上传 ${localPath} 到 ${host}:${remotePath}`);
    const sftp = new SftpClient();
    try {
        await sftp.connect({
            host: host.split("@")[1], // 提取主机地址
            port: port,
            username: host.split("@")[0], // 提取用户名
            password,
        });
        await sftp.uploadDir(localPath, remotePath);
        console.log("上传成功");
    }
    catch (error) {
        throw new Error(`上传失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        await sftp.end();
    }
}
// 获取或创建 SSH 连接
async function getSSHConnection(config) {
    const key = `${config.host}:${config.port}`;
    if (!sshConnections.has(key)) {
        const client = new ssh2.Client();
        const password = await getUserInput("请输入SSH密码: ");
        await new Promise((resolve, reject) => {
            client.on("ready", () => resolve());
            client.on("error", (err) => reject(err));
            client.connect({
                host: config.host.split("@")[1],
                port: config.port,
                username: config.host.split("@")[0],
                password: password,
            });
        });
        sshConnections.set(key, { client, password });
    }
    return sshConnections.get(key);
}
async function executeSSHCommand(command, config) {
    console.log(`在 ${config.host} 执行命令: ${command}`);
    try {
        const { client, password } = await getSSHConnection(config);
        return new Promise((resolve, reject) => {
            client.exec(command, (err, stream) => {
                if (err) {
                    reject(new Error(`命令执行失败: ${err.message}`));
                    return;
                }
                let output = "";
                let errorOutput = "";
                stream.on("data", (data) => {
                    output += data.toString();
                });
                stream.stderr.on("data", (data) => {
                    errorOutput += data.toString();
                });
                stream.on("close", (code) => {
                    if (code === 0) {
                        console.log("命令执行成功");
                        resolve(output);
                    }
                    else {
                        reject(new Error(`命令执行失败，退出码: ${code}\n错误信息: ${errorOutput}`));
                    }
                });
            });
        });
    }
    catch (error) {
        throw new Error(`命令执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// 清理连接
process.on("exit", () => {
    for (const { client } of sshConnections.values()) {
        client.end();
    }
});

// 处理延时
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// 处理载体柜服务更新
async function handleCabinetServerUpdate() {
    console.log("开始更新后台服务...");
    try {
        const sudoPassword = await getUserInput("请输入管理员密码: ");
        // 1. 上传更新文件夹
        const localPath = node_path.join(process.cwd(), "cabinet-server-update");
        await uploadPath(localPath, serverSSHConfig, sudoPassword);
        console.log("更新文件上传完成");
        // 2. 停止服务
        await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl stop Cabinet.service`, serverSSHConfig);
        console.log("Cabinet 服务已停止");
        // 3. 覆盖文件
        const updateCommand = `echo "${sudoPassword}" | sudo -S cp -rf ${serverSSHConfig.remotePath}/* /home/liqingshan/smart-cabinet/cabinet-server/`;
        await executeSSHCommand(updateCommand, serverSSHConfig);
        console.log("文件覆盖完成");
        // 4. 启动服务
        await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl start Cabinet.service`, serverSSHConfig);
        console.log("Cabinet 服务已启动");
        // 5. 延时后检查服务状态
        await delay(5000); // 等待 5 秒
        const serviceStatus = await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl status Cabinet.service`, serverSSHConfig);
        // 6. 输出更新结果
        if (serviceStatus.includes("active (running)")) {
            console.log("更新成功：Cabinet 服务运行正常");
        }
        else {
            throw new Error("更新失败：Cabinet 服务未正常运行");
        }
    }
    catch (error) {
        console.error("更新过程出错:", error instanceof Error ? error.message : String(error));
        throw error;
    }
}
async function handleSmartCabinetUpdate() {
    console.log("开始更新载体柜程序...");
    try {
        // 1. 查找并上传载体柜更新文件
        const smartCabinetPattern = /^smart_cabinet_\d+\.\d+\.\d+\.deb$/;
        const files = node_fs.readdirSync(process.cwd());
        const smartCabinetUpdateFile = files.find(file => smartCabinetPattern.test(file));
        if (!smartCabinetUpdateFile) {
            throw new Error("未找到载体柜更新文件");
        }
        const sudoPassword = await getUserInput("请输入 sudo 密码: ");
        const localPath = node_path.join(process.cwd(), smartCabinetUpdateFile);
        await uploadPath(localPath, cabinetSSHConfig, sudoPassword);
        console.log("更新文件上传完成");
        // 2. 执行更新命令
        await executeSSHCommand(`cd ${cabinetSSHConfig.remotePath} && echo "${sudoPassword}" | sudo dpkg -i ${smartCabinetUpdateFile}`, cabinetSSHConfig);
        console.log("载体柜更新完成");
        // 3. 检查更新结果
        const checkCommand = `dpkg-query -W -f='\${Version}' smart-cabinet`;
        const version = await executeSSHCommand(checkCommand, cabinetSSHConfig);
        // 从更新文件名中提取版本号
        const updateVersion = smartCabinetUpdateFile.match(/smart_cabinet_(\d+\.\d+\.\d+)\.deb/)?.[1];
        if (!updateVersion) {
            throw new Error("无法从文件名解析版本号");
        }
        // 比较版本号
        if (version.trim() === updateVersion) {
            console.log(`更新成功：当前版本为 ${version.trim()}`);
        }
        else {
            throw new Error(`更新失败：当前版本(${version.trim()})与更新版本(${updateVersion})不一致`);
        }
        // 4. 删除更新文件
        await executeSSHCommand(`rm -rf ${cabinetSSHConfig.remotePath}${smartCabinetUpdateFile}`, cabinetSSHConfig);
        console.log("更新文件已删除");
    }
    catch (error) {
        console.error("更新过程出错:", error instanceof Error ? error.message : String(error));
        throw error;
    }
}
async function handleAccessDoorUpdate() {
    console.log("开始更新通道门程序...");
    try {
        const sudoPassword = await getUserInput("请输入 sudo 密码: ");
        // 1. 检查并关闭通道门程序
        console.log("正在检查通道门程序状态...");
        const checkProcessCommand = "ps -ef | grep access-door | grep -v grep || true";
        const processOutput = await executeSSHCommand(checkProcessCommand, cabinetSSHConfig);
        if (processOutput.trim()) {
            console.log("检测到通道门程序正在运行，准备关闭...");
            await executeSSHCommand(`echo "${sudoPassword}" | sudo systemctl stop access-door`, cabinetSSHConfig);
            console.log("通道门程序已关闭");
        }
        else {
            console.log("通道门程序未运行");
        }
        // 2. 查找并上传通道门更新文件
        const accessDoorPattern = /^access_door_\d+\.\d+\.\d+\.deb$/;
        const files = node_fs.readdirSync(process.cwd());
        const accessDoorUpdateFile = files.find(file => accessDoorPattern.test(file));
        if (!accessDoorUpdateFile) {
            throw new Error("未找到通道门更新文件");
        }
        const localPath = node_path.join(process.cwd(), accessDoorUpdateFile);
        await uploadPath(localPath, cabinetSSHConfig, sudoPassword);
        console.log("更新文件上传完成");
        // 3. 执行更新命令
        await executeSSHCommand(`cd ${cabinetSSHConfig.remotePath} && echo "${sudoPassword}" | sudo dpkg -i ${accessDoorUpdateFile}`, cabinetSSHConfig);
        console.log("通道门更新完成");
        // 4. 检查更新结果
        const checkCommand = `dpkg-query -W -f='\${Version}' access-door`;
        const version = await executeSSHCommand(checkCommand, cabinetSSHConfig);
        // 从更新文件名中提取版本号
        const updateVersion = accessDoorUpdateFile.match(/access_door_(\d+\.\d+\.\d+)\.deb/)?.[1];
        if (!updateVersion) {
            throw new Error("无法从文件名解析版本号");
        }
        // 比较版本号
        if (version.trim() === updateVersion) {
            console.log(`通道门程序更新成功：当前版本为 ${version.trim()}`);
        }
        else {
            throw new Error(`更新失败：当前版本(${version.trim()})与更新版本(${updateVersion})不一致`);
        }
        // 5. 删除更新文件
        await executeSSHCommand(`rm -rf ${cabinetSSHConfig.remotePath}${accessDoorUpdateFile}`, cabinetSSHConfig);
        console.log("更新文件已删除");
    }
    catch (error) {
        console.error("更新过程出错:", error instanceof Error ? error.message : String(error));
        throw error;
    }
}

node_url.fileURLToPath(new URL('.', (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('bundle.js', document.baseURI).href))));
function keepRunning() {
    console.log('按下 ESC 或 Ctrl + C 退出程序');
    // 设置原始模式以捕获按键
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    // 监听按键事件
    process.stdin.on('data', (key) => {
        // Ctrl+C 的 ASCII 码是 03
        if (key === '\u0003' || key === '\u001b') {
            console.log('\n程序已退出');
            process.exit();
        }
    });
}
async function main() {
    try {
        let hasUpdates = false;
        // 检查 cabinet-server-update 文件夹是否存在
        const cabinetServerPath = node_path.join(process.cwd(), 'cabinet-server-update');
        if (checkPathExists(cabinetServerPath, 'directory')) {
            hasUpdates = true;
            console.log('检测到后台服务更新文件夹');
            const shouldUpdate = await getUserConfirmation('是否进行更新？');
            if (shouldUpdate) {
                console.log('开始执行更新...');
                await handleCabinetServerUpdate();
            }
            else {
                console.log('已取消更新');
            }
        }
        // 检查载体柜安装包
        const smartCabinetPattern = /^smart_cabinet_\d+\.\d+\.\d+\.deb$/;
        if (checkPathExists(smartCabinetPattern, 'file')) {
            hasUpdates = true;
            console.log('检测到载体柜更新文件');
            const shouldUpdate = await getUserConfirmation('是否进行更新？');
            if (shouldUpdate) {
                console.log('开始执行更新...');
                handleSmartCabinetUpdate();
            }
            else {
                console.log('已取消更新');
            }
        }
        // 检查通道门安装包
        const accessDoorPattern = /^access_door_\d+\.\d+\.\d+\.deb$/;
        if (checkPathExists(accessDoorPattern, 'file')) {
            hasUpdates = true;
            console.log('检测到通道门更新文件');
            const shouldUpdate = await getUserConfirmation('是否进行更新？');
            if (shouldUpdate) {
                console.log('开始执行更新...');
                handleAccessDoorUpdate();
            }
            else {
                console.log('已取消更新');
            }
        }
        if (!hasUpdates) {
            console.log('未检测到更新文件');
        }
        keepRunning();
    }
    catch (error) {
        console.error('执行出错:', error);
    }
}
// 启动程序
main();
