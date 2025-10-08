import chalk from "chalk"

export const logger = {
  info: (msg: string) => console.log(`${(new Date()).toISOString()}`, chalk.green(`INFO `), `${msg}`),
  warn: (msg: string) => console.log(`${(new Date()).toISOString()}`, chalk.yellow(`WARN `), `${msg}`),
  error: (msg: string) => console.log(`${(new Date()).toISOString()}`, chalk.red(`ERROR`), `${msg}`),
  debug: (msg: string) => console.log(`${(new Date()).toISOString()}`, chalk.gray(`DEBUG`), `${msg}`)
};