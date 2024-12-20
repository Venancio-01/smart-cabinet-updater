import type { Buffer } from 'node:buffer'
import process from 'node:process'
import { handleAccessDoorUpdate, handleCabinetServerUpdate, handleDatabaseUpdate, handleSmartCabinetUpdate } from './services/update.js'
import { backendFolderPath, cabinetFolderPath, databaseFolderPath, doorFolderPath } from './utils/config.js'
import { log } from './utils/console.js'
import { checkPathExists } from './utils/file.js'

function keepRunning(): void {
  log.info('按下 ESC 或 Ctrl + C 退出程序')

  // 设置原始模式以捕获按键
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  // 监听按键事件
  process.stdin.on('data', (key: Buffer | string) => {
    // Ctrl+C 的 ASCII 码是 03
    if (key === '\u0003' || key === '\u001B') {
      log.success('\n程序已退出')
      process.exit()
    }
  })
}

async function showMenu(updateOptions: string[]): Promise<void> {
  // 显示菜单
  log.info('\n检测到以下可用更新：')
  updateOptions.forEach(option => log.info(option))
  log.info('\n请输入数字选择要执行的操作：')

  // 设置原始模式以捕获按键
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  // 监听用户输入
  const dataHandler = async (key: Buffer | string): Promise<void> => {
    const input = String(key).trim()

    switch (input) {
      case '1':
        if (updateOptions.some(opt => opt.startsWith('1.'))) {
          process.stdin.setRawMode(false)
          process.stdin.removeListener('data', dataHandler)
          await handleCabinetServerUpdate()
          showMenu(updateOptions) // 更新完成后重新显示菜单
        }
        break
      case '2':
        if (updateOptions.some(opt => opt.startsWith('2.'))) {
          process.stdin.setRawMode(false)
          process.stdin.removeListener('data', dataHandler)
          await handleSmartCabinetUpdate()
          showMenu(updateOptions) // 更新完成后重新显示菜单
        }
        break
      case '3':
        if (updateOptions.some(opt => opt.startsWith('3.'))) {
          process.stdin.setRawMode(false)
          process.stdin.removeListener('data', dataHandler)
          await handleAccessDoorUpdate()
          showMenu(updateOptions) // 更新完成后重新显示菜单
        }
        break
      case '4':
        if (updateOptions.some(opt => opt.startsWith('4.'))) {
          process.stdin.setRawMode(false)
          process.stdin.removeListener('data', dataHandler)
          await handleDatabaseUpdate()
          showMenu(updateOptions) // 更新完成后重新显示菜单
        }
        break
      case '\u0003': // Ctrl+C
      case '\u001B': // ESC
        log.success('\n程序已退出')
        process.exit(0)
        break
    }
  }

  process.stdin.on('data', dataHandler)
  keepRunning()
}

async function main(): Promise<void> {
  try {
    const updateOptions: string[] = []

    // 检查文件夹是否存在并生成选项
    if (checkPathExists(backendFolderPath)) {
      updateOptions.push('1. 更新后台程序')
    }
    if (checkPathExists(cabinetFolderPath)) {
      updateOptions.push('2. 更新载体柜程序')
    }
    if (checkPathExists(doorFolderPath)) {
      updateOptions.push('3. 更新通道门程序')
    }
    if (checkPathExists(databaseFolderPath)) {
      updateOptions.push('4. 重装数据库')
    }

    if (updateOptions.length === 0) {
      log.info('未检测到任何更新文件')
      keepRunning()
      return
    }

    await showMenu(updateOptions)
  }
  catch (error) {
    log.error(`执行出错: ${error}`)
    process.exit(1)
  }
}

// 启动程序
main()
