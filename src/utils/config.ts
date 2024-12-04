import { SSHConfig } from './types.js';

// SSH 配置
export const cabinetSSHConfig: SSHConfig = {
    host: 'liqingshan@192.168.70.1',
    port: 2222,
    remotePath: '/home/qingshan/'
};

// 服务器 SSH 配置
export const serverSSHConfig: SSHConfig = {
    host: 'root@192.168.1.50',
    port: 22,
    remotePath: '/opt/hjrich/smart-cabinet/cabinet-server-update'
}; 
