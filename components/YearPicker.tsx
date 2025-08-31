"use client";
import { SegmentedControl } from "@mantine/core";
import React from "react";

type Props = {
  value: 2 | 3 | 4;
  onChange: (v: 2 | 3 | 4) => void;
  className?: string;
};

export default function YearPicker({ value, onChange, className }: Props) {
  return (
    <SegmentedControl
      value={String(value)}
      onChange={(v) => onChange(Number(v) as 2 | 3 | 4)}
      radius="sm"
      size="sm"
      className={className}
      classNames={{
        root: "bg-gray-50 rounded-lg ", // フラット感 & 余白
        indicator: "rounded-lg bg-white transition-all duration-200",
        label:
          "text-sm font-medium text-gray-600 data-[active=true]:text-black", // 余白を広めに
      }}
      data={[
        { value: "2", label: "2年" },
        { value: "3", label: "3年" },
        { value: "4", label: "4年" },
      ]}
    />
  );
}
