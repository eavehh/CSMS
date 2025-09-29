"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBootNotification = handleBootNotification;
const RemoteControl_1 = require("../utils/RemoteControl");
const mongoose_1 = require("../db/mongoose");
const logger_1 = require("../logger");
const mongoose_2 = require("../db/mongoose");
const index_1 = require("../server/index");
async function handleBootNotification(req, chargePointId, ws) {
    try {
        // Проверим, не прошло ли больше суток с последней загрузки
        let chargePoint = await mongoose_1.ChargePoint.findOne({ id: chargePointId });
        if (chargePoint && chargePoint.lastOffline) {
            const diffTime = new Date().getTime() - chargePoint.lastOffline.getTime();
            if (diffTime >= 24 * 60 * 60 * 1000) {
                const lastLocalList = await mongoose_2.LocalList.findOne({ chargePointId }).sort({ updatedAt: -1 });
                if (lastLocalList) {
                    (0, RemoteControl_1.sendRemoteMessage)(index_1.connectionManager, chargePointId, 'SendLocalList', {
                        listVersion: lastLocalList.listVersion,
                        LocalList: lastLocalList.localList
                    });
                }
            }
        }
        // Upsert: Создай или обнови ChargePoint
        chargePoint = await mongoose_1.ChargePoint.findOneAndUpdate({ id: chargePointId }, // Где искать (по ID)
        {
            id: chargePointId,
            vendor: req.chargePointVendor,
            model: req.chargePointModel,
            boxSerial: req.chargeBoxSerialNumber,
            pointSerial: req.chargeBoxSerialNumber,
            firmware: req.firmwareVersion,
            lastBoot: new Date(), // Добавь поле lastBoot в модель ChargePoint
            lastOffline: null, // Сбрось lastOffline при загрузкеd
            iccid: req.iccid,
            imsi: req.imsi,
            meterType: req.meterType,
            meterSerialNumber: req.meterSerialNumber
        }, { upsert: true, new: true } // upsert: true = создай, если нет; new: true = верни обновлённый
        );
        logger_1.logger.boot(`Boot from ${chargePointId}:
      Vendor: ${req.chargePointVendor} \n,
      Model: ${req.chargePointModel} \n
      Point serial number: ${req.meterSerialNumber} \n
      Box serial number: ${req.chargeBoxSerialNumber} \n
      Firmware: ${req.firmwareVersion} \n
      iccid: ${req.iccid} \n
      imsi: ${req.imsi} \n
      Meter type: ${req.meterType} \n
      Meter serial number: ${req.meterSerialNumber} \n
      saved to MongoDB`);
    }
    catch (err) {
        logger_1.logger.error(`DB save error: ${err} `);
    }
    return { currentTime: new Date().toISOString(), interval: 60, status: 'Accepted' };
}
