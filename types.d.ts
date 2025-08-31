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

  year?: 2 | 3 | 4; 
  term?: Term[];      
  credits?: number;     
  category?: string;  
  url?: string;
};

export type Cell = ImportedItem | null;