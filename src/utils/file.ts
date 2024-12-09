import { existsSync, statSync, readdirSync } from "fs";
import { log } from "./console.js";

// 检查路径是否存在且有内容
export function checkPathExists(targetPath: string): boolean {
  try {
    // 检查路径是否存在
    if (!existsSync(targetPath)) {
      return false;
    }

    const stats = statSync(targetPath);
    
    // 检查是否为目录且不为空
    if (!stats.isDirectory()) {
      return false;
    }
    
    const files = readdirSync(targetPath);
    return files.length > 0;
    
  } catch (error) {
    log.error(`检查路径出错: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
