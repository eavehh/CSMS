/* Auto-generated from TriggerMessage.json, do not edit manually */

export interface TriggerMessageRequest {
  requestedMessage:
    | "BootNotification"
    | "DiagnosticsStatusNotification"
    | "FirmwareStatusNotification"
    | "Heartbeat"
    | "MeterValues"
    | "StatusNotification";
  connectorId?: number;
}
