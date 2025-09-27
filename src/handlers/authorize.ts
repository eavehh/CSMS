import { AuthorizeRequest } from '../../types/1.6/Authorize';
import { AuthorizeResponse } from '../../types/1.6/AuthorizeResponse';
import WebSocket from 'ws';
import { logger } from '../server/logger';

export async function handleAuthorize(req: AuthorizeRequest, chargePointId: string, ws: WebSocket): Promise<AuthorizeResponse> {
  logger.info(`Authorize from ${chargePointId}: ${req.idTag}`);

  // DB 

  return {
    idTagInfo: {
      status: "Accepted" //
    } 
  };
}