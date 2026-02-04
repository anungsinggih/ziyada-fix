import React from 'react';
import { Button } from './Button';
import { Icons } from './Icons';

interface PaginationProps {
    currentPage: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
    className?: string;
}

export function Pagination({
    currentPage,
    totalCount,
    pageSize,
    onPageChange,
    isLoading = false,
    className = ''
}: PaginationProps) {
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNext = currentPage < totalPages;
    const hasPrev = currentPage > 1;

    // Don't render anything if there's no data or only 1 page
    if (totalCount === 0 || (totalPages <= 1 && totalCount <= pageSize)) {
        return null;
    }

    const handlePrev = () => {
        if (hasPrev) onPageChange(currentPage - 1);
    };

    const handleNext = () => {
        if (hasNext) onPageChange(currentPage + 1);
    };

    return (
        <div className={`flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 ${className}`}>
            <div className="flex flex-1 justify-between sm:hidden">
                <Button
                    variant="outline"
                    onClick={handlePrev}
                    disabled={!hasPrev || isLoading}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    onClick={handleNext}
                    disabled={!hasNext || isLoading}
                >
                    Next
                </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                        <span className="font-medium">
                            {Math.min(currentPage * pageSize, totalCount)}
                        </span>{' '}
                        of <span className="font-medium">{totalCount}</span> results
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrev}
                        disabled={!hasPrev || isLoading}
                        icon={<Icons.ChevronLeft className="w-4 h-4" />}
                    >
                        Previous
                    </Button>
                    <div className="flex items-center px-4 font-medium text-sm text-gray-700 bg-white border border-gray-300 rounded-md">
                        Page {currentPage} of {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNext}
                        disabled={!hasNext || isLoading}
                        className="flex-row-reverse" // Flip icon to right
                    >
                        Next
                        <Icons.ChevronRight className="w-4 h-4 ml-2 mr-0" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
