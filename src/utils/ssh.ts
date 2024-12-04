import SftpClient from "ssh2-sftp-client";
import { Client } from "ssh2";
import { SSHConfig } from "./types";
import { getUserInput } from "./input";
import { log } from "./console";

// 存储 SSH 连接
const sshConnections: Map<string, { client: Client; password: string }> = new Map();

export async function uploadPath(localPath: string, config: SSHConfig, password: string): Promise<void> {
  const { host, remotePath, port } = config;
  const sftp = new SftpClient();
  
  try {
    log.info(`正在上传 ${localPath} 到 ${host}:${remotePath}`);
    
    await sftp.connect({
      host: host.split("@")[1],
      port: port,
      username: host.split("@")[0],
      password,
      readyTimeout: 10000, // 增加超时时间
      retries: 3, // 添加重试次数
    });

    // 检查远程目录是否存在
    try {
      await sftp.mkdir(remotePath, true);
    } catch (mkdirError) {
      log.warning(`创建远程目录失败: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
    }

    await sftp.uploadDir(localPath, remotePath);
    log.success("上传成功");
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

export async function executeSSHCommand(command: string, config: SSHConfig): Promise<string> {
  console.log(`在 ${config.host} 执行命令: ${command}`);

  try {
    const { client, password } = await getSSHConnection(config);

    return new Promise((resolve, reject) => {
      client.exec(command, (err: any, stream: any) => {
        if (err) {
          reject(new Error(`命令执行失败: ${err.message}`));
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
          if (code === 0) {
            console.log("命令执行成功");
            resolve(output);
          } else {
            reject(new Error(`命令执行失败，退出码: ${code}\n错误信息: ${errorOutput}`));
          }
        });
      });
    });
  } catch (error) {
    throw new Error(`命令执行失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 清理连接
process.on("exit", () => {
  for (const { client } of sshConnections.values()) {
    client.end();
  }
});
