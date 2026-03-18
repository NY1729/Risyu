"use client";
import React, { useState, useCallback, useEffect } from "react";
import {
  Container,
  Title,
  Button,
  Progress,
  Stack,
  Group,
  Text,
  Paper,
  ScrollArea,
  List,
  ThemeIcon,
  Badge,
  Code,
} from "@mantine/core";
import {
  IconCheck,
  IconDownload,
  IconPlayerPlay,
  IconAlertCircle,
  IconClock,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import * as cheerio from "cheerio";
import DeptPicker, { type DeptOption } from "@/components/DeptPicker";
import type { ImportedItem, Term } from "@/types";

/* ========================= 定数 & 設定 ========================= */
const ROWS = 7;
const YEAR_VAL = "2026";
const DEPTS: DeptOption[] = [
  { label: "数学科", value: "math", csv: "/csv/math.csv" },
  { label: "応用数理学科", value: "apmath", csv: "/csv/apmath.csv" },
  { label: "機械科学・航空宇宙学科", value: "mech", csv: "/csv/mech.csv" },
  { label: "電子物理システム学科", value: "ep", csv: "/csv/ep.csv" },
  { label: "情報理工学科", value: "cs", csv: "/csv/cs.csv" },
  { label: "情報通信学科", value: "ict", csv: "/csv/ict.csv" },
  { label: "表現工学科", value: "design", csv: "/csv/design.csv" },
];

/* ========================= ユーティリティ ========================= */

const toHalfWidth = (s: string) =>
  s.replace(/[０-９－～〜，、・％]/g, (ch) =>
    "０１２３４５６７８９".includes(ch)
      ? String("０１２３４５６７８９".indexOf(ch))
      : ch === "－"
        ? "-"
        : ch === "～" || ch === "〜"
          ? "~"
          : ch === "，" || ch === "、" || ch === "・"
            ? ","
            : ch === "％"
              ? "%"
              : ch,
  );

/* ========================= 強化された曜日マッピング ========================= */
const dayMap = new Map([
  ["月", 0],
  ["火", 1],
  ["水", 2],
  ["木", 3],
  ["金", 4],
  ["土", 5],
  ["日", 6],
  ["mon", 0],
  ["tue", 1],
  ["wed", 2],
  ["thu", 3],
  ["fri", 4],
  ["sat", 5],
  ["sun", 6],
]);

function toDayIndex(v: string | number | null | undefined): number | null {
  if (v === undefined || v === null) return null;
  const k = String(v).trim().toLowerCase();
  if (k === "") return null;

  if (dayMap.has(k[0])) return dayMap.get(k[0])!;

  const n = parseInt(k, 10);
  if (!isNaN(n) && n >= 0 && n <= 6) return n;

  return null;
}

function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [],
    field = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i],
      next = text[i + 1];
    if (q) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') q = false;
      else field += ch;
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
      } else if (ch !== "\r") field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ========================= メイン ========================= */
