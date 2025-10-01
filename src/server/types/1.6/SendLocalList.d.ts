/* Auto-generated from SendLocalList.json, do not edit manually */

export interface SendLocalListRequest {
  listVersion: number;
  localAuthorizationList?: {
    idTag: string;
    idTagInfo?: {
      expiryDate?: string;
      parentIdTag?: string;
      status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx";
    };
  }[];
  updateType: "Differential" | "Full";
}
