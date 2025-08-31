"use client";
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { Group, SegmentedControl, Text, Button, Tooltip } from "@mantine/core";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import TimeTable from "@/components/TimeTable";
import ImportTable from "@/components/ImportTable";
import CreditsProgress from "@/components/CreditsProgress";
import DeptPicker, { type DeptOption } from "@/components/DeptPicker";
import YearPicker from "@/components/YearPicker";
import type { Cell, ImportedItem, Term } from "@/types";

/** 行(時限)数 / 列(曜日)数 */
const ROWS = 7;
const COLS = 7;

/** 学科リスト（必要に応じて追記/修正） */
const DEPTS: DeptOption[] = [
  { label: "数学科", value: "math", csv: "/csv/math.csv" },
  { label: "応用数理学科", value: "apmath", csv: "/csv/apmath.csv" },
  { label: "機械科学・航空宇宙学科", value: "mech", csv: "/csv/mech.csv" },
  { label: "電子物理システム学科", value: "ep", csv: "/csv/ep.csv" },
  { label: "情報理工学科", value: "cs", csv: "/csv/cs.csv" },
  { label: "情報通信学科", value: "ict", csv: "/csv/ict.csv" },
  { label: "表現工学科", value: "design", csv: "/csv/design.csv" },
];

/* ========================= CSV パーサ ========================= */
function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (q) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        q = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') q = true;
      else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        out.push(row);
        row = [];
        field = "";
      } else if (ch !== "\r") {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ========================= 正規化ユーティリティ ========================= */
const dayMap = new Map<string, number>([
  ["0", 0],
  ["1", 1],
  ["2", 2],
  ["3", 3],
  ["4", 4],
  ["5", 5],
  ["6", 6],
  ["mon", 0],
  ["tue", 1],
  ["wed", 2],
  ["thu", 3],
  ["fri", 4],
  ["sat", 5],
  ["sun", 6],
  ["monday", 0],
  ["tuesday", 1],
  ["wednesday", 2],
  ["thursday", 3],
  ["friday", 4],
  ["saturday", 5],
  ["sunday", 6],
  ["月", 0],
  ["火", 1],
  ["水", 2],
  ["木", 3],
  ["金", 4],
  ["土", 5],
  ["日", 6],
]);
function toDayIndex(v: string): number | null {
  const k = v.trim().toLowerCase();
  if (dayMap.has(k)) return dayMap.get(k)!;
  if (k.startsWith("月")) return 0;
  if (k.startsWith("火")) return 1;
  if (k.startsWith("水")) return 2;
  if (k.startsWith("木")) return 3;
  if (k.startsWith("金")) return 4;
  if (k.startsWith("土")) return 5;
  if (k.startsWith("日") || k.startsWith("sun")) return 6; // オンライン列
  const n = Number(k);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
}
function toYear(v: string | undefined): 2 | 3 | 4 | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return n === 2 || n === 3 || n === 4 ? (n as 2 | 3 | 4) : undefined;
}
/** term 複数対応（未指定は両表示扱い） */
function parseTerms(v: string | undefined): Term[] | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  const YEAR = new Set([
    "both",
    "all",
    "year",
    "fullyear",
    "通年",
    "前後期",
    "年間",
    "s+f",
    "s/f",
    "sf",
    "spring+fall",
    "spring/fall",
  ]);
  if (YEAR.has(s)) return ["spring", "fall"];
  const tokens = s
    .replace(/（|）/g, "")
    .split(/[,\s/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = new Set<Term>();
  for (const t of tokens) {
    if (["spring", "s", "spr", "ss", "前期", "春"].includes(t))
      out.add("spring");
    if (["fall", "f", "aw", "autumn", "後期", "秋"].includes(t))
      out.add("fall");
  }
  return out.size ? Array.from(out) : undefined;
}
/** 全角→半角（数字/記号の最小セット） */
const toHalfWidth = (s: string) =>
  s.replace(/[０-９－～〜，、・]/g, (ch) =>
    "０１２３４５６７８９".includes(ch)
      ? String("０１２３４５６７８９".indexOf(ch))
      : ch === "－"
      ? "-"
      : ch === "～" || ch === "〜"
      ? "~"
      : ch === "，" || ch === "、" || ch === "・"
      ? ","
      : ch
  );
/** "1,3,5"/"2-4"/"2〜4" を配列に。範囲展開、1..ROWS 以外は除外 */
function parsePeriods(raw: string): number[] {
  const s = toHalfWidth(String(raw ?? "")).trim();
  if (!s) return [];
  const parts = s.split(/[, ]+/).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*[-~]\s*(\d+)$/);
    if (m) {
      const a = Number(m[1]),
        b = Number(m[2]);
      if (Number.isInteger(a) && Number.isInteger(b)) {
        const lo = Math.min(a, b),
          hi = Math.max(a, b);
        for (let x = lo; x <= hi; x++) out.push(x);
      }
      continue;
    }
    const n = Number(p);
    if (Number.isInteger(n)) out.push(n);
  }
  return Array.from(new Set(out.filter((n) => n >= 1 && n <= ROWS))).sort(
    (a, b) => a - b
  );
}

