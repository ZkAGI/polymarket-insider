"use client";

import { useState } from "react";

export type TradeSide = "BUY" | "SELL";
export type TradeOutcome = "YES" | "NO";

export interface WalletTrade {
  id: string;
  timestamp: Date;
  marketId: string;
  marketTitle: string;
  outcome: TradeOutcome;
  side: TradeSide;
  size: number; // in USD
  price: number; // probability (0-1)
  shares: number;
  fee: number;
  txHash: string;
  profitLoss?: number; // for resolved markets
}

export type SortField = "timestamp" | "size" | "price" | "profitLoss";
export type SortDirection = "asc" | "desc";

export interface WalletTradingHistoryTableProps {
  trades: WalletTrade[];
  totalCount: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSort?: (field: SortField, direction: SortDirection) => void;
  loading?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function WalletTradingHistoryTable({
  trades,
  totalCount,
  currentPage = 1,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  onSort,
  loading = false,
}: WalletTradingHistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  const handleSort = (field: SortField) => {
    const newDirection =
      sortField === field && sortDirection === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDirection(newDirection);
    onSort?.(field, newDirection);
  };

  const toggleRowExpansion = (tradeId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(tradeId)) {
        next.delete(tradeId);
      } else {
        next.add(tradeId);
      }
      return next;
    });
  };

  const formatPrice = (price: number) => {
    return `${(price * 100).toFixed(1)}%`;
  };

  const formatUSD = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(2)}K`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return "Just now";
  };

  const formatFullTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg className="w-4 h-4 ml-1 text-blue-500" fill="none" viewBox="0 0 24 24">
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-blue-500" fill="none" viewBox="0 0 24 24">
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Trading History
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {totalCount} total trades
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="trading-history-table">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="w-8 px-4 py-3"></th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("timestamp")}
              >
                <div className="flex items-center">
                  Time
                  <SortIcon field="timestamp" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Market
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Outcome
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Side
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("size")}
              >
                <div className="flex items-center justify-end">
                  Size
                  <SortIcon field="size" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("price")}
              >
                <div className="flex items-center justify-end">
                  Price
                  <SortIcon field="price" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("profitLoss")}
              >
                <div className="flex items-center justify-end">
                  P&amp;L
                  <SortIcon field="profitLoss" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-500 dark:text-gray-400">
                      Loading trades...
                    </span>
                  </div>
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No trades found
                </td>
              </tr>
            ) : (
              trades.map((trade) => {
                const isExpanded = expandedRows.has(trade.id);
                return (
                  <>
                    <tr
                      key={trade.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      data-testid={`trade-row-${trade.id}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRowExpansion(trade.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          data-testid={`expand-button-${trade.id}`}
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        <div title={formatFullTimestamp(trade.timestamp)}>
                          {formatTimestamp(trade.timestamp)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        <a
                          href={`/market/${trade.marketId}`}
                          className="hover:underline hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {trade.marketTitle}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            trade.outcome === "YES"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {trade.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            trade.side === "BUY"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          }`}
                        >
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white whitespace-nowrap font-medium">
                        {formatUSD(trade.size)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white whitespace-nowrap">
                        {formatPrice(trade.price)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                        {trade.profitLoss !== undefined ? (
                          <span
                            className={`font-medium ${
                              trade.profitLoss > 0
                                ? "text-green-600 dark:text-green-400"
                                : trade.profitLoss < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {trade.profitLoss > 0 ? "+" : ""}
                            {formatUSD(trade.profitLoss)}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr
                        key={`${trade.id}-details`}
                        className="bg-gray-50 dark:bg-gray-900"
                        data-testid={`trade-details-${trade.id}`}
                      >
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Shares:</span>
                              <div className="mt-1 font-medium text-gray-900 dark:text-white">
                                {trade.shares.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Fee:</span>
                              <div className="mt-1 font-medium text-gray-900 dark:text-white">
                                {formatUSD(trade.fee)}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-500 dark:text-gray-400">
                                Transaction:
                              </span>
                              <div className="mt-1 font-mono text-xs text-gray-900 dark:text-white truncate">
                                <a
                                  href={`https://polygonscan.com/tx/${trade.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                  {trade.txHash}
                                </a>
                              </div>
                            </div>
                            <div className="col-span-2 md:col-span-4">
                              <span className="text-gray-500 dark:text-gray-400">
                                Full Timestamp:
                              </span>
                              <div className="mt-1 font-medium text-gray-900 dark:text-white">
                                {formatFullTimestamp(trade.timestamp)}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            data-testid="page-size-selector"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {startIndex}-{endIndex} of {totalCount}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange?.(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
            data-testid="first-page-button"
          >
            First
          </button>
          <button
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
            data-testid="prev-page-button"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
            data-testid="next-page-button"
          >
            Next
          </button>
          <button
            onClick={() => onPageChange?.(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
            data-testid="last-page-button"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
