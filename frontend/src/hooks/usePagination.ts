/**
 * usePagination hook.
 *
 * Manages pagination state synchronized with URL search params.
 * Using URL as the source of truth allows:
 * - Shareable/bookmarkable paginated URLs
 * - Browser back/forward navigation within pagination
 * - Server Components to pre-render the correct page
 *
 * @param defaultPageSize - Items per page (default: 20)
 */

"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  resetPagination: () => void;
}

export function usePagination(defaultPageSize = 20): UsePaginationReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? String(defaultPageSize));

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setPage = useCallback(
    (newPage: number) => updateParams({ page: String(newPage) }),
    [updateParams],
  );

  const setPageSize = useCallback(
    (size: number) => updateParams({ pageSize: String(size), page: "1" }),
    [updateParams],
  );

  const nextPage = useCallback(
    () => setPage(page + 1),
    [page, setPage],
  );

  const prevPage = useCallback(
    () => setPage(Math.max(1, page - 1)),
    [page, setPage],
  );

  const resetPagination = useCallback(
    () => updateParams({ page: "1", pageSize: String(defaultPageSize) }),
    [defaultPageSize, updateParams],
  );

  return { page, pageSize, setPage, setPageSize, nextPage, prevPage, resetPagination };
}
