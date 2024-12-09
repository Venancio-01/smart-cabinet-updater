import { join } from 'path';
import { SSHConfig } from './types.js';

// SSH 配置
export const cabinetSSHConfig: SSHConfig = {
    host: 'user@192.168.8.2',
    port: 22,
    remotePath: '/home/user/smart-cabinet'
};

// export const cabinetSSHConfig: SSHConfig = {
//     host: 'liqingshan@192.168.70.130',
//     port: 22,
//     remotePath: '/home/liqingshan/smart-cabinet'
// };

// 服务器 SSH 配置
export const serverSSHConfig: SSHConfig = {
    host: 'root@192.168.1.50',
    port: 22,
    remotePath: '/opt/hjrich/smart-cabinet/cabinet-server-update'
}; 

// export const serverSSHConfig: SSHConfig = {
//     host: 'liqingshan@192.168.70.130',
//     port: 22,
//     remotePath: '/home/liqingshan/smart-cabinet/cabinet-server-update'
// }; 



export const backendFolderPath = join(process.cwd(), "后台更新程序");
export const cabinetFolderPath = join(process.cwd(), "载体柜更新程序");
export const doorFolderPath = join(process.cwd(), "通道门更新程序");
export const backgroundFolderPath = join(process.cwd(), "载体柜程序背景图片");
