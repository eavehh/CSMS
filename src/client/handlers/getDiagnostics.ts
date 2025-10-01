import { GetDiagnosticsRequest } from '../../../types/1.6/GetDiagnostics';
import { GetDiagnosticsResponse } from '../../../types/1.6/GetDiagnosticsResponse';
import { Diagnostics } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleGetDiagnostics(req: GetDiagnosticsRequest, chargePointId: string, ws: WebSocket): Promise<GetDiagnosticsResponse> {
    try {
        await Diagnostics.findOneAndUpdate(
            { chargePointId },
            { fileName: req.location, status: 'Idle' },
            { upsert: true }
        );
        await Log.create({ action: 'GetDiagnostics', chargePointId, payload: req });
        logger.info(`Get diagnostics for ${chargePointId}: ${req.location}`);
        return { status: 'Accepted' };
    } catch (err) {
        logger.error(`Error in GetDiagnostics: ${err}`);
        return { status: 'Rejected' };
    }
}