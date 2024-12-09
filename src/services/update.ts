import { join } from "path";
import { backendFolderPath, cabinetFolderPath, cabinetSSHConfig, doorFolderPath, serverSSHConfig } from "../utils/config.js";
import { uploadPath, executeSSHCommand, uploadFile } from "../utils/ssh.js";
import { readdirSync, statSync } from "fs";
import { getUserInput } from "../utils/input.js";
import { log } from "../utils/console.js";

// 处理延时
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 处理载体柜服务更新
export async function handleCabinetServerUpdate(): Promise<void> {
  log.info("开始更新后台服务...");
  try {
    const sudoPassword = await getUserInput("请输入管理员密码: ");

    // 1. 上传更新文件夹
    // 读取后台更新文件夹下的所有文件
    const files = readdirSync(backendFolderPath);
    // 找到第一个文件夹
    const firstFolder = files.find(file => statSync(join(backendFolderPath, file)).isDirectory());
    if (!firstFolder) {
      throw new Error("未找到后台更新文件夹");
    }
    const localPath = join(backendFolderPath, firstFolder);
    await uploadPath(localPath, serverSSHConfig, sudoPassword);
    log.success("更新文件上传完成");

    // 2. 停止服务
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl stop Cabinet.service`, serverSSHConfig, sudoPassword);
    log.success("Cabinet 服务已停止");

    // 3. 覆盖文件
    const updateCommand = `echo "${sudoPassword}" | sudo -S cp -rf ${serverSSHConfig.remotePath}/* /opt/hjrich/cabinet-server/`;
    await executeSSHCommand(updateCommand, serverSSHConfig, sudoPassword);
    log.success("文件覆盖完成");

    // 4. 启动服务
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl start Cabinet.service`, serverSSHConfig, sudoPassword);
    log.success("Cabinet 服务已启动");

    // 5. 延时后检查服务状态
    await delay(5000); // 等待 5 秒
    const serviceStatus = await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl is-active Cabinet.service`, serverSSHConfig, sudoPassword);

    // 6. 输出更新结果
    if (serviceStatus.slice(4).trim() === "active") {
      log.success("更新成功：Cabinet 服务运行正常");
    } else {
      throw new Error("更新失败：Cabinet 服务未正常运行");
    }

    // 7. 删除更新文件
    await executeSSHCommand(`rm -rf ${serverSSHConfig.remotePath}`, serverSSHConfig, sudoPassword);
    log.success("更新文件已删除");
  } catch (error) {
    log.error("更新过程出错" + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

export async function handleSmartCabinetUpdate(): Promise<void> {
  log.info("开始更新载体柜程序...");
  try {
    // 1. 查找并上传载体柜更新文件
    const smartCabinetPattern = /^smart_cabinet_\d+\.\d+\.\d+\.deb$/;
    const files = readdirSync(cabinetFolderPath);
    const smartCabinetUpdateFile = files.find(file => smartCabinetPattern.test(file));

    if (!smartCabinetUpdateFile) {
      throw new Error("未找到载体柜更新文件");
    }

    const sudoPassword = await getUserInput("请输入管理员密码: ");

    const localPath = join(cabinetFolderPath, smartCabinetUpdateFile);
    await uploadFile(localPath, cabinetSSHConfig, sudoPassword);
    log.success("更新文件上传完成");

    // 2. 执行更新命令
    await executeSSHCommand(`cd ${cabinetSSHConfig.remotePath} && echo "${sudoPassword}" | sudo -S dpkg -i ${smartCabinetUpdateFile}`, cabinetSSHConfig, sudoPassword);
    log.success("载体柜更新完成");

    // 3. 删除更新文件
    await executeSSHCommand(`rm -rf ${cabinetSSHConfig.remotePath}${smartCabinetUpdateFile}`, cabinetSSHConfig, sudoPassword);
    log.success("更新文件已删除");

    // 4.延时重启电脑（2秒后）
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S bash -c "sleep 2 && reboot"`, cabinetSSHConfig, sudoPassword);
    log.success("电脑将在 2 秒后重启");
  } catch (error) {
    log.error("更新过程出错" + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

export async function handleAccessDoorUpdate(): Promise<void> {
  log.info("开始更新通道门程序...");
  try {
    // 1. 查找并上传通道门更新文件
    const accessDoorPattern = /^access_door_\d+\.\d+\.\d+\.deb$/;
    const files = readdirSync(doorFolderPath);
    const accessDoorUpdateFile = files.find(file => accessDoorPattern.test(file));

    if (!accessDoorUpdateFile) {
      throw new Error("未找到通道门更新文件");
    }

    const sudoPassword = await getUserInput("请输入管理员密码: ");

    const localPath = join(doorFolderPath, accessDoorUpdateFile);
    await uploadFile(localPath, cabinetSSHConfig, sudoPassword);
    log.success("更新文件上传完成");

    // 2. 执行更新命令
    await executeSSHCommand(`cd ${cabinetSSHConfig.remotePath} && echo "${sudoPassword}" | sudo -S dpkg -i ${accessDoorUpdateFile}`, cabinetSSHConfig, sudoPassword);
    log.success("通道门更新完成");

    // 3. 删除更新文件
    await executeSSHCommand(`rm -rf ${cabinetSSHConfig.remotePath}${accessDoorUpdateFile}`, cabinetSSHConfig, sudoPassword);
    log.success("更新文件已删除");

    // 4.延时重启电脑（2秒后）
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S bash -c "sleep 2 && reboot"`, cabinetSSHConfig, sudoPassword);
    log.success("电脑将在 2 秒后重启");
  } catch (error) {
    log.error("更新过程出错" + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}
