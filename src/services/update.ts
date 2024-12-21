import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { backendFolderPath, cabinetFolderPath, cabinetSSHConfig, databaseFolderPath, doorFolderPath, serverSSHConfig } from '../utils/config.js'
import { log } from '../utils/console.js'
import { getUserInput } from '../utils/input.js'
import { executeSSHCommand, uploadFile, uploadPath } from '../utils/ssh.js'

// 处理延时
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

// 处理载体柜服务更新
export async function handleCabinetServerUpdate(): Promise<void> {
  log.info('开始更新后台服务...')
  try {
    const sudoPassword = await getUserInput('请输入服务器管理员用户密码: ')

    // 1. 上传更新文件夹
    // 读取后台更新文件夹下的所有文件
    const files = readdirSync(backendFolderPath)
    // 找到第一个文件夹
    const firstFolder = files.find(file => statSync(join(backendFolderPath, file)).isDirectory())
    if (!firstFolder) {
      throw new Error('未找到后台更新文件夹')
    }
    const localPath = join(backendFolderPath, firstFolder)
    await uploadPath(localPath, serverSSHConfig, sudoPassword)
    log.success('更新文件上传完成')

    // 2. 停止服务
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl stop Cabinet.service`, serverSSHConfig, sudoPassword)
    log.success('Cabinet 服务已停止')

    // 3. 覆盖文件
    const updateCommand = `echo "${sudoPassword}" | sudo -S cp -rf ${serverSSHConfig.uploadPath}/* ${serverSSHConfig.targetPath}/`
    await executeSSHCommand(updateCommand, serverSSHConfig, sudoPassword)
    log.success('文件覆盖完成')

    // 4. 启动服务
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl start Cabinet.service`, serverSSHConfig, sudoPassword)
    log.success('Cabinet 服务已启动')

    // 5. 延时后检查服务状态
    await delay(5000) // 等待 5 秒
    const serviceStatus = await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl is-active Cabinet.service`, serverSSHConfig, sudoPassword)

    // 6. 输出更新结果
    if (serviceStatus.slice(4).trim() === 'active') {
      log.success('更新成功：Cabinet 服务运行正常')
    }
    else {
      throw new Error('更新失败：Cabinet 服务未正常运行')
    }

    // 7. 删除更新文件
    await executeSSHCommand(`rm -rf ${serverSSHConfig.uploadPath}`, serverSSHConfig, sudoPassword)
    log.success('更新文件已删除')
  }
  catch (error) {
    log.error(`更新过程出错${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

export async function handleSmartCabinetUpdate(): Promise<void> {
  log.info('开始更新载体柜程序...')
  try {
    // 查找并上传载体柜更新文件
    const smartCabinetPattern = /^smart_cabinet_\d+\.\d+\.\d+\.deb$/
    const files = readdirSync(cabinetFolderPath)
    const smartCabinetUpdateFile = files.find(file => smartCabinetPattern.test(file))

    if (!smartCabinetUpdateFile) {
      throw new Error('未找到载体柜更新文件')
    }

    const sudoPassword = await getUserInput('请输入载体柜管理员密码: ')

    const localPath = join(cabinetFolderPath, smartCabinetUpdateFile)
    await uploadFile(localPath, cabinetSSHConfig, sudoPassword)
    log.success('更新文件上传完成')

    // 结束载体柜程序进程
    try {
      await executeSSHCommand(`pkill -f /opt/smart-cabinet`, cabinetSSHConfig, sudoPassword)
      log.success('载体柜程序已停止')
    }
    catch (error) {
      console.log('🚀 - handleSmartCabinetUpdate - error:', error)
      // 如果进程不存在，继续执行
      log.warning('载体柜程序可能未在运行')
    }

    // 结束指纹
    try {
      await executeSSHCommand(`pkill -f finger_server`, cabinetSSHConfig, sudoPassword)
      log.success('指纹进程已停止')
    }
    catch (error) {
      console.log('🚀 - handleSmartCabinetUpdate - error:', error)
      // 如果进程不存在，继续执行
      log.warning('指纹进程可能未在运行')
    }

    // 执行更新命令
    await executeSSHCommand(`cd ${cabinetSSHConfig.uploadPath} && echo "${sudoPassword}" | sudo -S dpkg -i ${smartCabinetUpdateFile}`, cabinetSSHConfig, sudoPassword)
    log.success('载体柜更新完成')

    // 删除更新文件
    await executeSSHCommand(`rm -rf ${cabinetSSHConfig.uploadPath}${smartCabinetUpdateFile}`, cabinetSSHConfig, sudoPassword)
    log.success('更新文件已删除')

    // 给指纹服务赋权
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S chown root:root /opt/smart-cabinet/resources/bin/finger_server`, cabinetSSHConfig, sudoPassword)
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S chmod u+s /opt/smart-cabinet/resources/bin/finger_server`, cabinetSSHConfig, sudoPassword)

    // 延时重启电脑（2秒后）
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S bash -c "sleep 2 && reboot"`, cabinetSSHConfig, sudoPassword).catch(() => {
      // 忽略错误
    })

    log.success('电脑将在 2 秒后重启')
  }
  catch (error) {
    log.error(`更新过程出错${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

export async function handleAccessDoorUpdate(): Promise<void> {
  log.info('开始更新通道门程序...')
  try {
    // 查找并上传通道门更新文件
    const accessDoorPattern = /^access_door_\d+\.\d+\.\d+\.deb$/
    const files = readdirSync(doorFolderPath)
    const accessDoorUpdateFile = files.find(file => accessDoorPattern.test(file))

    if (!accessDoorUpdateFile) {
      throw new Error('未找到通道门更新文件')
    }

    const sudoPassword = await getUserInput('请输入通道门管理员密码: ')

    const localPath = join(doorFolderPath, accessDoorUpdateFile)
    await uploadFile(localPath, cabinetSSHConfig, sudoPassword)
    log.success('更新文件上传完成')

    // 结束通道门程序进程
    try {
      await executeSSHCommand(`pkill -f /opt/access-door`, cabinetSSHConfig, sudoPassword)
      log.success('通道门程序已停止')
    }
    catch (error) {
      console.log('🚀 - handleAccessDoorUpdate - error:', error)
      // 如果进程不存在，继续执行
      log.warning('通道门程序可能未在运行')
    }

    // 结束摄像头进程
    try {
      await executeSSHCommand(`pkill -f camera_server`, cabinetSSHConfig, sudoPassword)
      log.success('摄像头进程已停止')
    }
    catch (error) {
      console.log('🚀 - handleAccessDoorUpdate - error:', error)
      // 如果进程不存在，继续执行
      log.warning('摄像头进程可能未在运行')
    }

    // 执行更新命令
    await executeSSHCommand(`cd ${cabinetSSHConfig.uploadPath} && echo "${sudoPassword}" | sudo -S dpkg -i ${accessDoorUpdateFile}`, cabinetSSHConfig, sudoPassword)
    log.success('通道门更新完成')

    // 删除更新文件
    await executeSSHCommand(`rm -rf ${cabinetSSHConfig.uploadPath}${accessDoorUpdateFile}`, cabinetSSHConfig, sudoPassword)
    log.success('更新文件已删除')

    // 延时重启电脑（2秒后）
    executeSSHCommand(`echo "${sudoPassword}" | sudo -S bash -c "sleep 2 && reboot"`, cabinetSSHConfig, sudoPassword).catch(() => {
      // 忽略错误
    })

    log.success('电脑将在 2 秒后重启')
  }
  catch (error) {
    log.error(`更新过程出错${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

// 重装数据库
export async function handleDatabaseUpdate(): Promise<void> {
  log.info('开始重装数据库...')
  try {
    const sudoPassword = await getUserInput('请输入服务器管理员用户密码: ')

    // 1. 上传更新文件夹
    const files = readdirSync(databaseFolderPath)
    const mysqlPackage = files.find(file => file.startsWith('mysql-8'))
    if (!mysqlPackage) {
      throw new Error('未找到 MySQL 安装包')
    }

    // 2. 检查目标文件夹内是否存在 mysql 安装程序
    try {
      const mysqlInstallFile = await executeSSHCommand(`ls ${serverSSHConfig.uploadPath} | grep mysql-8 || true`, serverSSHConfig, sudoPassword)
      console.log('🚀 - handleDatabaseUpdate - mysqlInstallFile:', mysqlInstallFile)
      if (mysqlInstallFile) {
        log.warning('目标文件夹内已存在 MySQL 安装程序')
      }
      else {
        const localPath = join(databaseFolderPath, mysqlPackage)
        await uploadFile(localPath, serverSSHConfig, sudoPassword)
        log.success('MySQL 安装包上传完成')
      }
    }
    catch (error) {
      console.log('目标文件夹内已存在 MySQL 安装程序', error)
      // 如果执行失败，假设文件不存在，继续上传
      const localPath = join(databaseFolderPath, mysqlPackage)
      await uploadFile(localPath, serverSSHConfig, sudoPassword)
      log.success('MySQL 安装包上传完成')
    }

    // 3. 备份数据库数据
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S /usr/local/mysql/bin/mysqldump -S /mysql/data/mysql.sock -u root --all-databases --single-transaction --flush-logs --master-data=2 --set-gtid-purged=OFF > ${serverSSHConfig.targetPath}/mysql-backup.sql`, serverSSHConfig, sudoPassword)
      log.success('MySQL 数据备份完成')
    }
    catch (error) {
      console.log('MySQL 数据备份失败', error)
      log.warning('MySQL 数据可能已备份')
    }

    // 4. 停止服务
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S service mysql.server stop`, serverSSHConfig, sudoPassword)
      log.success('MySQL 服务已停止')
    }
    catch (error) {
      console.log('MySQL 服务停止失败', error)
      log.warning('MySQL 服务可能未在运行')
    }

    // 5. 删除原 MySQL 数据
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S rm -rf /usr/local/mysql*`, serverSSHConfig, sudoPassword)
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S rm -rf /mysql`, serverSSHConfig, sudoPassword)
      log.success('原 MySQL 数据已删除')
    }
    catch (error) {
      console.log('原 MySQL 数据删除失败', error)
      log.warning('原 MySQL 数据可能不存在')
    }

    // 6. 创建 MySQL 用户
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S useradd mysql`, serverSSHConfig, sudoPassword)
      log.success('MySQL 用户创建完成')
    }
    catch (error) {
      console.log('MySQL 用户创建失败', error)
      log.warning('MySQL 用户可能已存在')
    }

    // 7. 创建必要目录
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S mkdir -p /mysql/data /mysql/binlog`, serverSSHConfig, sudoPassword)
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S chown -R mysql:mysql /mysql/data /mysql/binlog`, serverSSHConfig, sudoPassword)
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S chmod -R 777 /mysql/data /mysql/binlog`, serverSSHConfig, sudoPassword)
      log.success('MySQL 目录创建完成')
    }
    catch (error) {
      console.log('MySQL 目录创建失败', error)
      log.warning('MySQL 目录可能已存在')
    }

    // 8. 解压 MySQL 包
    try {
      await executeSSHCommand(`cd /usr/local && echo "${sudoPassword}" | sudo -S tar xf ${serverSSHConfig.uploadPath}/${mysqlPackage}`, serverSSHConfig, sudoPassword)
      await executeSSHCommand(`cd /usr/local && echo "${sudoPassword}" | sudo -S ln -sf mysql-8* mysql`, serverSSHConfig, sudoPassword)
      log.success('MySQL 解压完成')
    }
    catch (error) {
      console.log('MySQL 解压失败', error)
      log.warning('MySQL 解压可能失败')
    }

    // 9. 安装启动服务
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S cp /usr/local/mysql/support-files/mysql.server /etc/init.d/`, serverSSHConfig, sudoPassword)
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S chmod +x /etc/init.d/mysql.server`, serverSSHConfig, sudoPassword)
      log.success('MySQL 服务安装完成')
    }
    catch (error) {
      console.log('MySQL 服务安装失败', error)
      log.warning('MySQL 服务安装可能失败')
    }

    // 10. 创建配置文件
    try {
      const writeCommand = `echo "${sudoPassword}" | sudo -S bash -c 'cat > /etc/my.cnf << EOF
[mysqld]
user=mysql
port=9306
socket=/mysql/data/mysql.sock
pid_file=/mysql/data/mysql.pid
server_id=228138
basedir=/usr/local/mysql
datadir=/mysql/data/
log_bin=/mysql/binlog/mysql-bin
gtid_mode=ON
enforce_gtid_consistency=ON
lower_case_table_names=1
sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION,PIPES_AS_CONCAT,ANSI_QUOTES'
[client]
user=root
password=123456
socket=/mysql/data/mysql.sock
EOF'`
      await executeSSHCommand(writeCommand, serverSSHConfig, sudoPassword)
      log.success('MySQL 配置文件创建完成')
    }
    catch (error) {
      console.log('MySQL 配置文件创建失败', error)
      log.warning('MySQL 配置文件可能已存在')
    }

    // 11. 初始化数据库
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S /usr/local/mysql/bin/mysqld --defaults-file=/etc/my.cnf --initialize-insecure`, serverSSHConfig, sudoPassword)
      log.success('MySQL 初始化完成')
    }
    catch (error) {
      console.log('MySQL 初始化失败', error)
      log.warning('MySQL 初始化可能失败')
    }

    // 12. 启动 MySQL
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S service mysql.server start`, serverSSHConfig, sudoPassword)
      log.success('MySQL 服务已启动')
    }
    catch (error) {
      console.log('MySQL 服务启动失败', error)
      log.warning('MySQL 服务启动可能失败')
    }

    // 13. 设置开机自启动
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl enable mysql.server`, serverSSHConfig, sudoPassword)
      log.success('MySQL 开机自启动设置完成')
    }
    catch (error) {
      console.log('MySQL 开机自启动设置失败', error)
      log.warning('MySQL 开机自启动设置可能失败')
    }

    // // 14. 删除安装包
    // try {
    //   await executeSSHCommand(`echo "${sudoPassword}" | sudo -S rm -f ${serverSSHConfig.uploadPath}/${mysqlPackage}`, serverSSHConfig, sudoPassword)
    //   log.success('安装包已删除')
    // }
    // catch (error) {
    //   console.log('安装包删除失败', error)
    //   log.warning('安装包可能不存在')
    // }

    // 15. 恢复数据库备份
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S /usr/local/mysql/bin/mysql -S /mysql/data/mysql.sock -u root < ${serverSSHConfig.targetPath}/mysql-backup.sql`, serverSSHConfig, sudoPassword)
      log.success('MySQL 数据恢复完成')
    }
    catch (error) {
      console.log('MySQL 数据恢复失败', error)
      log.warning('MySQL 数据可能已恢复')
    }

    // 16. 修改后台配置文件
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S sed -i 's/3306/9306/g' ${serverSSHConfig.targetPath}/appsettings.json`, serverSSHConfig, sudoPassword)
      log.success('后台配置文件修改完成')
    }
    catch (error) {
      console.log('后台配置文件修改失败', error)
      log.warning('后台配置文件可能已存在')
    }

    // 17. 重启后台服务
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S systemctl restart Cabinet.service`, serverSSHConfig, sudoPassword)
      log.success('后台服务已重启')
    }
    catch (error) {
      console.log('后台服务重启失败', error)
      log.warning('后台服务可能未在运行')
    }

    log.success('MySQL 重装完成')
  }
  catch (error) {
    log.error(`更新过程出错${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

export async function handleDoorConfigUpdate(): Promise<void> {
  log.info('开始修改通道门配置...')
  try {
    const sudoPassword = await getUserInput('请输入通道门管理员密码: ')

    // 结束通道门程序进程
    try {
      await executeSSHCommand(`pkill -f /opt/access-door`, cabinetSSHConfig, sudoPassword)
      log.success('通道门程序已停止')
    }
    catch (error) {
      console.log('🚀 - handleDoorConfigUpdate - error:', error)
      // 如果进程不存在，继续执行
      log.warning('通道门程序可能未在运行')
    }

    // 修改通道门配置
    try {
      await executeSSHCommand(`echo "${sudoPassword}" | sudo -S sed -i 's/3306/9306/g' /opt/access-door/resources/.env.production`, serverSSHConfig, sudoPassword)
      log.success('通道门配置修改完成')
    }
    catch (error) {
      console.log('通道门配置修改失败', error)
      log.warning('通道门配置可能已存在')
    }

    // 延时重启电脑（2秒后）
    await executeSSHCommand(`echo "${sudoPassword}" | sudo -S bash -c "sleep 2 && reboot"`, cabinetSSHConfig, sudoPassword).catch(() => {
      // 忽略错误
    })

    log.success('电脑将在 2 秒后重启')
  }
  catch (error) {
    log.error(`更新过程出错${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}
