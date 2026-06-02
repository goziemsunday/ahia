"use client";

import { Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { format } from "date-fns";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  type ActionButton,
  DataTable,
  type FilterConfig,
} from "@/components/ui/data-table";
import {
  type AdminOrderRow,
  defaultAdminOrdersListParams,
  getAdminOrders,
} from "@/features/admin/queries";
import { queryKeys } from "@/lib/query-keys";
import { formatCurrency } from "@/lib/utils";

import { OrderDetailDialog } from "./order-detail-dialog";

type OrderStatus = "pending" | "processing" | "cancelled" | "completed";
type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

const orderStatusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  cancelled: "Cancelled",
  completed: "Completed",
};

const orderStatusVariant: Record<
  OrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  processing: "default",
  cancelled: "destructive",
  completed: "default",
};

const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

const paymentStatusVariant: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  paid: "default",
  failed: "destructive",
  refunded: "outline",
};

const columns: ColumnDef<AdminOrderRow>[] = [
  {
    accessorKey: "orderNumber",
    header: "Order #",
    cell: ({ row }) => (
      <span className="font-mono text-xs font-medium">
        {row.original.orderNumber}
      </span>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    accessorFn: (row) => row.customer?.name ?? row.email,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">
          {row.original.customer?.name ?? "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          {row.original.email}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "totalAmount",
    header: "Total",
    cell: ({ row }) => (
      <div className="font-medium">
        {formatCurrency(Number(row.original.totalAmount))}
      </div>
    ),
  },
  {
    id: "items",
    header: "Items",
    cell: ({ row }) => row.original.orderItems.length,
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: (row, _columnId, filterValue) => {
      if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
      return filterValue.includes(row.original.status);
    },
    cell: ({ row }) => {
      const status = row.original.status as OrderStatus;
      return (
        <Badge variant={orderStatusVariant[status] ?? "secondary"}>
          {orderStatusLabel[status] ?? status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "paymentStatus",
    header: "Payment",
    filterFn: (row, _columnId, filterValue) => {
      if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
      return filterValue.includes(row.original.paymentStatus);
    },
    cell: ({ row }) => {
      const status = row.original.paymentStatus as PaymentStatus;
      return (
        <Badge variant={paymentStatusVariant[status] ?? "secondary"}>
          {paymentStatusLabel[status] ?? status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => format(row.original.createdAt, "MMM d, yyyy"),
  },
];

const filters: FilterConfig[] = [
  {
    type: "search",
    placeholder: "Search orders...",
    searchColumns: ["orderNumber", "customer"],
  },
  {
    type: "multi-dropdown",
    label: "Filters",
    groups: [
      {
        columnId: "status",
        label: "Order Status",
        options: [
          { label: "Pending", value: "pending" },
          { label: "Processing", value: "processing" },
          { label: "Completed", value: "completed" },
          { label: "Cancelled", value: "cancelled" },
        ],
      },
      {
        columnId: "paymentStatus",
        label: "Payment Status",
        options: [
          { label: "Pending", value: "pending" },
          { label: "Paid", value: "paid" },
          { label: "Failed", value: "failed" },
          { label: "Refunded", value: "refunded" },
        ],
      },
    ],
  },
];

export const OrdersClient = () => {
  const [detailOrder, setDetailOrder] = useState<AdminOrderRow | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultAdminOrdersListParams.limit!,
  });

  const queryParams = {
    ...defaultAdminOrdersListParams,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminOrders(queryParams),
    queryFn: () => getAdminOrders(queryParams),
    placeholderData: keepPreviousData,
  });

  const tableData = data?.orders ?? ([] as const);

  const handleExport = () => {
    if (tableData.length === 0) return;

    const csvHeaders = [
      "Order Number",
      "Customer",
      "Email",
      "Total",
      "Items",
      "Order Status",
      "Payment Status",
      "Payment Method",
      "Date",
    ];

    const csvRows = tableData.map((o) => [
      o.orderNumber,
      o.customer?.name ?? "",
      o.email,
      o.totalAmount,
      o.orderItems.length,
      o.status,
      o.paymentStatus,
      o.paymentMethod ?? "",
      format(o.createdAt, "yyyy-MM-dd HH:mm:ss"),
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const actionButtons: ActionButton[] = [
    {
      label: "Export",
      icon: <HugeiconsIcon icon={Download04Icon} className="size-4" />,
      onClick: handleExport,
      variant: "outline" as const,
    },
  ] as const;

  return (
    <>
      <DataTable
        columns={columns}
        data={tableData}
        emptyMessage={isLoading ? "Loading orders..." : "No orders found."}
        filters={filters}
        actionButtons={actionButtons}
        rowCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        onRowClick={(row) => setDetailOrder(row)}
      />
      <OrderDetailDialog
        order={detailOrder}
        open={!!detailOrder}
        onOpenChange={(next) => {
          if (!next) setDetailOrder(null);
        }}
      />
    </>
  );
};
