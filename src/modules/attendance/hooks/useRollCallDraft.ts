import { useCallback, useState } from "react";

import { RollCallStatus, type RollCallEntry } from "../lib/roll-call";

export interface RollCallDraft {
  statusOf: (key: string) => RollCallStatus | null;
  isSelected: (key: string) => boolean;
  setStatus: (key: string, status: RollCallStatus | null) => void;
  setSelected: (keys: readonly string[], isSelected: boolean) => void;
  markAbsent: (keys: readonly string[]) => void;
  selectedEntries: (pendingKeys: readonly string[]) => RollCallEntry[];
  markedEntries: (pendingKeys: readonly string[]) => RollCallEntry[];
  clear: () => void;
}

export function useRollCallDraft(): RollCallDraft {
  const [statuses, setStatuses] = useState<ReadonlyMap<string, RollCallStatus>>(() => new Map());
  const [selected, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const setSelected = useCallback((keys: readonly string[], isSelected: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (isSelected) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  function setStatus(key: string, status: RollCallStatus | null) {
    setStatuses((current) => {
      const next = new Map(current);
      if (status === null) next.delete(key);
      else next.set(key, status);
      return next;
    });
    setSelected([key], status !== null);
  }

  function markAbsent(keys: readonly string[]) {
    setStatuses(
      (current) =>
        new Map([...current, ...keys.map((key) => [key, RollCallStatus.absent] as const)]),
    );
  }

  return {
    statusOf: (key) => statuses.get(key) ?? null,
    isSelected: (key) => selected.has(key),
    setStatus,
    setSelected,
    markAbsent,
    selectedEntries: (pendingKeys) =>
      pendingKeys
        .filter((key) => selected.has(key))
        .map((key) => ({ key, status: statuses.get(key) ?? RollCallStatus.present })),
    markedEntries: (pendingKeys) =>
      pendingKeys.flatMap((key) => {
        const status = statuses.get(key);
        return status === undefined ? [] : [{ key, status }];
      }),
    clear: () => {
      setStatuses(new Map());
      setSelectedKeys(new Set());
    },
  };
}
