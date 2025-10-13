/* Auto-generated from StartTransactionResponse.json, do not edit manually */

export interface StartTransactionResponse {
  idTagInfo: {
    expiryDate?: string;
    parentIdTag?: string;
    status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx";
  };
  transactionId: number | string;
}
