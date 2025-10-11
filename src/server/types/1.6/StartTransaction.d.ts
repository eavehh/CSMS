/* Auto-generated from StartTransaction.json, do not edit manually */

export interface StartTransactionRequest {
  connectorId: number;
  idTag: string;
  meterStart: number;
  reservationId?: number;
  timestamp: string;
}

// Расширение стандартного интерфейса для кастомных полей
interface StartTransactionRequest {
  limitType?: 'percentage' | 'amount' | 'full';  // Кастомное: тип лимита
  limitValue?: number;  // Значение лимита (80 для %, 10 для суммы)
  tariffPerKWh?: number;  // Тариф для расчёта суммы
}
