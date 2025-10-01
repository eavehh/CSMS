/* Auto-generated from StopTransactionResponse.json, do not edit manually */

export interface StopTransactionResponse {
  idTagInfo?: {
    expiryDate?: string;
    parentIdTag?: string;
    status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx";
  };
}
