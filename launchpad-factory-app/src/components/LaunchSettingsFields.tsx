"use client";

import type { Address } from "viem";
import { hooks } from "@/lib/config";
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
      <Field label="Tick Spacing" hint="Price granularity of the pool.">
        <Input inputMode="numeric" value={value.tickSpacing} onChange={(event) => set({ tickSpacing: event.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Hook" hint="Every token launched here uses this hook.">
          <select
            className="h-11 w-full rounded-xl border border-line bg-ink px-4 text-sm text-white outline-none focus:border-brand"
            value={value.hooks ?? ""}
            onChange={(event) => set({ hooks: event.target.value as Address })}
          >
            {hooks.length === 0 && <option value="">No hooks are whitelisted yet</option>}
            {hooks.map((hook) => (
              <option key={hook.address} value={hook.address}>
                {hook.description}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}
