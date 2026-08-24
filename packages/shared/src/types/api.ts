export interface ApiResponse<T> {
  data: T;
  success: true;
}

export interface ApiError {
  message: string;
  error: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
