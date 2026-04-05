export interface ApiListResponse<T> {
  data: T[];
  total: number;
}

export interface TimelineEntry {
  id: string;
  title: string;
  by: string;
  at: string;
  description: string;
}
