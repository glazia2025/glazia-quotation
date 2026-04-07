export const settingsSections = [
  { key: "profileStructure", label: "Quotation Structure" },
  { key: "profileRate", label: "Profile Rate" },
  { key: "colorFinishRate", label: "Colour Finish Rate" },
  { key: "meshRate", label: "Mesh Rate" },
  { key: "glassRate", label: "Glass Rate" },
  { key: "hardwareRate", label: "Hardware" }
] as const;

export type SettingsSectionKey = (typeof settingsSections)[number]["key"];

export const defaultSettingsSection: SettingsSectionKey = "profileStructure";
