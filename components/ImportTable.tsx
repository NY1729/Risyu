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

export default function ImportTable({
  items,
  checkedIds,
  onToggle,
  disabledIds,
}: Props) {
  // 曜日→最小時限の順でソート
  const sorted = [...items].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    const aMin = Math.min(...a.period);
    const bMin = Math.min(...b.period);
    return aMin - bMin;
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
          <Stack gap={4}>
            {/* 上段：左寄せで順番に並べる */}
            <Group gap="xs" wrap="wrap">
              <Badge variant="light">{dayLabel(item.day)}</Badge>
              <Badge variant="outline">{formatPeriods(item.period)}</Badge>

              {item.credits ? (
                <Badge variant="light" size="xs">
                  {item.credits}単位
                </Badge>
              ) : null}

              {item.category ? (
                <Tooltip label={String(item.category)} withArrow>
                  <Badge variant="light" size="xs" color={badgeColor}>
                    {String(item.category).replace(/\s+/g, "")}
                  </Badge>
                </Tooltip>
              ) : null}

              {item.url ? (
                <Anchor
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  title="シラバスを開く"
                  ml="auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Group gap={4} wrap="nowrap" align="center">
                    <IconExternalLink size={14} stroke={1.8} />
                    <span>シラバス</span>
                  </Group>
                </Anchor>
              ) : null}
            </Group>

            {/* 下段：科目名と教室/教員 */}
            <div className="min-w-0">
              <Text size="sm" fw={600} lineClamp={1} title={item.subject}>
                {item.subject}
              </Text>
              {(item.room || item.teacher) && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {(item.room ?? "").trim()}
                  {item.room && item.teacher ? " / " : ""}
                  {(item.teacher ?? "").trim()}
                </Text>
              )}
            </div>
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
      <Table miw={700} verticalSpacing="sm" striped highlightOnHover>
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
