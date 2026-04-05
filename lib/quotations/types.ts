export interface OptionWithRate {
  name: string;
  rate: number;
}

export interface HandleOption {
  name: string;
  colors: OptionWithRate[];
}

export interface Description {
  name: string;
  baseRates: number[];
  defaultHandleCount?: number;
}

export interface OptionsResponse {
  colorFinishes: OptionWithRate[];
  meshTypes: OptionWithRate[];
  glassSpecs: OptionWithRate[];
  handleOptions: HandleOption[];
}
