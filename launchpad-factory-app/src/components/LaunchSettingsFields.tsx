"use client";

import type { LaunchSettingsForm } from "@/lib/launchSettings";
import { Field, Input } from "./ui";

export function LaunchSettingsFields({
  value,
  onChange,
}: {
  value: LaunchSettingsForm;
  onChange: (value: LaunchSettingsForm) => void;
}) {
  const set = (patch: Partial<LaunchSettingsForm>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Token Total Supply" hint="Every token launched here gets this supply.">
        <Input inputMode="decimal" value={value.totalSupply} onChange={(event) => set({ totalSupply: event.target.value })} />
      </Field>
      <Field label="Initial Market Cap, USD" hint="Sets the starting price of every token.">
        <Input
          inputMode="decimal"
          value={value.initialMarketcapUsd}
          onChange={(event) => set({ initialMarketcapUsd: event.target.value })}
        />
      </Field>
      <Field label="Pool Fee, %" hint="Swap fee of the Uniswap v4 pool.">
        <Input inputMode="decimal" value={value.poolFeePercent} onChange={(event) => set({ poolFeePercent: event.target.value })} />
      </Field>
      <Field label="Tick Spacing" hint="Price granularity of the pool. 200 fits a 1% fee.">
        <Input inputMode="numeric" value={value.tickSpacing} onChange={(event) => set({ tickSpacing: event.target.value })} />
      </Field>
    </div>
  );
}
