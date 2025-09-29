export const logger = {
  info: (msg: string) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`),
  boot: (msg: string) => console.log(`[BOOT] ${new Date().toISOString()} ${msg}`)
};