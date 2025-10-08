import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { logger } from '../logger';  // Адаптируйте путь к вашему logger

// Инициализация AJV
const ajv = new Ajv({
  allErrors: true,  // Показывать все ошибки валидации
  verbose: true,    // Детальное описание ошибок
  strict: false     // Менее строгий режим для OCPP-сообщений
});

// Добавление форматов (для date-time, uuid и тд)
addFormats(ajv);

const schemas = {
  // Core Profile
  'BootNotification': {
    type: 'object',
    properties: {
      chargePointVendor: { type: 'string' },
      chargePointModel: { type: 'string' },
      chargeBoxSerialNumber: { type: 'string' },
      chargePointSerialNumber: { type: 'string' },
      iccid: { type: 'string' },
      imsi: { type: 'string' },
      firmwareVersion: { type: 'string' },
      protocolVersion: { type: 'string', enum: ['1.6'] }
    },
    required: ['chargePointVendor', 'chargePointModel', 'firmwareVersion'],
    additionalProperties: false
  },
  'BootNotificationResponse': {
    type: 'object',
    properties: {
      currentTime: { type: 'string', format: 'date-time' },
      interval: { type: 'integer' },
      status: { type: 'string', enum: ['Accepted', 'Rejected'] }
    },
    required: ['currentTime', 'interval', 'status'],
    additionalProperties: false
  },

  'Authorize': {
    type: 'object',
    properties: {
      idTag: { type: 'string' }
    },
    required: ['idTag'],
    additionalProperties: false
  },
  'AuthorizeResponse': {
    type: 'object',
    properties: {
      idTagInfo: {
        type: 'object',
        properties: {
          expiryDate: { type: 'string', format: 'date-time' },
          parentIdTag: { type: 'string' },
          status: { type: 'string', enum: ['Accepted', 'Blocked', 'Expired', 'Invalid', 'ConcurrentTx'] }
        },
        required: ['status']
      }
    },
    required: ['idTagInfo'],
    additionalProperties: false
  },

  'StatusNotification': {
    type: 'object',
    properties: {
      connectorId: { type: 'integer' },
      errorCode: { type: 'string', enum: ['NoError', 'ConnectorLockFailure', 'PowerMeterFailure', 'PowerSwitchLockFailure', 'ReaderLockFailure', 'ResetFailure', 'GroundFault', 'OverCurrentFailure', 'OverVoltage', 'UnderVoltage', 'OverTemperature', 'InternalError'] },
      status: { type: 'string', enum: ['Available', 'Preparing', 'Charging', 'Finishing', 'Reserved', 'Unavailable', 'Faulted'] },
      timestamp: { type: 'string', format: 'date-time' },
      info: { type: 'string' },
      vendorId: { type: 'string' },
      vendorErrorCode: { type: 'string' }
    },
    required: ['connectorId', 'status'],
    additionalProperties: false
  },
  'StatusNotificationResponse': {
    type: 'object',
    additionalProperties: false  // Пустой ответ
  },

  'StartTransaction': {
    type: 'object',
    properties: {
      connectorId: { type: 'integer' },
      idTag: { type: 'string' },
      meterStart: { type: 'integer' },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['connectorId', 'idTag', 'meterStart', 'timestamp'],
    additionalProperties: false
  },
  'StartTransactionResponse': {
    type: 'object',
    properties: {
      idTagInfo: {
        type: 'object',
        properties: {
          expiryDate: { type: 'string', format: 'date-time' },
          parentIdTag: { type: 'string' },
          status: { type: 'string', enum: ['Accepted', 'Blocked', 'Expired', 'Invalid', 'ConcurrentTx'] }
        },
        required: ['status']
      },
      transactionId: { type: 'integer' }
    },
    required: ['idTagInfo', 'transactionId'],
    additionalProperties: false
  },

  'StopTransaction': {
    type: 'object',
    properties: {
      transactionId: { type: 'integer' },
      meterStop: { type: 'integer' },
      timestamp: { type: 'string', format: 'date-time' },
      reason: { type: 'string', enum: ['Local', 'Remote', 'EVDisconnected', 'HardReset', 'PowerLoss', 'Reboot'] },
      idTag: { type: 'string' },
      transactionData: {
        type: 'array',
        items: { type: 'object' }  // MeterValue[]
      }
    },
    required: ['transactionId', 'meterStop', 'timestamp'],
    additionalProperties: false
  },
  'StopTransactionResponse': {
    type: 'object',
    properties: {
      idTagInfo: {
        type: 'object',
        properties: {
          expiryDate: { type: 'string', format: 'date-time' },
          parentIdTag: { type: 'string' },
          status: { type: 'string', enum: ['Accepted', 'Blocked', 'Expired', 'Invalid', 'ConcurrentTx'] }
        },
        required: ['status']
      }
    },
    required: ['idTagInfo'],
    additionalProperties: false
  },

  'MeterValues': {
    type: 'object',
    properties: {
      connectorId: { type: 'integer' },
      transactionId: { type: 'integer' },
      meterValue: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            sampledValue: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  context: { type: 'string' },
                  format: { type: 'string' },
                  measurand: { type: 'string' },
                  phase: { type: 'string' },
                  location: { type: 'string' },
                  unit: { type: 'string' }
                }
              }
            }
          },
          required: ['timestamp']
        }
      }
    },
    required: ['connectorId', 'transactionId', 'meterValue'],
    additionalProperties: false
  },
  'MeterValuesResponse': {
    type: 'object',
    additionalProperties: false  // Пустой ответ
  },

  'Heartbeat': {
    type: 'object',
    additionalProperties: false  // Пустой запрос
  },
  'HeartbeatResponse': {
    type: 'object',
    properties: {
      currentTime: { type: 'string', format: 'date-time' }
    },
    required: ['currentTime'],
    additionalProperties: false
  },

  'ChangeConfiguration': {
    type: 'object',
    properties: {
      key: { type: 'string' },
      value: { type: 'string' }
    },
    required: ['key', 'value'],
    additionalProperties: false
  },
  'ChangeConfigurationResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Accepted', 'Rejected', 'NotSupported'] }
    },
    required: ['status'],
    additionalProperties: false
  },

  'GetConfiguration': {
    type: 'object',
    properties: {
      key: { type: 'array', items: { type: 'string' } }
    },
    additionalProperties: false
  },
  'GetConfigurationResponse': {
    type: 'object',
    properties: {
      configurationKey: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            readonly: { type: 'boolean' },
            value: { type: 'string' }
          },
          required: ['key', 'readonly', 'value']
        }
      },
      unknownKey: { type: 'array', items: { type: 'string' } }
    },
    required: ['configurationKey'],
    additionalProperties: false
  },

  // Reservation Profile
  'ReserveNow': {
    type: 'object',
    properties: {
      connectorId: { type: 'integer' },
      expiryDate: { type: 'string', format: 'date-time' },
      idTag: { type: 'string' }
    },
    required: ['connectorId', 'expiryDate', 'idTag'],
    additionalProperties: false
  },
  'ReserveNowResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Accepted', 'Occupied', 'Rejected', 'NotSupported'] }
    },
    required: ['status'],
    additionalProperties: false
  },

  'CancelReservation': {
    type: 'object',
    properties: {
      reservationId: { type: 'integer' }
    },
    required: ['reservationId'],
    additionalProperties: false
  },
  'CancelReservationResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Accepted', 'Rejected'] }
    },
    required: ['status'],
    additionalProperties: false
  },

  // FirmwareManagement Profile
  'UpdateFirmware': {
    type: 'object',
    properties: {
      location: { type: 'string' },
      retrieveDate: { type: 'string', format: 'date-time' },
      installDate: { type: 'string', format: 'date-time' },
      firmware: { type: 'string' },  // Base64 или URL
      signature: { type: 'string' },
      signatureMethod: { type: 'string' }
    },
    required: ['location'],
    additionalProperties: false
  },
  'UpdateFirmwareResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Accepted', 'Rejected', 'NotSupported'] }
    },
    required: ['status'],
    additionalProperties: false
  },

  'GetFirmwareVersion': {
    type: 'object',
    additionalProperties: false  // Пустой запрос
  },
  'GetFirmwareVersionResponse': {
    type: 'object',
    properties: {
      firmwareVersion: { type: 'string' }
    },
    required: ['firmwareVersion'],
    additionalProperties: false
  },

  // Diagnostics Profile
  'GetDiagnostics': {
    type: 'object',
    properties: {
      location: { type: 'string' },
      retries: { type: 'integer' },
      retryInterval: { type: 'integer' },
      startTime: { type: 'string', format: 'date-time' },
      stopTime: { type: 'string', format: 'date-time' }
    },
    additionalProperties: false
  },
  'GetDiagnosticsResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Accepted', 'Rejected', 'NotSupported'] },
      fileName: { type: 'string' }
    },
    required: ['status'],
    additionalProperties: false
  },

  // SmartCharging Profile (базовое)
  'SetChargingProfile': {
    type: 'object',
    properties: {
      connectorId: { type: 'integer' },
      csChargingProfiles: { type: 'object' }  // ChargingProfile[]
    },
    required: ['csChargingProfiles'],
    additionalProperties: false
  },
  'SetChargingProfileResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Accepted', 'Rejected'] }
    },
    required: ['status'],
    additionalProperties: false
  },

  'ClearChargingProfile': {
    type: 'object',
    properties: {
      connectorId: { type: 'integer' }
    },
    additionalProperties: false
  },
  'ClearChargingProfileResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Accepted', 'Rejected', 'Unknown'] }
    },
    required: ['status'],
    additionalProperties: false
  },

  // UnlockConnector
  'UnlockConnector': {
    type: 'object',
    properties: {
      connectorId: { type: 'integer' }
    },
    required: ['connectorId'],
    additionalProperties: false
  },
  'UnlockConnectorResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Unlocked', 'Locked'] }
    },
    required: ['status'],
    additionalProperties: false
  },

  // Reset
  'Reset': {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['Hard', 'Soft'] }
    },
    additionalProperties: false
  },
  'ResetResponse': {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Accepted', 'Rejected'] }
    },
    required: ['status'],
    additionalProperties: false
  }
  // Добавьте другие, если нужно (например, DiagnosticsStatusNotification)
};

// Компиляция схем (один раз при инициализации)
const validators: any = {};
Object.entries(schemas).forEach(([key, schema]) => {
  validators[key] = ajv.compile(schema);
});

export function validateMessage(payload: any, schemaName: string, isRequest: boolean = true): { valid: boolean; errors?: any[] } {
  const suffix = isRequest ? '' : 'Response';
  const fullName = schemaName + suffix;
  const validator = validators[fullName];

  if (!validator) {
    logger.warn(`No schema defined for ${fullName} — skipping validation`);
    return { valid: true };  // Fallback
  }

  const valid = validator(payload);
  return {
    valid,
    errors: valid ? undefined : validator.errors  // Только если !valid
  };
}