/* ========================= グリッド初期化 ========================= */
const keyOf = (year: 2 | 3 | 4, term: Term) => `${year}-${term}` as const;
const emptyGrid = (): Cell[][] =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));

/* ========================= 配置状態判定 ========================= */
function isFullyPlaced(item: ImportedItem, grid: Cell[][]) {
  return item.period.every((p) => {
    const r = p - 1;
    const c = item.day;
    const cell = grid[r]?.[c];
    return !!cell && cell.id === item.id;
  });
}

/* ========================= 補助：ユニーク配置アイテムの収集 ========================= */
function collectPlacedUniqueItems(tables: Record<string, Cell[][]>) {
  const seen = new Set<string>();
  const out: ImportedItem[] = [];
  Object.values(tables).forEach((table) => {
    for (let r = 0; r < table.length; r++) {
      for (let c = 0; c < table[0].length; c++) {
        const cell = table[r][c];
        if (cell && !seen.has(cell.id)) {
          seen.add(cell.id);
          out.push(cell);
        }
      }
    }
  });
  return out;
}

/* ========================= 必修判定 ========================= */
function isRequired(it: ImportedItem): boolean {
  const s = String(it.category ?? "");
  if (/選択必修/.test(s)) return false; // 「専門選択必修」は除外
  return /専門必修/.test(s) || /必修/.test(s); // 「専門必修」や「必修」を true
}

/* ========================= 学科別 必要単位 (credits) ========================= */
type DeptCredits = {
  専門選択必修: number;
  専門選択: number;
  基幹共通上限: number;
};

/* ===== dept 要件 JSON の型安全な読み込みユーティリティ ===== */
type CreditsShape = {
  専門選択必修?: number;
  専門選択?: number;
  基幹共通?: number;
};
type DeptCreditsFile =
  | {
      credits?: CreditsShape;
      基幹共通上限?: number;
      foundation?: { max?: number };
    }
  | CreditsShape;
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function normalizeDeptCredits(input: unknown): {
  credits: CreditsShape;
  foundationMax: number;
} {
  if (!isRecord(input)) return { credits: {}, foundationMax: 0 };

  const credits: CreditsShape = isRecord(
    (input as Record<string, unknown>).credits
  )
    ? ((input as { credits: CreditsShape }).credits as CreditsShape)
    : (input as CreditsShape);

  let foundationMax = 0;
  if (typeof (input as Record<string, unknown>)["基幹共通上限"] === "number") {
    foundationMax = (input as Record<string, unknown>)[
      "基幹共通上限"
    ] as number;
  } else if (
    isRecord((input as Record<string, unknown>).foundation) &&
    typeof (input as { foundation: { max?: unknown } }).foundation.max ===
      "number"
  ) {
    foundationMax =
      (input as { foundation: { max?: number } }).foundation.max ?? 0;
  }

  return { credits, foundationMax };
}

