import { BootNotificationRequest } from '../types/1.6/BootNotification';
import { BootNotificationResponse } from '../types/1.6/BootNotificationResponse';
import { sendRemoteMessage } from '../remoteControl'
import { ChargePoint } from "../../db/mongoose"
import { logger } from '../../logger'
import { LocalList } from "../../db/mongoose"
import { connectionManager } from '../../server/index';
export const INTERVAL: number = 60

export async function handleBootNotification(req: BootNotificationRequest, chargePointId: string, ws: WebSocket): Promise<BootNotificationResponse> {
  try {
    // Проверим, не прошло ли больше суток с последней загрузки
    let chargePoint = await ChargePoint.findOne({ id: chargePointId });
    if (chargePoint && chargePoint.lastOffline) {
      const diffTime = new Date().getTime() - chargePoint.lastOffline.getTime()
      if (diffTime >= 24 * 60 * 60 * 1000) {
        const lastLocalList = await LocalList.findOne({ chargePointId }).sort({ updatedAt: -1 });
        if (lastLocalList) {
          sendRemoteMessage(connectionManager, chargePointId, 'SendLocalList', {
            listVersion: lastLocalList.listVersion,
            LocalList: lastLocalList.localList
          })
        }
      }
    }
    // Upsert: Создай или обнови ChargePoint
    chargePoint = await ChargePoint.findOneAndUpdate(
      { id: chargePointId },  // Где искать (по ID)
      {
        id: chargePointId,
        vendor: req.chargePointVendor,
        model: req.chargePointModel,
        boxSerial: req.chargeBoxSerialNumber,
        pointSerial: req.chargeBoxSerialNumber,
        firmware: req.firmwareVersion,
        lastBoot: new Date(),  // Добавь поле lastBoot в модель ChargePoint
        lastOffline: null, // Сбрось lastOffline при загрузкеd
        iccid: req.iccid,
        imsi: req.imsi,
        meterType: req.meterType,
        meterSerialNumber: req.meterSerialNumber
      },
      { upsert: true, new: true }  // upsert: true = создай, если нет; new: true = верни обновлённый
    );

    connectionManager.initializeConnectors(chargePointId)

    logger.info(`Boot from ${chargePointId}:
      Vendor: ${req.chargePointVendor}
      Model: ${req.chargePointModel} 
      Point serial number: ${req.meterSerialNumber}
      Box serial number: ${req.chargeBoxSerialNumber} 
      Firmware: ${req.firmwareVersion} 
      iccid: ${req.iccid} 
      imsi: ${req.imsi} 
      Meter type: ${req.meterType} 
      Meter serial number: ${req.meterSerialNumber} 
      saved to MongoDB`);

  } catch (err) {
    logger.error(`DB save error: ${err} `);
  }

  return { currentTime: new Date().toISOString(), interval: INTERVAL, status: 'Accepted' };
}