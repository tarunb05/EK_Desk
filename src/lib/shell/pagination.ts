export interface Pagination {
  page: number;
  totalPages: number;
  offset: number;
  limit: number;
}

export function resolvePagination(
  page: number,
  pageSize: number,
  totalCount: number,
): Pagination {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const offset = (clampedPage - 1) * pageSize;

  return { page: clampedPage, totalPages, offset, limit: pageSize };
}
