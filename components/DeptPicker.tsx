"use client";
import { useMemo, useState } from "react";
import { Group, Menu, UnstyledButton, Text, Box } from "@mantine/core";
import {
  IconChevronDown,
  IconSchool,
  IconCpu,
  IconEngine,
  IconMathFunction,
  IconMathPi,
  IconAtom,
  IconDeviceMobile,
  IconBrush,
} from "@tabler/icons-react";
import classes from "./DeptPicker.module.css";

export type DeptOption = {
  label: string; // 表示名: 例) 応用数理
  value: string; // 内部値: 例) apmath
  csv: string; // CSV パス: 例) /csv/apmath.csv
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: DeptOption[];
  width?: number | "target";
  withinPortal?: boolean;
  placeholder?: string;
};

/** 学科 value -> アイコン */
function getDeptIcon(value?: string) {
  switch (value) {
    case "math":
      return <IconMathPi size={14} />;
    case "apmath":
      return <IconMathFunction size={14} />;
    case "mech":
      return <IconEngine size={14} />;
    case "ep":
      return <IconAtom size={14} />;
    case "cs":
      return <IconCpu size={14} />;
    case "ict":
      return <IconDeviceMobile size={14} />;
    case "design":
      return <IconBrush size={14} />;
    default:
      return <IconSchool size={14} />;
  }
}

export default function DeptPicker({
  value,
  onChange,
  options,
  width = "target",
  withinPortal = true,
  placeholder = "学科を選択",
}: Props) {
  const [opened, setOpened] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const items = options.map((opt) => (
    <Menu.Item
      key={opt.value}
      leftSection={
        <Box className={classes.iconBox}>{getDeptIcon(opt.value)}</Box>
      }
      onClick={() => onChange(opt.value)}
    >
      <Text fw={600} size="xs">
        {opt.label}
      </Text>
    </Menu.Item>
  ));

  return (
    <Menu
      onOpen={() => setOpened(true)}
      onClose={() => setOpened(false)}
      radius="md"
      width={width}
      withinPortal={withinPortal}
      shadow="sm"
    >
      <Menu.Target>
        <UnstyledButton
          className={classes.control}
          data-expanded={opened || undefined}
        >
          <Group gap="8" wrap="nowrap">
            <Box className={classes.iconBox}>
              {getDeptIcon(selected?.value)}
            </Box>
            <span className={classes.label}>
              {selected ? selected.label : placeholder}
            </span>
          </Group>
          <IconChevronDown size={14} className={classes.icon} stroke={1.5} />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>{items}</Menu.Dropdown>
    </Menu>
  );
}
