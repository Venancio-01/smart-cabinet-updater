import { fileURLToPath } from "node:url";
import { checkPathExists } from "./utils/file.js";
import { handleAccessDoorUpdate, handleCabinetServerUpdate, handleSmartCabinetUpdate } from "./services/cabinetServer.js";
import { log } from "./utils/console.js";
import { backendFolderPath, cabinetFolderPath, doorFolderPath, backgroundFolderPath } from "./utils/config.js";

function keepRunning(): void {
  log.info("按下 ESC 或 Ctrl + C 退出程序");

  // 设置原始模式以捕获按键
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  // 监听按键事件
  process.stdin.on("data", (key: Buffer | string) => {
    // Ctrl+C 的 ASCII 码是 03
    if (key === "\u0003" || key === "\u001b") {
      log.success("\n程序已退出");
      process.exit();
    }
  });
}

async function main(): Promise<void> {
  try {
    const updateOptions: string[] = [];

    // 检查文件夹是否存在并生成选项
    if (checkPathExists(backendFolderPath)) {
      updateOptions.push("1. 更新后台程序");
    }
    if (checkPathExists(cabinetFolderPath)) {
      updateOptions.push("2. 更新载体柜程序");
    }
    if (checkPathExists(doorFolderPath)) {
      updateOptions.push("3. 更新通道门程序");
    }
    if (checkPathExists(backgroundFolderPath)) {
      updateOptions.push("4. 替换载体柜程序背景图片");
    }

    if (updateOptions.length === 0) {
      log.info("未检测到任何更新文件");
      keepRunning();
      return;
    }

    // 显示菜单
    log.info("检测到以下可用更新：");
    updateOptions.forEach(option => log.info(option));
    log.info("\n请输入数字选择要执行的操作：");

    // 设置原始模式以捕获按键
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // 监听用户输入
    const dataHandler = async (key: Buffer | string) => {
      const input = String(key).trim();

      switch (input) {
        case "1":
          if (updateOptions.some(opt => opt.startsWith("1."))) {
            process.stdin.setRawMode(false);
            process.stdin.removeListener("data", dataHandler);
            await handleCabinetServerUpdate();
            process.exit(0);
          }
          break;
        case "2":
          if (updateOptions.some(opt => opt.startsWith("2."))) {
            process.stdin.setRawMode(false);
            process.stdin.removeListener("data", dataHandler);
            await handleSmartCabinetUpdate();
            process.exit(0);
          }
          break;
        case "3":
          if (updateOptions.some(opt => opt.startsWith("3."))) {
            process.stdin.setRawMode(false);
            process.stdin.removeListener("data", dataHandler);
            await handleAccessDoorUpdate();
            process.exit(0);
          }
          break;
        case "4":
          if (updateOptions.some(opt => opt.startsWith("4."))) {
            process.stdin.setRawMode(false);
            process.stdin.removeListener("data", dataHandler);
            // TODO: 实现背景图片替换功能
            log.info("背景图片替换功能待实现");
            process.exit(0);
          }
          break;
        case "\u0003": // Ctrl+C
        case "\u001b": // ESC
          log.success("\n程序已退出");
          process.exit(0);
          break;
      }
    };

    process.stdin.on("data", dataHandler);
    keepRunning();
  } catch (error) {
    log.error(`执行出错: ${error}`);
    process.exit(1);
  }
}

// 启动程序
main();
