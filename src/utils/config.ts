import type { SSHConfig } from './types.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

// 读取配置文件
let config
try {
  const configPath = join(process.cwd(), 'config.json')
  config = JSON.parse(readFileSync(configPath, 'utf-8'))
}
catch (error) {
  throw new Error(`配置文件读取失败: ${error instanceof Error ? error.message : String(error)}`)
}

// 检查配置项是否存在
if (!config.cabinetSSHConfig || !config.serverSSHConfig || !config.paths) {
  throw new Error('配置文件缺少必要的配置项')
}

// SSH 配置
export const cabinetSSHConfig: SSHConfig = config.cabinetSSHConfig
export const serverSSHConfig: SSHConfig = config.serverSSHConfig

// 路径配置
export const backendFolderPath = join(process.cwd(), config.paths.backendFolderPath)
export const cabinetFolderPath = join(process.cwd(), config.paths.cabinetFolderPath)
export const doorFolderPath = join(process.cwd(), config.paths.doorFolderPath)
export const databaseFolderPath = join(process.cwd(), config.paths.databaseFolderPath)
