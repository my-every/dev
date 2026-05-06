export type DevicePropertyField =
  | "partNumber"
  | "description"
  | "category"
  | "referenceImage"
  | "icon";

export interface DevicePropertyRecord {
  partNumber: string;
  description: string;
  category: string;
  referenceImage: string;
  icon: string;
}
