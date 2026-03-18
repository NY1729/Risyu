"use client";
import cx from "clsx";
import {
  Anchor,
  Badge,
  Checkbox,
  Group,
  ScrollArea,
  Table,
  Text,
  Tooltip,
  Stack,
  Progress,
  Paper,
} from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import classes from "./TableSelection.module.css";
import type { ImportedItem } from "@/types";

type Props = {
  items: ImportedItem[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll?: () => void;
  disabledIds?: Set<string>;
};

const JP_DAYS = ["月", "火", "水", "木", "金", "土", "オンライン"];
const dayLabel = (idx: number) => JP_DAYS[idx] ?? `D${idx}`;

function formatPeriods(periods: number[]): string {
  if (!periods || periods.length === 0) return "";
  const sorted = Array.from(new Set(periods)).sort((a, b) => a - b);
  const isContig =
    sorted.length >= 2 &&
    sorted.every((v, i, arr) => (i === 0 ? true : v - arr[i - 1] === 1));
  return isContig
    ? `${sorted[0]}-${sorted[sorted.length - 1]}限`
    : `${sorted.join(",")}限`;
}

/** カテゴリに応じた Badge の色 */
function getBadgeColor(cat?: string): string {
  if (!cat) return "gray";
  const s = String(cat);
  if (/専門必修/.test(s)) return "pink";
  if (/選択必修/.test(s)) return "blue";
  if (/必修/.test(s) && !/専門必修/.test(s) && !/選択必修/.test(s))
    return "red";
  if (/専門選択/.test(s)) return "teal";
  if (/基幹共通/.test(s)) return "indigo";
  if (/数学科非共通/.test(s)) return "cyan";
  if (/応用数理学科非共通/.test(s)) return "cyan";
  return "gray";
}

const getYearColor = (y: number | string | undefined) => {
  const yearNum = Number(y);
  switch (yearNum) {
    case 2:
      return "blue";
    case 3:
      return "teal";
    case 4:
      return "grape";
    default:
      return "gray";
  }
};

const getDayColor = (d: number) => {
  switch (d) {
    case 0:
      return "yellow";
    case 1:
      return "orange";
    case 2:
      return "grape";
    case 3:
      return "cyan";
    case 4:
      return "blue";
    case 5:
      return "gray";
    case 6:
      return "green";
    default:
      return "gray";
  }
};

function EvaluationBar({ evaluation }: { evaluation?: string }) {
  if (!evaluation) return null;

  const isPercentageBased =
    evaluation.includes("%") || evaluation.includes("％");

  const parseEvaluation = (text: string) => {
    // 全角数字を半角に変換、小文字化、記号の正規化
    const s = text
      .replace(/[０-９]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xfee0))
      .toLowerCase();

    const rawScores: Record<string, number[]> = {
      exam: [],
      report: [],
      quiz: [],
      participation: [],
      others: [],
    };

    // キーワード定義（プレゼン、議論、英単語を拡充）
    const categoryDefinition = [
      {
        key: "exam",
        regex: /試験|口頭試問|理解度(?:の)?確認|教場|筆記|テスト|exam|test/,
      },
      {
        key: "report",
        regex:
          /レポート|課題|提出物|プレゼン(?:テーション)?|report|assignment|presentation/,
      },
      { key: "quiz", regex: /小テスト|ミニテスト|クイズ|quiz|演習/ },
      {
        key: "participation",
        regex:
          /平常点|出席|授業参加|参加度|議論|participation|discussion|リアクションペーパー/,
      },
      { key: "others", regex: /その他|others/ },
    ];

    // トークン抽出（キーワードと数値を順番に取得）
    const tokens = Array.from(
      s.matchAll(
        /(試験|口頭試問|理解度(?:の)?確認|教場|筆記|テスト|exam|test|レポート|課題|提出物|プレゼン(?:テーション)?|report|assignment|presentation|小テスト|ミニテスト|クイズ|quiz|演習|平常点|出席|授業参加|参加度|議論|participation|discussion|リアクションペーパー|その他|others)|(\d+)[%％]/g,
      ),
    );

    let currentCategory: string = "others";

    for (const token of tokens) {
      const [_, keyword, percentValue] = token;
      if (keyword) {
        for (const cat of categoryDefinition) {
          if (cat.regex.test(keyword)) {
            currentCategory = cat.key;
            break;
          }
        }
      } else if (percentValue) {
        rawScores[currentCategory].push(parseInt(percentValue));
      }
    }

    const finalScores = {
      exam: 0,
      report: 0,
      quiz: 0,
      participation: 0,
      others: 0,
    };

    // 各カテゴリの合算
    Object.keys(rawScores).forEach((key) => {
      const vals = rawScores[key as keyof typeof rawScores];
      if (vals.length === 0) return;

      const sumAll = vals.reduce((a, b) => a + b, 0);
      const uniqueVals = Array.from(new Set(vals));
      const sumUnique = uniqueVals.reduce((a, b) => a + b, 0);

      // 1. 日英併記の重複除去 (例: [60, 60] -> 60)
      // 同じ数値が複数回出現し、かつそれらを合計すると100を超える場合は重複とみなす
      if (sumAll > 100 && sumUnique <= 100) {
        finalScores[key as keyof typeof finalScores] = sumUnique;
      } else {
        // 2. 総計と内訳の判定 (例: [90, 50, 40] -> 90)
        const maxVal = Math.max(...vals);
        const othersSum = sumAll - maxVal;
        if (sumAll > 100 && maxVal === othersSum) {
          finalScores[key as keyof typeof finalScores] = maxVal;
        } else {
          finalScores[key as keyof typeof finalScores] = sumAll;
        }
      }
    });

    return finalScores;
  };

  const scores = parseEvaluation(evaluation);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  // --- 合格基準・ルール判定フラグ ---
  const isRuleDescription =
    /(?:以上|得点|基準|満たす|認定|最大|程度|約|合格者の|のみ)/.test(
      evaluation,
    );

  // 表示の決定: 合計が100%ピッタリ、もしくは100%ではないが明らかな「ルール説明」ではない場合
  const hasScores =
    total === 100 || (total > 0 && total <= 100 && !isRuleDescription);

  return (
    <Stack gap={2} mt={4}>
      <Group justify="space-between" align="center">
        <Text size="10px" c="dimmed" fw={700}>
          {isPercentageBased && hasScores ? "評価構成" : "評価方法・ルール"}
        </Text>
        {total !== 100 && hasScores && (
          <Badge
            color={total > 100 ? "red" : "orange"}
            size="xs"
            variant="filled"
          >
            Total {total}%
          </Badge>
        )}
      </Group>

      {isPercentageBased && hasScores ? (
        <Progress.Root size="xl" radius="sm" bg="gray.2">
          {scores.exam > 0 && (
            <Tooltip label={`試験: ${scores.exam}%`}>
              <Progress.Section value={scores.exam} color="red.6">
                <Progress.Label style={{ fontSize: "9px" }}>
                  {scores.exam}%
                </Progress.Label>
              </Progress.Section>
            </Tooltip>
          )}
          {scores.report > 0 && (
            <Tooltip label={`レポート・プレゼン: ${scores.report}%`}>
              <Progress.Section value={scores.report} color="blue.6">
                <Progress.Label style={{ fontSize: "9px" }}>
                  {scores.report}%
                </Progress.Label>
              </Progress.Section>
            </Tooltip>
          )}
          {scores.quiz > 0 && (
            <Tooltip label={`小テスト・演習: ${scores.quiz}%`}>
              <Progress.Section value={scores.quiz} color="orange.6">
                <Progress.Label style={{ fontSize: "9px" }}>
                  {scores.quiz}%
                </Progress.Label>
              </Progress.Section>
            </Tooltip>
          )}
          {scores.participation > 0 && (
            <Tooltip label={`平常点・議論: ${scores.participation}%`}>
              <Progress.Section value={scores.participation} color="teal.6">
                <Progress.Label style={{ fontSize: "9px" }}>
                  {scores.participation}%
                </Progress.Label>
              </Progress.Section>
            </Tooltip>
          )}
          {scores.others > 0 && (
            <Tooltip label={`その他: ${scores.others}%`}>
              <Progress.Section value={scores.others} color="green.6">
                <Progress.Label style={{ fontSize: "9px" }}>
                  {scores.others}%
                </Progress.Label>
              </Progress.Section>
            </Tooltip>
          )}
        </Progress.Root>
      ) : (
        <Paper
          withBorder
          p={6}
          bg="gray.0"
          radius="xs"
          style={{ borderStyle: "dashed" }}
        >
          <Text
            size="10px"
            c="dimmed"
            style={{ lineHeight: 1.4, whiteSpace: "pre-wrap" }}
          >
            {evaluation.replace(/\\n/g, "\n")}
          </Text>
        </Paper>
      )}
    </Stack>
  );
}

