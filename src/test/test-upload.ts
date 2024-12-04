import { getUserInput } from "../utils/input";
import { uploadPath } from "../utils/ssh";
import { SSHConfig } from "../utils/types";
import * as path from "path";

async function testUpload() {
  // 测试配置
  const config: SSHConfig = {
    host: "liqingshan@192.168.70.130", // 替换为实际的 SSH 主机地址
    port: 22,
    remotePath: "/home/liqingshan/smart-cabinet/cabinet-server-update", // 替换为实际的远程目录路径
  };

  // 本地测试目录
  const localPath = path.join(process.cwd(), "cabinet-server-update");

  try {
    const sudoPassword = await getUserInput("请输入 sudo 密码: ");
    await uploadPath(localPath, config, sudoPassword);
    console.log("测试成功完成");
  } catch (error) {
    console.error("测试失败:", error);
  }
}

// 运行测试
testUpload().catch(console.error);
