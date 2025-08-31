"use client";
import React, { useMemo } from "react";
import type { Cell, ImportedItem } from "@/types";

type TimeTableProps = {
  value: Cell[][];
  onCellClick: (row: number, col: number, cell: Cell) => void;
  dayLabels?: string[];
};

const defaultDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Online"];

/** カテゴリに応じた淡い背景色（Tailwind） */
function getCategoryBg(it?: ImportedItem | null): string | null {
  if (!it || !it.category) return null;
  const s = String(it.category);
  if (/専門必修/.test(s)) return "bg-pink-100"; // 専門必修
  if (/選択必修/.test(s)) return "bg-blue-100"; // 専門選択必修
  if (/必修/.test(s) && !/専門必修/.test(s) && !/選択必修/.test(s))
    return "bg-red-100"; // 必修
  if (/専門選択/.test(s)) return "bg-teal-100"; // 専門選択
  if (/基幹共通/.test(s)) return "bg-indigo-100"; // 基幹共通
  if (/数学科非共通/.test(s)) return "bg-cyan-100"; // 数学科非共通
  if (/応用数理学科非共通/.test(s)) return "bg-cyan-100"; // 応用数理学科非共通

  return null;
}

/**
 * 縦結合（row-span）表示対応の時間割テーブル
 * - CSS Grid を手動配置（gridRow / gridColumn）で構築
 * - 連続する同一アイテム（同一 id）の縦ブロックを1つの要素として描画
 * - ブロック内クリックの Y 位置から、何限目をクリックしたかを推定して row を算出
 */
export default function TimeTable({
  value,
  onCellClick,
  dayLabels = defaultDays,
}: TimeTableProps) {
  const rows = value.length;
  const cols = value[0]?.length ?? 0;

  // 列は「左端の時限ラベル列 + 曜日列（cols）」、行は「上部ヘッダ行 + 各時限 rows」
  const gridTemplateColumns = `40px repeat(${cols}, minmax(0,1fr))`;
  const baseRowPx = 80;
  const gridTemplateRows = `40px repeat(${rows}, ${baseRowPx}px)`;

  type Block = {
    startRow: number;
    col: number;
    span: number;
    cell: NonNullable<Cell>;
  };

  const blocks: Block[] = useMemo(() => {
    const list: Block[] = [];
    for (let c = 0; c < cols; c++) {
      let r = 0;
      while (r < rows) {
        const cell = value[r][c];
        if (!cell) {
          r++;
          continue;
        }
        const isStart =
          r === 0 || !value[r - 1][c] || value[r - 1][c]?.id !== cell.id;
        if (!isStart) {
          r++;
          continue;
        }
        let span = 1;
        while (
          r + span < rows &&
          value[r + span][c] &&
          value[r + span][c]!.id === cell.id
        ) {
          span++;
        }
        list.push({ startRow: r, col: c, span, cell });
        r += span;
      }
    }
    return list;
  }, [value, rows, cols]);

  type EmptyCell = { row: number; col: number };
  const empties: EmptyCell[] = useMemo(() => {
    const occupied = new Set<string>();
    for (const b of blocks) {
      for (let k = 0; k < b.span; k++) {
        occupied.add(`${b.startRow + k},${b.col}`);
      }
    }
    const list: EmptyCell[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!value[r][c] && !occupied.has(`${r},${c}`)) {
          list.push({ row: r, col: c });
        }
      }
    }
    return list;
  }, [blocks, value, rows, cols]);

  // 空セル用の交互背景（薄グレー/白）
  const emptyBgClass = (parityKey: number) =>
    parityKey % 2 === 0 ? "bg-gray-50" : "bg-white";

  return (
    <div className="w-full max-w-none">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns, gridTemplateRows }}
      >
        {/* ヘッダ（曜日） */}
        {Array.from({ length: cols }).map((_, c) => (
          <div
            key={`head-${c}`}
            className="text-center text-[8px] sm:text-sm font-semibold flex items-center justify-center bg-gray-100 rounded-md"
            style={{ gridColumn: c + 2, gridRow: 1 }}
          >
            {dayLabels[c] ?? `D${c}`}
          </div>
        ))}

        {/* 左列：時限ラベル */}
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`period-${r}`}
            className="text-center font-semibold flex items-center justify-center bg-gray-100 rounded-md sm:text-xs"
            style={{ gridColumn: 1, gridRow: r + 2 }}
          >
            {r + 1}
          </div>
        ))}

        {/* 連結ブロック（科目あり） */}
        {blocks.map((b) => {
          const { startRow, col, span, cell } = b;
          const parity = (startRow + col) % 2;
          const catBg = getCategoryBg(cell as ImportedItem);
          const hasCustomColor = !!cell.color;

          // aria テキスト
          const aria =
            span > 1
              ? `${dayLabels[col] ?? `D${col}`} ${startRow + 1}〜${
                  startRow + span
                }限 ${cell.subject}`
              : `${dayLabels[col] ?? `D${col}`} ${startRow + 1}限 ${
                  cell.subject
                }`;

          return (
            <button
              key={`block-${startRow}-${col}`}
              className={[
                "w-full rounded-lg border transition-shadow flex items-center justify-center text-xs sm:text-sm",
                "border-gray-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer",
                // 優先度: cell.color > カテゴリ色 > デフォルト交互色
                hasCustomColor
                  ? ""
                  : catBg ?? (parity % 2 === 0 ? "bg-blue-50" : "bg-gray-100"),
              ].join(" ")}
              style={{
                gridColumn: col + 2,
                gridRow: `${startRow + 2} / span ${span}`,
                backgroundColor: hasCustomColor
                  ? (cell.color as string)
                  : undefined,
              }}
              title={aria}
              aria-label={aria}
              onClick={(e) => {
                const rect = (
                  e.currentTarget as HTMLButtonElement
                ).getBoundingClientRect();
                const y = e.clientY - rect.top;
                const perHeight = rect.height / span;
                const offset = Math.min(
                  span - 1,
                  Math.max(0, Math.floor(y / Math.max(1, perHeight)))
                );
                const targetRow = startRow + offset;
                onCellClick(targetRow, col, cell);
              }}
            >
              <div className="px-2 text-center leading-tight py-1">
                <div className="text-[8px] lg:text-[12px] font-medium">
                  {cell.subject}
                </div>
                {cell.room && (
                  <div className="opacity-80 text-[11px]">{cell.room}</div>
                )}
              </div>
            </button>
          );
        })}

        {/* 空きマス（プレースホルダ） */}
        {empties.map(({ row, col }) => {
          const parity = (row + col) % 2;
          return (
            <div
              key={`empty-${row}-${col}`}
              className={[
                "w-full rounded-lg border flex items-center justify-center text-[11px]",
                "border-dashed border-gray-200",
                emptyBgClass(parity),
              ].join(" ")}
              style={{ gridColumn: col + 2, gridRow: row + 2 }}
              title="空き"
              aria-label={`${dayLabels[col] ?? `D${col}`}${row + 1}限 空き`}
            />
          );
        })}
      </div>
    </div>
  );
}