/** 年次とシラバスのセット（共通パーツ） */
function SyllabusAndYear({ item }: { item: ImportedItem }) {
  return (
    <>
      {item.term?.length === 2 && (
        <Badge size="xs" color="red" radius="sm">
          通年
        </Badge>
      )}
      {item.url && (
        <Badge
          component="a"
          href={item.url}
          target="_blank"
          variant="outline"
          size="xs"
          color="gray"
          leftSection={<IconExternalLink size={12} />}
          style={{ cursor: "pointer" }}
          onClick={(e) => e.stopPropagation()}
        >
          シラバス
        </Badge>
      )}
      {item.year && (
        <Tooltip label={`配当年次: ${item.year}年`} withArrow>
          <Badge
            color={getYearColor(item.year)}
            size="xs"
            styles={{ root: { textTransform: "none" } }}
          >
            {item.year}年
          </Badge>
        </Tooltip>
      )}
    </>
  );
}

export default function ImportTable({
  items,
  checkedIds,
  onToggle,
  disabledIds,
}: Props) {
  // 1.曜日 → 2.最小時限 → 3.年次 の順でソート
  const sorted = [...items].sort((a, b) => {
    // 第一優先：曜日 (day)
    if (a.day !== b.day) return a.day - b.day;

    // 第二優先：最小時限 (min period)
    const aMin = Math.min(...(a.period.length > 0 ? a.period : [9]));
    const bMin = Math.min(...(b.period.length > 0 ? b.period : [9]));
    if (aMin !== bMin) return aMin - bMin;

    // 第三優先：年次 (year)
    // 年次が設定されていない(undefined)場合は、一番後ろ(99)に送る
    const aYear = a.year ?? 99;
    const bYear = b.year ?? 99;
    return aYear - bYear;
  });

  const rows = sorted.map((item) => {
    const selected = checkedIds.has(item.id);
    const isDisabled = disabledIds?.has(item.id) ?? false;
    const badgeColor = getBadgeColor(item.category);

    return (
      <Table.Tr
        key={item.id}
        className={cx({
          [classes.rowSelected]: selected,
          "cursor-pointer": !isDisabled,
        })}
        onClick={() => !isDisabled && onToggle(item.id)}
      >
        {/* チェックボックス列 */}
        <Table.Td w={40} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            aria-label="select row"
            checked={selected}
            onChange={() => onToggle(item.id)}
            disabled={isDisabled}
          />
        </Table.Td>

        {/* 詳細列 */}
        <Table.Td>
          <Stack gap={4} pos="relative">
            {/* --- 上段エリア --- */}
            <Group gap="xs" wrap="nowrap">
              <Group gap={6} wrap="wrap">
                <Badge variant="light" color={getDayColor(item.day)} size="sm">
                  {dayLabel(item.day)}
                </Badge>
                <Badge variant="outline" color="gray" size="sm">
                  {formatPeriods(item.period)}
                </Badge>
                {item.credits && (
                  <Badge variant="light" size="xs" color="gray">
                    {item.credits}単位
                  </Badge>
                )}
                {item.category && (
                  <Badge variant="light" size="xs" color={badgeColor}>
                    {String(item.category).replace(/\s+/g, "")}
                  </Badge>
                )}
              </Group>

              {/* デスクトップ用：右端に表示 (sm以上で表示) */}
              <Group gap="xs" ml="auto" visibleFrom="sm">
                <SyllabusAndYear item={item} />
              </Group>
            </Group>

            {/* --- 中段：科目名 --- */}
            <div className="min-w-0">
              <Text size="sm" fw={600} lineClamp={1}>
                {item.subject}
              </Text>
            </div>
            <EvaluationBar evaluation={item.evaluation} />

            {/* --- 下段：教室/教員 ＋ モバイル用メタ情報 --- */}
            <Group justify="space-between" align="flex-end" wrap="nowrap">
              <div className="min-w-0">
                {(item.room || item.teacher) && (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {item.room?.trim()}
                    {item.room && item.teacher ? " / " : ""}
                    {item.teacher?.trim()}
                  </Text>
                )}
              </div>

              {/* モバイル用：右下に表示 (sm未満で表示) */}
              <Group gap="xs" hiddenFrom="sm">
                <SyllabusAndYear item={item} />
              </Group>
            </Group>
          </Stack>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <ScrollArea
      offsetScrollbars
      styles={{
        scrollbar: {
          zIndex: 10,
          backgroundColor: "white", // 必要なら塗る
        },
      }}
    >
      <Table miw={300} verticalSpacing="sm" striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th />
            <Table.Th>科目一覧</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
