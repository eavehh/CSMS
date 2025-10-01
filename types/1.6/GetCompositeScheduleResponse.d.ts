/* Auto-generated from GetCompositeScheduleResponse.json, do not edit manually */

export interface GetCompositeScheduleResponse {
  status: "Accepted" | "Rejected";
  connectorId?: number;
  scheduleStart?: string;
  chargingSchedule?: {
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
}
