import { existsSync, statSync, readdirSync } from 'node:fs';
import { PathType } from './types.js';

// 检查路径是否存在
export function checkPathExists(targetPath: string | RegExp, type: PathType = 'all'): boolean {
    try {
        if (targetPath instanceof RegExp) {
            // 如果是正则表达式，则在当前目录查找匹配的文件
            const files = readdirSync(process.cwd());
            return files.some(file => {
                if (targetPath.test(file)) {
                    const fullPath = `${process.cwd()}/${file}`;
                    const stats = statSync(fullPath);
                    switch(type.toLowerCase()) {
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
        } else {
            // 原有的直接路径检查逻辑
            if (!existsSync(targetPath)) {
                return false;
            }
            
            const stats = statSync(targetPath);
            switch(type.toLowerCase()) {
                case 'file':
                    return stats.isFile();
                case 'directory':
                    return stats.isDirectory();
                default:
                    return true;
            }
        }
    } catch (error) {
        console.error(`检查路径出错: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
} 
