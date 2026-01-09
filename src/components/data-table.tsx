
"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Table,
} from "@tanstack/react-table"

import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "./ui/skeleton"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[],
  filterPlaceholder: string,
  isLoading?: boolean,
  children?: (table: Table<TData>) => React.ReactNode,
  globalFilterFn?: FilterFn<TData>,
  meta?: any;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterPlaceholder,
  isLoading = false,
  children,
  globalFilterFn,
  meta
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState('')


  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    globalFilterFn: globalFilterFn,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    meta: meta // Pass meta to table instance
  })

  const columnCount = table.getAllColumns().length;
  const tableRows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <Input
                placeholder={filterPlaceholder}
                value={globalFilter ?? ""}
                onChange={(event) =>
                    setGlobalFilter(event.target.value)
                }
                className="max-w-sm"
            />
             {children && children(table)}
        </div>
        <div className="rounded-md border">
        <ShadcnTable>
            <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                    return (
                    <TableHead key={header.id}>
                        {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                            )}
                    </TableHead>
                    )
                })}
                </TableRow>
            ))}
            </TableHeader>
            <TableBody>
            {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`loading-row-${i}`}>
                        {Array.from({ length: columnCount }).map((_, j) => (
                             <TableCell key={`loading-cell-${i}-${j}`}>
                                <Skeleton className="h-6" />
                             </TableCell>
                        ))}
                    </TableRow>
                ))
            ) : tableRows?.length ? (
                tableRows.map((row) => (
                <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                >
                    {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                    ))}
                </TableRow>
                ))
            ) : (
                <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                    No hay resultados.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </ShadcnTable>
        </div>
        <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} de {table.getFilteredRowModel().rows.length} fila(s) seleccionadas.
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                >
                Anterior
                </Button>
                <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                >
                Siguiente
                </Button>
            </div>
        </div>
    </div>
  )
}

