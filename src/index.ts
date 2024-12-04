import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPathExists } from './utils/file.js';
import { getUserConfirmation } from './utils/input.js';
import { handleAccessDoorUpdate, handleCabinetServerUpdate, handleSmartCabinetUpdate } from './services/cabinetServer.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function keepRunning(): void {
    console.log('按下 ESC 或 Ctrl + C 退出程序');
    
    // 设置原始模式以捕获按键
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // 监听按键事件
    process.stdin.on('data', (key: Buffer | string) => {
        // Ctrl+C 的 ASCII 码是 03
        if (key === '\u0003' || key === '\u001b') {
            console.log('\n程序已退出');
            process.exit();
        }
    });
}

async function main(): Promise<void> {
    try {
        let hasUpdates = false;

        // 检查 cabinet-server-update 文件夹是否存在
        const cabinetServerPath = join(process.cwd(), 'cabinet-server-update');
        if (checkPathExists(cabinetServerPath, 'directory')) {
            hasUpdates = true;
            console.log('检测到后台服务更新文件夹');
            const shouldUpdate = await getUserConfirmation('是否进行更新？');
            if (shouldUpdate) {
                console.log('开始执行更新...');
                await handleCabinetServerUpdate();
            } else {
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
            } else {
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
            } else {
                console.log('已取消更新');
            }
        }

        if (!hasUpdates) {
            console.log('未检测到更新文件');
        }

        keepRunning();
    } catch (error) {
        console.error('执行出错:', error);
    }
}

// 启动程序
main();
