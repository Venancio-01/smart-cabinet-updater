import chalk from 'chalk'

export const log = {
  info: (message: string) => console.log(chalk.cyan(message)),
  success: (message: string) => console.log(chalk.green(message)),
  warning: (message: string) => console.log(chalk.yellow(message)),
  error: (message: string) => console.log(chalk.red(message)),
  prompt: (message: string) => console.log(chalk.magenta(message)),
}
