import SftpClient from "ssh2-sftp-client";
import { Client } from "ssh2";
import { SSHConfig } from "./types";
import { getUserInput } from "./input";

// 存储 SSH 连接
const sshConnections: Map<string, { client: Client; password: string }> = new Map();

export async function uploadPath(localPath: string, config: SSHConfig,password:string): Promise<void> {
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
  } catch (error) {
    throw new Error(`上传失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await sftp.end();
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
