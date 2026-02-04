import { useState, useMemo } from 'react';

export interface UsePaginationProps {
    defaultPage?: number;
    defaultPageSize?: number;
}

export interface UsePaginationReturn {
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (pageSize: number) => void;
    range: [number, number]; // [from, to] for Supabase
    reset: () => void;
}

export function usePagination({ defaultPage = 1, defaultPageSize = 25 }: UsePaginationProps = {}): UsePaginationReturn {
    const [page, setPage] = useState(defaultPage);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    const range = useMemo<[number, number]>(() => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        return [from, to];
    }, [page, pageSize]);

    const reset = () => setPage(1);

    return {
        page,
        setPage,
        pageSize,
        setPageSize,
        range,
        reset,
    };
}
