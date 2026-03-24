import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue | QueryValue[]>;

export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setQueryParams = useCallback(
    (params: QueryParams, options?: { replace?: boolean; scroll?: boolean }) => {
      const current = new URLSearchParams(searchParams.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          // null/undefined — удаляем параметр
          current.delete(key);
        } else if (Array.isArray(value)) {
          // массив — удаляем старые, добавляем все новые значения
          current.delete(key);
          value.forEach((v) => {
            if (v !== null && v !== undefined) {
              current.append(key, String(v));
            }
          });
        } else {
          current.set(key, String(value));
        }
      });

      const search = current.toString();
      const newUrl = search ? `${pathname}?${search}` : pathname;

      if (options?.replace) {
        router.replace(newUrl, { scroll: options?.scroll ?? false });
      } else {
        router.push(newUrl, { scroll: options?.scroll ?? false });
      }
    },
    [router, pathname, searchParams]
  );

  const getQueryParam = useCallback(
    (key: string): string | null => searchParams.get(key),
    [searchParams]
  );

  const getQueryParamAll = useCallback(
    (key: string): string[] => searchParams.getAll(key),
    [searchParams]
  );

  const clearQueryParams = useCallback(
    (keys?: string[]) => {
      const current = new URLSearchParams(searchParams.toString());

      if (keys) {
        keys.forEach((key) => current.delete(key));
      } else {
        current.forEach((_, key) => current.delete(key));
      }

      const search = current.toString();
      const newUrl = search ? `${pathname}?${search}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return {
    setQueryParams,
    getQueryParam,
    getQueryParamAll,
    clearQueryParams,
    searchParams,
  };
}