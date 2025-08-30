export type Term = "spring" | "fall";
export type Category = "専門必修" | "専門選択必修" | "専門選択";

export type ImportedItem = {
  id: string;
  day: number;      // 0..6 (Mon=0)
  period: number[];   // 1..n
  subject: string;
  room?: string;
  teacher?: string;
    color?: string;

  // 追加↓
  year?: 2 | 3 | 4; // CSVにあれば使う（なければ全学年に表示）
  term?: Term[];      // 既に対応済みならそのまま
  credits?: number;     // ★ 追加：単位数
  category?: string;  // ★ 追加：卒業要件のカテゴリ（上記 Category 型の値が入る想定）
};

export type Cell = ImportedItem | null;