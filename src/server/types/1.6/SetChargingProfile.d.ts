/* Auto-generated from SetChargingProfile.json, do not edit manually */

export interface SetChargingProfileRequest {
  connectorId: number;
  csChargingProfiles: {
    chargingProfileId: number;
    transactionId?: number;
    stackLevel: number;
    chargingProfilePurpose: "ChargePointMaxProfile" | "TxDefaultProfile" | "TxProfile";
    chargingProfileKind: "Absolute" | "Recurring" | "Relative";
    recurrencyKind?: "Daily" | "Weekly";
    validFrom?: string;
    validTo?: string;
    chargingSchedule: {
      duration?: number;
      startSchedule?: string;
      chargingRateUnit: "A" | "W";
      chargingSchedulePeriod: {
        startPeriod: number;
        limit: number;
        numberPhases?: number;
      }[];
      minChargingRate?: number;
    };
  };
}
