import type { PaginationMeta } from '../types/http';

export function getPagination(page: number, limit: number): { page: number; limit: number; skip: number } {
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
