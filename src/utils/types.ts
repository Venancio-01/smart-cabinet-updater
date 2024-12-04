// 类型定义
export type PathType = 'file' | 'directory' | 'all';

export interface SSHConfig {
    host: string;
    port: number;
    remotePath: string;
} 
