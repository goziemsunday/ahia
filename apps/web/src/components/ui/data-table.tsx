"use client";

import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computePagination } from "@/lib/compute-pagination";
import { cn } from "@/lib/utils";

// Filter configuration types
interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface SingleDropdownFilter {
  type: "single-dropdown";
  columnId: string;
  label: string;
  options: FilterOption[];
  transformValue?: (value: string) => unknown;
}

interface MultiDropdownFilter {
  type: "multi-dropdown";
  label: string;
  subMenus?: boolean;
  groups: {
    columnId: string;
    label: string;
    options: FilterOption[];
    transformValue?: (value: string) => unknown;
  }[];
}

interface SearchFilter {
  type: "search";
  placeholder: string;
  searchColumns: string[];
}

export type FilterConfig =
  | SingleDropdownFilter
  | MultiDropdownFilter
  | SearchFilter;

// Action button configuration
export interface ActionButton {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?:
    | "link"
    | "outline"
    | "ghost"
    | "default"
    | "secondary"
    | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  hideOnMobile?: boolean;
  hideLabelOnMobile?: boolean;
}

// Main component props
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filters?: FilterConfig[];
  actionButtons?: ActionButton[];
  defaultSorting?: SortingState;
  defaultPagination?: PaginationState;
  paginationItemsToDisplay?: number;
  showPageSizeSelector?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: TData) => void;
  /** Total row count from the server. When provided, enables manual server-side pagination. */
  rowCount?: number;
  /** Controlled pagination state (required when using rowCount for server-side pagination). */
  pagination?: PaginationState;
  /** Pagination state setter (required when using rowCount for server-side pagination). */
  onPaginationChange?: Dispatch<SetStateAction<PaginationState>>;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

