/* Auto-generated from AuthorizeResponse.json, do not edit manually */

export interface AuthorizeResponse {
  idTagInfo: {
    expiryDate?: string;
    parentIdTag?: string;
    status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx";
  };
}
