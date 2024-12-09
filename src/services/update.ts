import { join } from "node:path";
import { cabinetSSHConfig, serverSSHConfig } from "../utils/config.js";
import { uploadPath, executeSSHCommand } from "../utils/ssh.js";
import { readdirSync } from "node:fs";
import { getUserInput } from "../utils/input.js";
import { log } from '../utils/console.js';

// 处理延时
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 处理载体柜服务更新
export async function handleCabinetServerUpdate(): Promise<void> {
  log.info("开始更新后台服务...");
  try {
    const sudoPassword = await getUserInput("请输入管理员密码: ");

    // 1. 上传更新文件夹
    const localPath = join(process.cwd(), "cabinet-server-update");
    await uploadPath(localPath, serverSSHConfig, sudoPassword);
    log.success("更新文件上传完成");

    // 2. 停止服务
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl stop Cabinet.service`, serverSSHConfig);
    log.success("Cabinet 服务已停止");

    // 3. 覆盖文件
    const updateCommand = `echo "${sudoPassword}" | sudo -S cp -rf ${serverSSHConfig.remotePath}/* /home/liqingshan/smart-cabinet/cabinet-server/`;
    await executeSSHCommand(updateCommand, serverSSHConfig);
    log.success("文件覆盖完成");

    // 4. 启动服务
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl start Cabinet.service`, serverSSHConfig);
    log.success("Cabinet 服务已启动");

    // 5. 延时后检查服务状态
    await delay(5000); // 等待 5 秒
    const serviceStatus = await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl status Cabinet.service`, serverSSHConfig);

    // 6. 输出更新结果
    if (serviceStatus.includes("active (running)")) {
      log.success("更新成功：Cabinet 服务运行正常");
    } else {
      throw new Error("更新失败：Cabinet 服务未正常运行");
    }
  } catch (error) {
    log.error("更新过程出错" + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

// 处理载体柜程序更新
export async function handleSmartCabinetUpdate(): Promise<void> {
  log.info("开始更新载体柜程序...");
  try {
    // 1. 查找并上传载体柜更新文件
    const smartCabinetPattern = /^smart_cabinet_\d+\.\d+\.\d+\.deb$/;
    const files = readdirSync(process.cwd());
    const smartCabinetUpdateFile = files.find(file => smartCabinetPattern.test(file));

    if (!smartCabinetUpdateFile) {
      throw new Error("未找到载体柜更新文件");
    }

    const sudoPassword = await getUserInput("请输入 sudo 密码: ");

    const localPath = join(process.cwd(), smartCabinetUpdateFile);
    await uploadPath(localPath, cabinetSSHConfig, sudoPassword);
    log.success("更新文件上传完成");

    // 2. 执行更新命令
    await executeSSHCommand(`cd ${cabinetSSHConfig.remotePath} && echo "${sudoPassword}" | sudo dpkg -i ${smartCabinetUpdateFile}`, cabinetSSHConfig);
    log.success("载体柜更新完成");

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
      log.success(`更新成功：当前版本为 ${version.trim()}`);
    } else {
      throw new Error(`更新失败：当前版本(${version.trim()})与更新版本(${updateVersion})不一致`);
    }

    // 4. 删除更新文件
    await executeSSHCommand(`rm -rf ${cabinetSSHConfig.remotePath}${smartCabinetUpdateFile}`, cabinetSSHConfig);
    log.success("更新文件已删除");
  } catch (error) {
    log.error("更新过程出错" + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

// 处理通道门程序更新
export async function handleAccessDoorUpdate(): Promise<void> {
  log.info("开始更新通道门程序...");
  try {
    const sudoPassword = await getUserInput("请输入 sudo 密码: ");
    // 1. 检查并关闭通道门程序
    log.info("正在检查通道门程序状态...");
    const checkProcessCommand = "ps -ef | grep access-door | grep -v grep || true";
    const processOutput = await executeSSHCommand(checkProcessCommand, cabinetSSHConfig);

    if (processOutput.trim()) {
      log.warning("检测到通道门程序正在运行，准备关闭...");
      await executeSSHCommand(`echo "${sudoPassword}" | sudo systemctl stop access-door`, cabinetSSHConfig);
      log.success("通道门程序已关闭");
    } else {
      log.info("通道门程序未运行");
    }

    // 2. 查找并上传通道门更新文件
    const accessDoorPattern = /^access_door_\d+\.\d+\.\d+\.deb$/;
    const files = readdirSync(process.cwd());
    const accessDoorUpdateFile = files.find(file => accessDoorPattern.test(file));

    if (!accessDoorUpdateFile) {
      throw new Error("未找到通道门更新文件");
    }

    const localPath = join(process.cwd(), accessDoorUpdateFile);
    await uploadPath(localPath, cabinetSSHConfig, sudoPassword);
    log.success("更新文件上传完成");

    // 3. 执行更新命令
    await executeSSHCommand(`cd ${cabinetSSHConfig.remotePath} && echo "${sudoPassword}" | sudo dpkg -i ${accessDoorUpdateFile}`, cabinetSSHConfig);
    log.success("通道门程序更新完成");

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
      log.success(`通道门程序更新成功：当前版本为 ${version.trim()}`);
    } else {
      throw new Error(`更新失败：当前版本(${version.trim()})与更新版本(${updateVersion})不一致`);
    }

    // 5. 删除更新文件
    await executeSSHCommand(`rm -rf ${cabinetSSHConfig.remotePath}${accessDoorUpdateFile}`, cabinetSSHConfig);
    log.success("更新文件已删除");
  } catch (error) {
    log.error("更新过程出错" + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}
