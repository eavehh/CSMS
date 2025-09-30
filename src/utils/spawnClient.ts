import { spawn, ChildProcess } from 'child_process';
import { logger } from '../logger';  // Общий лог

export function spawnChargePointClient(chargePointId: string): ChildProcess {
    const child = spawn('node', ['dist/client/index.js', chargePointId], { stdio: 'pipe' });
    child.stdout.on('data', (data) => logger.info(`Client ${chargePointId}: ${data}`));
    child.stderr.on('data', (data) => logger.error(`Client ${chargePointId}: ${data}`));
    child.on('close', (code) => logger.info(`Client ${chargePointId} closed: ${code}`));

    // Передай ID в клиент (через arg, в index.ts process.argv[2])
    return child;
}