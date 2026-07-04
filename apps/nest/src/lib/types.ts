export type SuccessRes<TData> = {
  data: TData;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ErrorRes = {
  error: {
    details: string;
  };
};