export default function UpdatePage() {
  const [dept, setDept] = useState<string>("");
  const [items, setItems] = useState<ImportedItem[]>([]);
  const [status, setStatus] = useState<"idle" | "syncing" | "completed">(
    "idle",
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [logs, setLogs] = useState<
    { name: string; status: "ok" | "error" | "skip" }[]
  >([]);

  // CSVの読み込み
  const loadInitialCSV = useCallback(async () => {
    const target = DEPTS.find((d) => d.value === dept);
    if (!target) return;
    try {
      const res = await fetch(target.csv, { cache: "no-store" });
      const raw = parseCSV(await res.text());
      const aliases: Record<string, string> = {
        曜日: "day",
        時限: "period",
        科目名: "subject",
        教室: "room",
        担当教員: "teacher",
        学年: "year",
        学期: "term",
        単位: "credits",
        区分: "category",
        URL: "url",
        成績評価: "evaluation",
      };
      const header = raw[0].map((h) => aliases[h.trim()] ?? h.trim());
      const col = (n: string) => header.indexOf(n);
      const idxs = {
        day: col("day"),
        per: col("period"),
        sub: col("subject"),
        room: col("room"),
        tea: col("teacher"),
        yr: col("year"),
        tm: col("term"),
        cr: col("credits"),
        cat: col("category"),
        url: col("url"),
        ev: col("evaluation"),
      };

      const list: ImportedItem[] = raw
        .slice(1)
        .map((row, r) => {
          const dVal = idxs.day >= 0 ? row[idxs.day] : null;
          const dayParsed = toDayIndex(dVal);

          return {
            id: `${dept}-${r}-${row[idxs.sub]}`,
            day: dayParsed !== null ? dayParsed : 0, // CSV自体が空なら月曜にするが、通常はCSVに値があるはず
            period:
              idxs.per >= 0
                ? String(row[idxs.per] || "")
                    .split(",")
                    .map((n) => parseInt(n))
                    .filter((n) => !isNaN(n))
                : [],
            subject: idxs.sub >= 0 ? (row[idxs.sub] ?? "").trim() : "Unknown",
            room: idxs.room >= 0 ? row[idxs.room] : "",
            teacher: idxs.tea >= 0 ? row[idxs.tea] : "",
            year:
              idxs.yr >= 0
                ? ([2, 3, 4] as const).includes(
                    parseInt(toHalfWidth(row[idxs.yr] || "")) as 2 | 3 | 4,
                  )
                  ? (parseInt(toHalfWidth(row[idxs.yr] || "")) as 2 | 3 | 4)
                  : undefined
                : undefined,
            credits:
              idxs.cr >= 0
                ? parseInt(toHalfWidth(row[idxs.cr] || "")) || undefined
                : undefined,
            category: idxs.cat >= 0 ? row[idxs.cat] : "",
            url:
              idxs.url >= 0
                ? (row[idxs.url] ?? "").trim().replace(/yyyy/g, YEAR_VAL)
                : "",
            evaluation: idxs.ev >= 0 ? row[idxs.ev] : "",
          };
        })
        .filter((it) => it.subject);

      setItems(list);
      setStatus("idle");
      setLogs([]);
      setCurrentIdx(0);
    } catch (e) {
      notifications.show({
        title: "エラー",
        message: "CSV読み込み失敗",
        color: "red",
      });
    }
  }, [dept]);

  useEffect(() => {
    loadInitialCSV();
  }, [loadInitialCSV]);

  // 高速並列同期（URLがない場合はスキップして元のデータを維持）
  const startSync = async () => {
    setStatus("syncing");
    const CONCURRENCY = 15;
    let completed = 0;

    const processItem = async (index: number) => {
      const item = items[index];

      // 【重要】URLがない、または正しくない場合は即座に終了（元のデータを維持）
      if (!item.url || !item.url.startsWith("http")) {
        setLogs((prev) => [
          { name: `${item.subject} (URLなし)`, status: "skip" },
          ...prev,
        ]);
        completed++;
        setCurrentIdx(completed);
        return;
      }

      try {
        const res = await fetch(
          `/api/proxy?url=${encodeURIComponent(item.url)}`,
        );
        if (!res.ok) throw new Error();
        const html = await res.text();
        const $ = cheerio.load(html);

        const getTd = (txt: string) => {
          const cell = $("th")
            .filter((_, el) => $(el).text().includes(txt))
            .next("td");
          return cell.length ? cell.text().trim() : "";
        };

        const sSub = getTd("科目名");
        const sTea = getTd("担当教員");
        const sRoom = getTd("使用教室");
        const sEval = getTd("成績評価方法");
        const sCredRaw = parseInt(toHalfWidth(getTd("単位数")));
        const sYearRaw = parseInt(toHalfWidth(getTd("配当年次")));
        const sYear = [2, 3, 4].includes(sYearRaw)
          ? (sYearRaw as 2 | 3 | 4)
          : undefined;

        const rawSch = toHalfWidth(getTd("学期曜日時限"));
        let sTerm: Term[] = [];
        if (rawSch.includes("春")) sTerm.push("spring");
        if (rawSch.includes("秋")) sTerm.push("fall");
        if (rawSch.includes("通年")) sTerm = ["spring", "fall"];

        const dayMatch = rawSch.match(/(月|火|水|木|金|土|日)/);
        const sDay = dayMatch ? toDayIndex(dayMatch[0]) : null;

        const perMatch = rawSch.match(/\d+/g);
        const sPeriods = perMatch ? perMatch.map(Number) : [];

        setItems((prev) => {
          const next = [...prev];
          const current = next[index];

          next[index] = {
            ...current,
            // 取得できた場合のみ上書き、できなければ元のCSV(current)を維持
            subject: sSub || current.subject,
            teacher: sTea || current.teacher,
            room: sRoom || current.room,
            evaluation: sEval || current.evaluation,
            credits: !isNaN(sCredRaw) ? sCredRaw : current.credits,
            year: sYear || current.year,
            day: sDay !== null ? sDay : current.day,
            period: sPeriods.length > 0 ? sPeriods : current.period,
            term: sTerm.length > 0 ? sTerm : current.term,

            // 区分は元のCSVを絶対維持
            category: current.category,
          };
          return next;
        });
        setLogs((prev) => [{ name: item.subject, status: "ok" }, ...prev]);
      } catch (e) {
        // エラー時も元のデータが残る（何もしないため）
        setLogs((prev) => [
          { name: `${item.subject} (エラー)`, status: "error" },
          ...prev,
        ]);
      } finally {
        completed++;
        setCurrentIdx(completed);
      }
    };

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items
        .slice(i, i + CONCURRENCY)
        .map((_, j) => processItem(i + j));
      await Promise.all(chunk);
    }
    setStatus("completed");
  };

  const downloadCSV = () => {
    const header = [
      "曜日",
      "時限",
      "科目名",
      "担当教員",
      "教室",
      "学年",
      "学期",
      "単位",
      "区分",
      "URL",
      "成績評価",
    ];
    const rows = items.map((it) => {
      const formatCell = (val: string | number | undefined | null) =>
        `"${String(val ?? "")
          .replace(/"/g, '""')
          .replace(/\r?\n/g, "\\n")}"`;
      return [
        ["月", "火", "水", "木", "金", "土", "日"][it.day] || "月",
        `"${it.period.join(",")}"`,
        formatCell(it.subject),
        formatCell(it.teacher),
        formatCell(it.room),
        it.year || "",
        `"${it.term?.join(",") || ""}"`,
        it.credits || "",
        formatCell(it.category),
        `"${it.url || ""}"`,
        formatCell(it.evaluation),
      ].join(",");
    });

    const blob = new Blob(["\uFEFF" + [header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `updated_${dept}.csv`;
    a.click();
  };

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Paper p="xl" withBorder radius="md">
          <Title order={1} size="h2" mb="xs">
            Sync Tool (Safe Mode)
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            URLがない場合はCSVのデータをそのまま保持します。区分は上書きされません。
          </Text>
          <Group align="flex-end">
            <DeptPicker value={dept} onChange={setDept} options={DEPTS} />
            <Button
              onClick={startSync}
              loading={status === "syncing"}
              leftSection={<IconPlayerPlay size={16} />}
            >
              同期開始
            </Button>
            {status === "completed" && (
              <Button variant="light" color="green" onClick={downloadCSV}>
                CSV保存
              </Button>
            )}
          </Group>
        </Paper>
        {status !== "idle" && (
          <Stack gap={5}>
            <Group justify="space-between">
              <Text size="xs" fw={700}>
                Progress
              </Text>
              <Text size="xs">
                {currentIdx}/{items.length}
              </Text>
            </Group>
            <Progress
              value={(currentIdx / items.length) * 100}
              size="xl"
              radius="xl"
              animated
            />
          </Stack>
        )}
        <Paper withBorder radius="md">
          <ScrollArea h={400} p="md">
            <List spacing="xs" size="xs">
              {logs.map((l, i) => (
                <List.Item
                  key={i}
                  icon={
                    <ThemeIcon
                      color={
                        l.status === "ok"
                          ? "teal"
                          : l.status === "skip"
                            ? "gray"
                            : "red"
                      }
                      size={18}
                      radius="xl"
                    >
                      {l.status === "ok" || l.status === "skip" ? (
                        <IconCheck size={12} />
                      ) : (
                        <IconAlertCircle size={12} />
                      )}
                    </ThemeIcon>
                  }
                >
                  {l.name} —{" "}
                  {l.status === "ok"
                    ? "同期完了"
                    : l.status === "skip"
                      ? "URLなし(CSV維持)"
                      : "エラー(CSV維持)"}
                </List.Item>
              ))}
            </List>
          </ScrollArea>
        </Paper>
      </Stack>
    </Container>
  );
}
