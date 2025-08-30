"use client";
import {
  Card,
  Group,
  Stack,
  Text,
  Title,
  RingProgress,
  SimpleGrid,
  Badge,
  Tooltip,
} from "@mantine/core";
import React, { useMemo, useEffect, useRef, useState } from "react";
import type { ImportedItem } from "@/types";

/** 要件（必ず number） */
export type Requirements = {
  専門選択必修: number;
  専門選択: number;
};

type Props = {
  items: ImportedItem[];
  requirements: Requirements;
  title?: string;
  durationMs?: number;
  delayMs?: number;
  foundationCap?: number; // 基幹共通の算入上限
};

const CAT_COLORS: Record<keyof Requirements, string> = {
  専門選択必修: "blue.6",
  専門選択: "teal.6",
};

/* ===== アニメ付き RingProgress ===== */
function AnimatedRing({
  targetPercent,
  color,
  size = 160,
  thickness = 14,
  duration = 900,
  delay = 0,
  label,
}: {
  targetPercent: number;
  color: string;
  size?: number;
  thickness?: number;
  duration?: number;
  delay?: number;
  label?: (p: number) => React.ReactNode;
}) {
  const [p, setP] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const toRef = useRef(targetPercent);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    fromRef.current = p;
    toRef.current = Math.max(0, Math.min(100, targetPercent));

    if (reduce || duration <= 0) {
      setP(toRef.current);
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (ts: number) => {
      if (startRef.current === null) {
        startRef.current = ts + (delay || 0);
      }
      const t0 = startRef.current;
      const elapsed = Math.max(0, ts - t0);
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const value = fromRef.current + (toRef.current - fromRef.current) * eased;
      setP(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPercent, duration, delay]);

  const pct = Math.max(0, Math.min(100, Math.round(p)));
  return (
    <RingProgress
      size={size}
      thickness={thickness}
      sections={[
        { value: pct, color },
        { value: 100 - pct, color: "gray.3" },
      ]}
      label={label ? label(pct) : undefined}
    />
  );
}

/* ====== メイン：クレジット進捗 ====== */
export default function CreditsProgress({
  items,
  requirements,
  title = "卒業要件の進捗",
  durationMs = 900,
  delayMs = 0,
  foundationCap = 0,
}: Props) {
  // 内訳付きの集計
  const { got, totals } = useMemo(() => {
    let selReq = 0;
    let electiveBase = 0;
    let extMath = 0; // 数学科非共通
    let extApMath = 0; // 応用数理学科非共通
    let foundation = 0;
    let overflowFromReq = 0;

    for (const it of items) {
      const cr = Number(it.credits ?? 0);
      if (!Number.isFinite(cr) || cr <= 0) continue;
      const cat = String(it.category ?? "");

      if (/選択必修/.test(cat)) {
        selReq += cr;
        continue;
      }
      if (/数学科非共通/.test(cat)) {
        extMath += cr;
        continue;
      }
      if (/応用数理学科非共通/.test(cat)) {
        extApMath += cr;
        continue;
      }
      if (/基幹共通/.test(cat)) {
        foundation += cr;
        continue;
      }
      if (/専門選択/.test(cat)) {
        electiveBase += cr;
        continue;
      }
    }

    // 選択必修の超過分を専門選択へ
    const needSelReq = requirements["専門選択必修"];
    if (selReq > needSelReq) {
      overflowFromReq = selReq - needSelReq;
    }

    // 数学科非共通は上限16
    const extMathCapped = Math.min(16, extMath);

    // 応用数理学科非共通は上限12
    const extApMathCapped = Math.min(12, extApMath);

    // 基幹共通は foundationCap 上限
    const coreCommon = Math.min(foundationCap, foundation);

    const electiveTotal =
      electiveBase +
      extMathCapped +
      extApMathCapped +
      coreCommon +
      overflowFromReq;

    return {
      got: {
        専門選択必修: selReq,
        専門選択: electiveTotal,
      },
      totals: {
        base: { 専門選択: electiveBase },
        extMathCapped,
        extApMathCapped,
        coreCommon,
        overflowFromReq,
      },
    };
  }, [items, requirements, foundationCap]);

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Title order={4}>{title}</Title>
          <Group gap="xs">
            <Badge color="blue">専門選択必修</Badge>
            <Badge color="teal">専門選択</Badge>
            <Badge color="indigo" variant="light">
              基幹共通
            </Badge>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {(Object.keys(CAT_COLORS) as (keyof Requirements)[]).map((cat, i) => {
            const need = requirements[cat];
            const gotVal = got[cat];
            const pct =
              need > 0 ? Math.min(100, Math.round((gotVal / need) * 100)) : 100;

            return (
              <Card key={cat} withBorder radius="md" p="md">
                <Stack align="center" gap="xs">
                  <Tooltip
                    withArrow
                    label={`${cat}：取得 ${gotVal} / 必要 ${need} 単位`}
                  >
                    <AnimatedRing
                      targetPercent={pct}
                      color={CAT_COLORS[cat]}
                      duration={durationMs}
                      delay={delayMs + i * 120}
                      label={(p) => (
                        <Stack gap={2} align="center">
                          <Text fz="xs" c="dimmed">
                            {cat}
                          </Text>
                          <Text fz="lg" fw={700}>
                            {p}%
                          </Text>
                        </Stack>
                      )}
                    />
                  </Tooltip>
                  <Text fz="sm" ta="center">
                    取得 {gotVal} / 必要 {need} 単位
                  </Text>

                  {/* 専門選択のときだけ内訳を表示 */}
                  {cat === "専門選択" &&
                  (totals.overflowFromReq > 0 ||
                    totals.extMathCapped > 0 ||
                    totals.coreCommon > 0) ? (
                    <Text fz="xs" c="dimmed" ta="center">
                      ※内訳: 学科専門選択科目 {totals.base["専門選択"]} 単位
                      {totals.extMathCapped > 0
                        ? ` + 数学科非共通 ${totals.extMathCapped} 単位`
                        : ""}
                      {totals.extApMathCapped > 0
                        ? ` + 応用数理学科非共通 ${totals.extApMathCapped} 単位`
                        : ""}
                      {totals.coreCommon > 0
                        ? ` + 基幹共通 ${totals.coreCommon} 単位`
                        : ""}
                      {totals.overflowFromReq > 0
                        ? ` + 選択必修超過 ${totals.overflowFromReq} 単位`
                        : ""}
                    </Text>
                  ) : null}
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
