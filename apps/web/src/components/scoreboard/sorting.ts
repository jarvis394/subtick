import {
  type ColumnDef,
  type ColumnSort,
  createTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import { useState } from 'react'
import { type Column, OVERVIEW, type Player, SORTABLE } from './columns'

export type View = 'overview' | 'detailed'

const toDef = (c: Column): ColumnDef<Player> => ({
  id: c.id,
  accessorFn: (p) => c.value(p) ?? undefined,
  sortUndefined: 'last',
  invertSorting: c.inverse,
})

const DEFS: Record<View, ColumnDef<Player>[]> = {
  overview: OVERVIEW.map(toDef),
  detailed: SORTABLE.map(toDef),
}

const DEFAULT_SORT: Record<View, ColumnSort> = {
  overview: { id: 'impact', desc: true },
  detailed: { id: 'rating', desc: true },
}

/**
 * TanStack's sorted row model as a pure function. `useReactTable` mutates one table object, which
 * React Compiler can't memoize, so the sort state lives in React and the table is rebuilt from it.
 */
export const sortPlayers = (players: Player[], view: View, sort: ColumnSort) => {
  const table = createTable<Player>({
    data: players,
    columns: DEFS[view],
    state: {},
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  table.setOptions((prev) => ({ ...prev, state: { ...table.initialState, sorting: [sort] } }))

  return table.getRowModel().rows.map((r) => r.original)
}

type Direction = false | 'asc' | 'desc'

/** Players in the view's sort order; a header click sorts by it, best first, then flips. */
export const useScoreboardSorting = (players: Player[], view: View) => {
  const [sorts, setSorts] = useState(DEFAULT_SORT)
  const sort = sorts[view]

  const toggleSort = (id: string) =>
    setSorts((all) => ({
      ...all,
      [view]: { id, desc: all[view].id === id ? !all[view].desc : true },
    }))

  return {
    rows: sortPlayers(players, view, sort),
    sortOf: (id: string): Direction => (sort.id === id ? (sort.desc ? 'desc' : 'asc') : false),
    toggleSort,
  }
}