/* ========================= ページ本体 ========================= */
function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** 学科 state（DeptPicker 用） */
  const [dept, setDept] = useState<string>(
    searchParams.get("dept") ?? DEPTS[0].value
  );
  const csvPath = useMemo(
    () => DEPTS.find((d) => d.value === dept)?.csv ?? "/csv/apmath.csv",
    [dept]
  );

  /** 学年・学期 */
  const initialYear = ((): 2 | 3 | 4 => {
    const y = Number(searchParams.get("year"));
    return y === 3 || y === 4 ? (y as 3 | 4) : 2;
  })();
  const initialTerm = ((): Term => {
    const t = searchParams.get("term");
    return t === "fall" ? "fall" : "spring";
  })();

  const [year, setYear] = useState<2 | 3 | 4>(initialYear);
  const [term, setTerm] = useState<Term>(initialTerm);

  /** すべてのアイテム（CSV 起源） */
  const [items, setItems] = useState<ImportedItem[]>([]);

  /** 学年×学期ごとのテーブル辞書（学科切替時にリセット） */
  const makeTables = () => ({
    [keyOf(2, "spring")]: emptyGrid(),
    [keyOf(2, "fall")]: emptyGrid(),
    [keyOf(3, "spring")]: emptyGrid(),
    [keyOf(3, "fall")]: emptyGrid(),
    [keyOf(4, "spring")]: emptyGrid(),
    [keyOf(4, "fall")]: emptyGrid(),
  });
  const [tables, setTables] = useState<Record<string, Cell[][]>>(makeTables);

  const curKey = keyOf(year, term);
  const grid = tables[curKey];

  /** 学科 CSV の読み込み（dept 変更ごと・初回） */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(csvPath, { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) setItems([]);
        return;
      }
      const raw = parseCSV(await res.text());
      if (!raw.length) {
        if (!cancelled) setItems([]);
        return;
      }

      const aliases: Record<string, string> = {
        day: "day",
        曜日: "day",
        period: "period",
        時限: "period",
        subject: "subject",
        科目: "subject",
        科目名: "subject",
        room: "room",
        教室: "room",
        teacher: "teacher",
        担当教員: "teacher",
        color: "color",
        色: "color",
        year: "year",
        学年: "year",
        term: "term",
        学期: "term",
        credits: "credits",
        単位: "credits",
        category: "category",
        区分: "category",
        カテゴリ: "category",
        種別: "category",
        url: "url",
        URL: "url",
        リンク: "url",
        syllabus: "url",
      };
      const header = raw[0].map(
        (h) => aliases[String(h).trim()] ?? String(h).trim()
      );
      const col = (n: string) => header.findIndex((h) => h === n);

      const iDay = col("day"),
        iPer = col("period"),
        iSub = col("subject");
      const iRoom = col("room"),
        iTeacher = col("teacher"),
        iColor = col("color");
      const iYear = col("year"),
        iTerm = col("term");
      const iCredits = col("credits"),
        iCategory = col("category");
      const iUrl = col("url");

      const list: ImportedItem[] = [];
      for (let r = 1; r < raw.length; r++) {
        const row = raw[r] ?? [];
        const day = toDayIndex(String(row[iDay] ?? ""));
        const periods = parsePeriods(String(row[iPer] ?? ""));
        const subject = String(row[iSub] ?? "").trim();
        if (day === null || periods.length === 0 || !subject) continue;

        const yr = iYear >= 0 ? toYear(String(row[iYear] ?? "")) : undefined;
        const tm =
          iTerm >= 0 ? parseTerms(String(row[iTerm] ?? "")) : undefined;

        list.push({
          id: `${dept}-${r}-${day}-${periods.join("_")}-${subject}-${
            yr ?? "x"
          }-${tm ? tm.join("") : "x"}`,
          day,
          period: periods,
          subject,
          room: iRoom >= 0 ? String(row[iRoom] ?? "") : undefined,
          teacher: iTeacher >= 0 ? String(row[iTeacher] ?? "") : undefined,
          color: iColor >= 0 ? String(row[iColor] ?? "") : undefined,
          year: yr,
          term: tm, // 配列（未指定は両学期表示）
          credits:
            iCredits >= 0 ? Number(row[iCredits]) || undefined : undefined,
          category: iCategory >= 0 ? String(row[iCategory] ?? "") : undefined,
          url:
            iUrl >= 0 ? String(row[iUrl] ?? "").trim() || undefined : undefined,
        });
      }
      if (!cancelled) {
        setItems(list);
        // 学科を変えたときは配置をリセット（学科ごとに別時間割）
        setTables(makeTables());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [csvPath, dept]);

  /** 現在ビュー（学年・学期条件に合う/指定なしも含む） */
  const viewItems = useMemo(
    () =>
      items.filter(
        (it) =>
          (it.year === undefined || it.year === year) &&
          (it.term === undefined || it.term.includes(term))
      ),
    [items, year, term]
  );

  /** checkedIds：全時限配置済みをチェック済み扱い */
  const checkedIds = useMemo(() => {
    const s = new Set<string>();
    for (const it of viewItems) if (isFullyPlaced(it, grid)) s.add(it.id);
    return s;
  }, [viewItems, grid]);

  /** 専門必修のID集合（UI 無効化用） */
  const disabledIds = useMemo(() => {
    const s = new Set<string>();
    for (const it of viewItems) if (isRequired(it)) s.add(it.id);
    return s;
  }, [viewItems]);

  /* ========================= termまたぎ CRUD ========================= */
  const keysForItem = useCallback(
    (item: ImportedItem): string[] => {
      const terms: Term[] =
        item.term && item.term.length > 0
          ? Array.from(new Set(item.term))
          : ["spring", "fall"];

      // 配置先の学年は item.year を最優先。未指定のみ現在表示中の year。
      const years: (2 | 3 | 4)[] = item.year ? [item.year] : [year];

      const keys: string[] = [];
      for (const y of years) {
        for (const t of terms) {
          keys.push(keyOf(y, t));
        }
      }
      return keys;
    },
    [year]
  );

  const removeByIdAcrossKeys = useCallback(
    (targetId: string, keys: string[]) => {
      setTables((prev) => {
        let changed = false;
        const next: Record<string, Cell[][]> = { ...prev };
        for (const k of keys) {
          const table = next[k];
          if (!table) continue;
          let localChanged = false;
          const newTable = table.map((row) =>
            row.map((cell) => {
              if (cell && cell.id === targetId) {
                localChanged = true;
                return null;
              }
              return cell;
            })
          );
          if (localChanged) {
            next[k] = newTable;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    []
  );

  const placeAllAcrossKeys = useCallback(
    (
      item: ImportedItem,
      {
        replace = false,
        clean = false,
      }: { replace?: boolean; clean?: boolean } = {}
    ) => {
      const targetKeys = keysForItem(item);
      setTables((prev) => {
        let conflict = false;
        const next: Record<string, Cell[][]> = { ...prev };

        if (!replace) {
          for (const k of targetKeys) {
            const table = next[k];
            if (!table) continue;
            for (const p of item.period) {
              const r = p - 1;
              const c = item.day;
              const cell = table[r]?.[c];
              if (cell && cell.id !== item.id) {
                conflict = true;
                break;
              }
            }
            if (conflict) break;
          }
          if (conflict) return prev;
        }

        for (const k of targetKeys) {
          const table = next[k] ?? emptyGrid();
          const base = clean
            ? table.map((row) =>
                row.map((cell) => (cell && cell.id === item.id ? null : cell))
              )
            : table;
          const newTable = base.map((row) => row.slice());
          for (const p of item.period) {
            const r = p - 1;
            const c = item.day;
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) newTable[r][c] = item;
          }
          next[k] = newTable;
        }
        return next;
      });
    },
    [keysForItem]
  );

  /* ========================= ビュー切替時：専門必修は自動配置 ========================= */
  useEffect(() => {
    for (const it of viewItems) {
      if (isRequired(it) && !isFullyPlaced(it, grid)) {
        placeAllAcrossKeys(it, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, term, viewItems]);

  /* ========================= UI ハンドラ ========================= */
  const handleToggle = useCallback(
    (id: string) => {
      const item = viewItems.find((i) => i.id === id);
      if (!item) return;

      if (isRequired(item)) {
        if (!isFullyPlaced(item, grid))
          placeAllAcrossKeys(item, { replace: true });
        return; // 必修は外せない
      }

      const fully = isFullyPlaced(item, grid);
      if (!fully) {
        let conflict = false;
        for (const p of item.period) {
          const r = p - 1;
          const c = item.day;
          const cell = grid[r]?.[c];
          if (cell && cell.id !== item.id) {
            conflict = true;
            break;
          }
        }
        if (conflict) {
          const ok = confirm(
            `${dayLabels[item.day]} / ${item.subject} の ${item.period.join(
              ","
            )}限の一部が重複しています。置き換えますか？`
          );
          if (!ok) return;
          placeAllAcrossKeys(item, { replace: true });
        } else {
          placeAllAcrossKeys(item);
        }
      } else {
        removeByIdAcrossKeys(item.id, keysForItem(item));
      }
    },
    [viewItems, grid, placeAllAcrossKeys, removeByIdAcrossKeys, keysForItem]
  );

  const handleCellClick = (row: number, col: number, cell: Cell) => {
    if (!cell) return;
    const it = cell as ImportedItem;
    if (isRequired(it)) return; // 必修は削除禁止
    removeByIdAcrossKeys(it.id, keysForItem(it));
  };

  /** ラベル（日本語 & 日曜=オンライン） */
  const dayLabels = useMemo(
    () => ["月", "火", "水", "木", "金", "土", "オンライン"],
    []
  );

  /** 進捗メーター用（全テーブルからユニーク集計） */
  const placedAll = useMemo(() => collectPlacedUniqueItems(tables), [tables]);

  /* ===== 学科別必要単位（credits）の読込／フォールバック（2カテゴリ＋基幹上限） ===== */
  const [deptCredits, setDeptCredits] = useState<DeptCredits>({
    専門選択必修: 20,
    専門選択: 25,
    基幹共通上限: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/requirements/${dept}.json`, {
          cache: "no-store",
        });
        if (!res.ok) return;

        const raw: unknown = await res.json();
        const { credits, foundationMax } = normalizeDeptCredits(raw);

        const next: DeptCredits = {
          専門選択必修: Number(credits.専門選択必修 ?? 20),
          専門選択: Number(credits.専門選択 ?? 25),
          基幹共通上限: Number.isFinite(foundationMax) ? foundationMax : 0,
        };

        if (!cancelled) setDeptCredits(next);
      } catch {
        /* フォールバックのまま */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dept]);

  /* ========================= URL共有: 復元（sel=comma separated IDs） ========================= */
  // 一度だけ復元を試みるためのフラグ
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    // itemsがロードされてからでないと復元できない
    if (items.length === 0) return;

    const selParam = searchParams.get("sel");
    if (!selParam) {
      restoredRef.current = true;
      return;
    }
    const ids = selParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      restoredRef.current = true;
      return;
    }

    // 対象アイテムを配置（学期指定があれば該当学期に、なければ両学期）
    for (const id of ids) {
      const it = items.find((x) => x.id === id);
      if (!it) continue;
      // 置換で強制配置（復元が確実になるように）
      placeAllAcrossKeys(it, { replace: true });
    }
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  /* ========================= URL共有: 共有URL生成＆コピー ========================= */
  const buildShareUrl = useCallback(() => {
    const url = new URL(window.location.origin + pathname);
    url.searchParams.set("dept", dept);
    url.searchParams.set("year", String(year));
    url.searchParams.set("term", term);

    // 全テーブルからユニークIDを集めて sel に入れる
    const placed = collectPlacedUniqueItems(tables);
    const ids = placed.map((it) => it.id);
    if (ids.length > 0) url.searchParams.set("sel", ids.join(","));

    // 将来の拡張用バージョン
    url.searchParams.set("v", "1");
    return url.toString();
  }, [dept, year, term, tables, pathname]);

  // 置き換え：安全なクリップボードコピー関数
  function canUseAsyncClipboard(): boolean {
    // ブラウザ & セキュアコンテキストで clipboard API があるか
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      (navigator as Navigator & { clipboard?: Clipboard }).clipboard !==
        undefined &&
      window.isSecureContext === true
    );
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (canUseAsyncClipboard()) {
        await (
          navigator as Navigator & { clipboard: Clipboard }
        ).clipboard.writeText(text);
        return true;
      }
    } catch {
      // async 失敗時はフォールバックへ
    }

    // フォールバック: 一時テキストエリア + execCommand
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  // 共有URLコピーのハンドラ
  const copyShareUrl = useCallback(async () => {
    const link = buildShareUrl();
    const ok = await copyToClipboard(link);
    if (ok) {
      alert("共有用URLをコピーしました！\n" + link);
    } else {
      // クリップボード不可の環境向けにリンクを表示
      prompt("このURLをコピーしてください:", link);
    }
  }, [buildShareUrl]);

  /* ========================= JSX ========================= */
  return (
    <div className="p-4 flex flex-col gap-6">
      {/* 進捗ドーナツ（上） */}
      <CreditsProgress
        items={placedAll}
        requirements={{
          専門選択必修: deptCredits.専門選択必修,
          専門選択: deptCredits.専門選択,
        }}
        foundationCap={deptCredits.基幹共通上限}
        title={`${DEPTS.find((d) => d.value === dept)?.label} / 卒業要件の進捗`}
        durationMs={300}
        delayMs={0}
      />

      {/* 上部セレクタ（学科 / 学年 / 学期 + 共有ボタン） */}
      <Group gap="md" align="center" className="flex-col sm:flex-row w-full">
        <DeptPicker
          width={200}
          value={dept}
          onChange={setDept}
          options={DEPTS}
        />

        <Group gap="xs" className="w-full sm:w-auto">
          <Text size="sm" c="dimmed">
            学年
          </Text>
          <YearPicker value={year} onChange={setYear} />
        </Group>

        <Group gap="xs" className="w-full sm:w-auto">
          <Text size="sm" c="dimmed">
            学期
          </Text>
          <SegmentedControl
            value={term}
            onChange={(v) => setTerm(v as Term)}
            data={[
              { label: "春学期", value: "spring" },
              { label: "秋学期", value: "fall" },
            ]}
            className="w-full sm:w-auto"
            size="xs"
            radius="md"
          />
        </Group>

        <Tooltip label="現在の状態をURLにしてコピー">
          <Button variant="light" size="xs" onClick={copyShareUrl}>
            共有リンクをコピー
          </Button>
        </Tooltip>
      </Group>

      {/* 本体：左右2カラム */}
      <div className="flex flex-col gap-6 sm:flex-row items-start">
        {/* 左：時間割 */}
        <div className="flex-1 min-w-0 w-full">
          <TimeTable
            value={tables[curKey]}
            onCellClick={handleCellClick}
            dayLabels={dayLabels}
          />
        </div>

        {/* 右：リスト */}
        <div className="w-full sm:w-1/2 shrink-0 sm:sticky sm:top-4">
          <h2 className="text-lg font-semibold mb-2">
            {DEPTS.find((d) => d.value === dept)?.label} / {year}年 /{" "}
            {term === "spring" ? "春学期" : "秋学期"}
          </h2>
          <div className="max-h-[70vh] overflow-auto ">
            <ImportTable
              items={viewItems}
              checkedIds={checkedIds}
              onToggle={handleToggle}
              disabledIds={disabledIds}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <Inner />
    </Suspense>
  );
}
