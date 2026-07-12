export type WindowKey = "24h" | "7d" | "1m";

export type Window = {
  key: WindowKey;
  ms: number;
};

export type WindowBoundaries = {
  currentStart: Date;
  previousStart: Date;
};

export type OverallStats = {
  revenue: {
    value: Record<WindowKey, number>;
    changePct: Record<WindowKey, number>;
  };
  orders: {
    value: Record<WindowKey, number>;
    changePct: Record<WindowKey, number>;
  };
  products: {
    value: {
      total: number;
    };
    changePct: Record<WindowKey, number>;
  };
  users: {
    value: {
      total: number;
    };
    change: Record<WindowKey, number>;
  };
};

export type MonthlyStats = {
  month: string;
  revenue: number;
  orders: number;
  products: number;
  users: number;
};
