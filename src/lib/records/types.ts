export type ServiceType = "transport" | "daycare";

export interface FeeAccountRecordRow {
  feeAccountId: string;
  studentId: string;
  studentFullName: string;
  studentAdmissionNo: string;
  classSection: string;
  branchCode: string;
  branchName: string;
  serviceType: ServiceType;
  totalReceivablePaise: bigint;
  collectedPaise: bigint;
  pendingPaise: bigint;
  dueDate: string;
  startsOn: string;
  endsOn: string;
  lastPaidOn: string | null;
  status: "active" | "discontinued";
  routeName: string | null;
  pickupPoint: string | null;
  slot: string | null;
}
