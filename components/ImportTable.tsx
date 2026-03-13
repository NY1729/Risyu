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
  console.log(items);
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
