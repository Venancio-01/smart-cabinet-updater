import SftpClient from "ssh2-sftp-client";
import { Client } from "ssh2";
import { SSHConfig } from "./types";
import { getUserInput } from "./input";
import { log } from "./console";
import { calculateDirMD5, calculateFileMD5 } from "./md5";
import * as fs from "fs";
import * as os from "os";
import path from "path";

// 存储 SSH 连接
const sshConnections: Map<string, { client: Client; password: string }> = new Map();

export async function uploadFile(localPath: string, config: SSHConfig, password: string): Promise<void> {
  const { host, uploadPath, port } = config;
  const sftp = new SftpClient();

  try {
    log.info(`正在上传 ${localPath} 到 ${host}:${uploadPath}`);

    await sftp.connect({
      host: host.split("@")[1],
      port: port,
      username: host.split("@")[0],
      password,
      readyTimeout: 10000,
      retries: 3,
    });

    // 获取文件名
    const fileName = path.basename(localPath);
    const remoteFilePath = `${uploadPath}/${fileName}`;

    // 确保远程目录存在
    try {
      await sftp.mkdir(uploadPath, true);
    } catch (mkdirError) {
      log.warning(`创建远程目录失败: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
    }

    // 计算本地文件MD5
    const localMD5 = await calculateFileMD5(localPath);

    // 使用二进制模式上传文件
    await sftp.put(localPath, remoteFilePath, {
      writeStreamOptions: {
        encoding:null,
        mode: 0o666
      }
    });

    // 下载文件进行MD5校验
    const tempLocalPath = path.join(os.tmpdir(), `verify_${fileName}`);
    try {
      await sftp.get(remoteFilePath, tempLocalPath);
      const remoteMD5 = await calculateFileMD5(tempLocalPath);

      if (localMD5 !== remoteMD5) {
        throw new Error(`文件 ${fileName} MD5校验失败`);
      }

      log.success("上传成功且文件完整性验证通过");
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempLocalPath)) {
        fs.unlinkSync(tempLocalPath);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`上传失败: ${errorMessage}`);
    throw new Error(`上传失败: ${errorMessage}`);
  } finally {
    try {
      await sftp.end();
    } catch (closeError) {
      log.warning(`关闭连接失败: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
    }
  }
}

export async function uploadPath(localPath: string, config: SSHConfig, password: string): Promise<void> {
  const { host, uploadPath, port } = config;
  const sftp = new SftpClient();

  try {
    log.info(`正在上传 ${localPath} 到 ${host}:${uploadPath}`);

    // 计算本地文件的MD5
    const localMD5Map = await calculateDirMD5(localPath);

    await sftp.connect({
      host: host.split("@")[1],
      port: port,
      username: host.split("@")[0],
      password,
      readyTimeout: 10000,
      retries: 3,
    });

    try {
      await sftp.mkdir(uploadPath, true);
    } catch (mkdirError) {
      log.warning(`创建远程目录失败: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
    }

    // 上传文件
    await sftp.uploadDir(localPath, uploadPath);

    // 验证远程文件MD5
    log.info("正在验证文件完整性...");
    for (const [fileName, md5] of Object.entries(localMD5Map)) {
      const remoteFilePath = `${uploadPath}/${fileName}`;
      // 使用操作系统临时目录;
      const tempLocalPath = path.join(os.tmpdir(), fileName);

      // 下载远程文件用于校验
      await sftp.get(remoteFilePath, tempLocalPath);
      const remoteMD5 = await calculateFileMD5(tempLocalPath);

      if (md5 !== remoteMD5) {
        throw new Error(`文件 ${fileName} MD5校验失败`);
      }

      // 清理临时文件
      fs.unlinkSync(tempLocalPath);
    }

    log.success("上传成功且文件完整性验证通过");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`上传失败: ${errorMessage}`);
    throw new Error(`上传失败: ${errorMessage}`);
  } finally {
    try {
      await sftp.end();
    } catch (closeError) {
      log.warning(`关闭连接失败: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
    }
  }
}

// 获取或创建 SSH 连接
async function getSSHConnection(config: SSHConfig): Promise<{ client: Client; password: string }> {
  const key = `${config.host}:${config.port}`;
  if (!sshConnections.has(key)) {
    const client = new Client();
    const password = await getUserInput("请输入SSH密码: ");

    await new Promise<void>((resolve, reject) => {
      client.on("ready", () => resolve());
      client.on("error", (err: any) => reject(err));

      client.connect({
        host: config.host.split("@")[1],
        port: config.port,
        username: config.host.split("@")[0],
        password: password,
      });
    });

    sshConnections.set(key, { client, password });
  }

  return sshConnections.get(key)!;
}

export async function executeSSHCommand(command: string, config: SSHConfig, password: string): Promise<string> {
  const { host, port } = config;
  const client = new Client();

  return new Promise(async (resolve, reject) => {
    try {
      log.info(`在 ${host} 执行命令: ${command}`);

      client.connect({
        host: host.split("@")[1],
        port: port,
        username: host.split("@")[0],
        password,
      });

      client.on("ready", () => {
        // 使用伪终端执行命令
        client.exec(command, { pty: true }, (err, stream) => {
          if (err) {
            client.end();
            reject(new Error(`SSH 执行错误: ${err.message}`));
            return;
          }

          let output = "";
          let errorOutput = "";

          stream.on("data", (data: Buffer) => {
            output += data.toString();
          });

          stream.stderr.on("data", (data: Buffer) => {
            errorOutput += data.toString();
          });

          stream.on("close", (code: number) => {
            client.end();
            if (code === 0) {
              resolve(output);
            } else {
              reject(new Error(`命令执行失败，退出码: ${code}\n错误信息: ${errorOutput}`));
            }
          });
        });
      });

      client.on("error", err => {
        client.end();
        reject(new Error(`SSH 连接错误: ${err.message}`));
      });
    } catch (error) {
      client.end();
      reject(error);
    }
  });
}

// 清理连接
process.on("exit", () => {
  for (const { client } of sshConnections.values()) {
    client.end();
  }
});
