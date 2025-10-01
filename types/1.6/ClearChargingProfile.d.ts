/* Auto-generated from ClearChargingProfile.json, do not edit manually */

export interface ClearChargingProfileRequest {
  id?: number;
  connectorId?: number;
  chargingProfilePurpose?: "ChargePointMaxProfile" | "TxDefaultProfile" | "TxProfile";
  stackLevel?: number;
}
