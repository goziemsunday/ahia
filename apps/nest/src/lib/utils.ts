export const successResponse = <TData>(
  data: TData,
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
) => {
  return {
    data,
    ...(pagination ? { pagination } : {}),
  };
};

export const errorResponse = (error: string) => {
  return {
    error,
  };
};
