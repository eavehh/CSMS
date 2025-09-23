import {HeartbeatRequest} from "../../types/ocpp/1.6/Heartbeat"
import {HeartbeatResponse} from "../../types/ocpp/1.6/HeartbeatResponse"
import {logger} from "../server/logger"
import WebSocket from 'ws';

export async function handleHeartbeat(req: HeartbeatRequest, chargePointId:string, ws: WebSocket): Promise<HeartbeatResponse>{
    logger.info(`heartbeat from ${chargePointId}`)

    return {
        currentTime: new Date().toISOString() 
    }
}
