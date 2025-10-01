export type ChargePointStatus =
    | 'Available'
    | 'Preparing'
    | 'Charging'
    | 'SuspendedEVSE'
    | 'SuspendedEV'
    | 'Finishing'
    | 'Reserved'
    | 'Unavailable'
    | 'Faulted';

export type AuthorizationStatus =
    | 'Accepted'
    | 'Blocked'
    | 'Expired'
    | 'Invalid'
    | 'ConcurrentTx';

export type RegistrationStatus =
    | 'Accepted'
    | 'Pending'
    | 'Rejected';


export interface CallMessage {
    0: 2; // MessageTypeId
    1: string; // UniqueId
    2: string; // Action
    3: any; // Payload
}

export interface CallResultMessage {
    0: 3; // MessageTypeId
    1: string; // UniqueId
    2: any; // Payload
}

export interface CallErrorMessage {
    0: 4; // MessageTypeId
    1: string; // UniqueId
    2: string; // ErrorCode
    3: string; // ErrorDescription
    4?: any; // ErrorDetails
}