export const DataTable = <TData, TValue>({
  columns,
  data,
  filters = [],
  actionButtons = [],
  defaultSorting = [],
  defaultPagination = { pageIndex: 0, pageSize: 10 },
  paginationItemsToDisplay = 5,
  showPageSizeSelector = false,
  emptyMessage = "No results.",
  className,
  onRowClick,
  rowCount,
  pagination: controlledPagination,
  onPaginationChange: setControlledPagination,
}: DataTableProps<TData, TValue>) => {
  const isServerSide = rowCount !== undefined;

  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [internalPagination, setInternalPagination] =
    useState<PaginationState>(defaultPagination);

  const pagination = isServerSide
    ? (controlledPagination ?? defaultPagination)
    : internalPagination;

  // For tracking active filters for all dropdown types
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {},
  );

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
    enableMultiSort: false,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getPaginationRowModel: isServerSide ? undefined : getPaginationRowModel(),
    manualPagination: isServerSide,
    rowCount: isServerSide ? rowCount : undefined,
    onPaginationChange: isServerSide
      ? setControlledPagination
      : setInternalPagination,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchFilter = filters.find((f) => f.type === "search");

      if (!searchFilter) return true;

      const searchValue = (filterValue as string).toLowerCase();

      return searchFilter.searchColumns.some((column) => {
        const value = row.getValue(column);
        return (value as string)?.toLowerCase().includes(searchValue);
      });
    },
    state: {
      sorting,
      columnFilters,
      pagination,
      globalFilter,
    },
  });

  const handleFilterToggle = (
    columnId: string,
    selectedValue: string,
    transformValue?: (value: string) => unknown,
  ) => {
    const currentValues = activeFilters[columnId] ?? [];
    const hasValue = currentValues.includes(selectedValue);
    const nextValues = hasValue
      ? currentValues.filter((value) => value !== selectedValue)
      : [...currentValues, selectedValue];

    setActiveFilters((prev) => ({
      ...prev,
      [columnId]: nextValues,
    }));

    setColumnFilters((prev) => {
      const otherFilters = prev.filter((f) => f.id !== columnId);

      if (nextValues.length === 0) {
        return otherFilters;
      }

      const filterValue = transformValue
        ? nextValues.map((value) => transformValue(value))
        : nextValues;

      return [
        ...otherFilters,
        {
          id: columnId,
          value: filterValue,
        },
      ];
    });
  };

  const searchFilter = filters.find((f) => f.type === "search");
  const singleDropdownFilters = filters.filter(
    (f) => f.type === "single-dropdown",
  );
  const multiDropdownFilters = filters.filter(
    (f) => f.type === "multi-dropdown",
  );

  const { pages, showLeftEllipsis, showRightEllipsis } = computePagination({
    currentPage:
      (isServerSide
        ? (controlledPagination ?? defaultPagination)
        : internalPagination
      ).pageIndex + 1,
    totalPages: table.getPageCount(),
    paginationItemsToDisplay,
  });

  const currentPagination = table.getState().pagination;

  // Determine if page size selector should be shown
  const shouldShowPageSizeSelector =
    showPageSizeSelector &&
    DEFAULT_PAGE_SIZE_OPTIONS.includes(currentPagination.pageSize);

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {/* Toolbar */}
      {(searchFilter ||
        singleDropdownFilters.length > 0 ||
        multiDropdownFilters.length > 0 ||
        actionButtons.length > 0) && (
        <div className="flex items-center gap-2">
          {/* Search Input */}
          {searchFilter && (
            <Input
              className="h-8 max-w-72 rounded-md"
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchFilter.placeholder}
              value={globalFilter}
            />
          )}

          {/* Single Dropdown Filters */}
          {singleDropdownFilters.map((filter) => (
            <DropdownMenu key={`single-filter-${filter.columnId}`}>
              <DropdownMenuTrigger
                render={
                  <Button size="sm" variant="outline">
                    <HugeiconsIcon icon={FilterIcon} className="size-4" />
                    <span className="hidden md:inline-block">
                      {filter.label}
                    </span>
                    {(activeFilters[filter.columnId]?.length ?? 0) > 0 && (
                      <span className="border-primary-600/50 bg-primary-600/20 text-primary-600 rounded border px-1 text-xs transition-all duration-300 md:ml-2">
                        {activeFilters[filter.columnId]?.length}
                      </span>
                    )}
                  </Button>
                }
              />

              <DropdownMenuContent
                align="start"
                className="min-w-36"
                side="bottom"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    Filter by {filter.label}
                  </DropdownMenuLabel>
                  {filter.options.map((option) => (
                    <DropdownMenuCheckboxItem
                      checked={(activeFilters[filter.columnId] ?? []).includes(
                        option.value,
                      )}
                      className="group"
                      closeOnClick={false}
                      disabled={option.count === 0}
                      key={`${filter.columnId}-${option.value}`}
                      onCheckedChange={() =>
                        handleFilterToggle(
                          filter.columnId,
                          option.value,
                          filter.transformValue,
                        )
                      }
                    >
                      <span>{option.label}</span>
                      {option.count !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground group-focus:text-primary">
                          {option.count}
                        </span>
                      )}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}

          {/* Multi Dropdown Filters */}
          {multiDropdownFilters.map((filter, index) => {
            const activeCount = filter.groups.reduce((count, group) => {
              return count + (activeFilters[group.columnId]?.length ?? 0);
            }, 0);

            return (
              <DropdownMenu key={`multi-filter-${index}`}>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" variant="outline">
                      <HugeiconsIcon icon={FilterIcon} className="size-4" />
                      <span className="hidden md:inline-block">
                        {filter.label}
                      </span>
                      {activeCount > 0 && (
                        <span className="border-primary-600/50 bg-primary-600/20 text-primary-600 rounded border px-1 text-xs transition-all duration-300 md:ml-2">
                          {activeCount}
                        </span>
                      )}
                    </Button>
                  }
                />

                <DropdownMenuContent
                  align="start"
                  className="min-w-48"
                  side="bottom"
                >
                  {filter.subMenus ? (
                    // Sub-menu mode: each group is a nested sub-menu
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {filter.groups.map((group) => (
                        <DropdownMenuSub key={`group-${group.columnId}`}>
                          <DropdownMenuSubTrigger className="flex items-center justify-between">
                            <span>{group.label}</span>
                            {(activeFilters[group.columnId]?.length ?? 0) >
                              0 && (
                              <span className="bg-primary-600/20 text-primary-600 h-1.5 w-1.5 rounded-full" />
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {group.options.map((option) => (
                              <DropdownMenuCheckboxItem
                                checked={(
                                  activeFilters[group.columnId] ?? []
                                ).includes(option.value)}
                                className="group"
                                closeOnClick={false}
                                disabled={option.count === 0}
                                key={`${group.columnId}-${option.value}`}
                                onCheckedChange={() =>
                                  handleFilterToggle(
                                    group.columnId,
                                    option.value,
                                    group.transformValue,
                                  )
                                }
                              >
                                <span>{option.label}</span>
                                {option.count !== undefined && (
                                  <span className="ml-auto text-xs text-muted-foreground group-focus:text-primary">
                                    {option.count}
                                  </span>
                                )}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ))}
                    </DropdownMenuGroup>
                  ) : (
                    // Flat mode: checkboxes directly in the dropdown with a label per group
                    filter.groups.map((group, groupIndex) => (
                      <DropdownMenuGroup key={`group-${group.columnId}`}>
                        {groupIndex > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                        {group.options.map((option) => (
                          <DropdownMenuCheckboxItem
                            checked={(
                              activeFilters[group.columnId] ?? []
                            ).includes(option.value)}
                            className="group"
                            closeOnClick={false}
                            disabled={option.count === 0}
                            key={`${group.columnId}-${option.value}`}
                            onCheckedChange={() =>
                              handleFilterToggle(
                                group.columnId,
                                option.value,
                                group.transformValue,
                              )
                            }
                          >
                            <span>{option.label}</span>
                            {option.count !== undefined && (
                              <span className="ml-auto text-xs text-muted-foreground group-focus:text-primary">
                                {option.count}
                              </span>
                            )}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}

          {/* Action Buttons */}
          {actionButtons.map((button, index) => (
            <Button
              className={cn(
                button.hideOnMobile && "hidden sm:inline-flex",
                index === actionButtons.length - 1 && "ml-auto",
              )}
              key={`action-${index}`}
              onClick={button.onClick}
              size={button.size || "sm"}
              variant={button.variant || "default"}
            >
              {button.icon}
              <span
                className={cn(
                  button.hideLabelOnMobile && "hidden sm:inline-block",
                )}
              >
                {button.label}
              </span>
            </Button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead colSpan={header.colSpan} key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <div
                        role="columnheader"
                        className={cn(
                          header.column.getCanSort() &&
                            "group flex h-full cursor-pointer items-center justify-start gap-1 select-none",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        onKeyUp={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          className={cn(
                            "size-3.5 shrink-0 opacity-0 transition-all duration-200 group-hover:opacity-60",
                            header.column.getIsSorted() && "opacity-100",
                            header.column.getIsSorted() === "asc" &&
                              "rotate-180",
                          )}
                        />
                      </div>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className={cn(onRowClick && "cursor-pointer")}
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                  onClick={
                    onRowClick
                      ? (e: React.MouseEvent) => {
                          // Don't fire when clicking interactive elements or portaled
                          // dialogs/menus — their e.target lives in document.body but
                          // React still bubbles synthetic events up the fiber tree.
                          const target = e.target as Element;
                          if (
                            target.closest(
                              'button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="menu"], [role="dialog"], [role="alertdialog"], [role="option"], [role="listbox"]',
                            )
                          ) {
                            return;
                          }
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination - Only show when there are multiple pages */}
      {table.getPageCount() > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          {/* Page number information */}
          <p
            aria-live="polite"
            className="flex-1 text-sm whitespace-nowrap text-muted-foreground"
          >
            Page{" "}
            <span className="text-foreground">
              {currentPagination.pageIndex + 1}
            </span>{" "}
            of <span className="text-foreground">{table.getPageCount()}</span>
          </p>

          {/* Pagination buttons */}
          <div>
            <Pagination>
              <PaginationContent>
                {/* Previous page button */}
                <PaginationItem>
                  <Button
                    aria-label="Go to previous page"
                    className="disabled:pointer-events-none disabled:opacity-50"
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.previousPage()}
                    size="icon"
                    variant="outline"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                  </Button>
                </PaginationItem>

                {/* Left ellipsis (...) */}
                {showLeftEllipsis && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                {/* Page number buttons */}
                {pages.map((page) => {
                  const isActive = page === currentPagination.pageIndex + 1;
                  return (
                    <PaginationItem key={`page-${page}`}>
                      <Button
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => table.setPageIndex(page - 1)}
                        size="icon"
                        variant={isActive ? "outline" : "ghost"}
                      >
                        {page}
                      </Button>
                    </PaginationItem>
                  );
                })}

                {/* Right ellipsis (...) */}
                {showRightEllipsis && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                {/* Next page button */}
                <PaginationItem>
                  <Button
                    aria-label="Go to next page"
                    className="disabled:pointer-events-none disabled:opacity-50"
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.nextPage()}
                    size="icon"
                    variant="outline"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>

          {/* Results per page */}
          {shouldShowPageSizeSelector && (
            <div className="flex flex-1 justify-end">
              <Select
                aria-label="Results per page"
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
                value={currentPagination.pageSize.toString()}
              >
                <SelectTrigger
                  className="w-fit whitespace-nowrap"
                  id="results-per-page"
                >
                  <SelectValue placeholder="Select number of results" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_PAGE_SIZE_OPTIONS.map((pageSize) => (
                    <SelectItem key={pageSize} value={pageSize.toString()}>
                      {pageSize} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
