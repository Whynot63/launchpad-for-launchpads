import { type Address, formatUnits, parseUnits } from "viem";
import { hooks } from "./config";

export type LaunchSettingsForm = {
  totalSupply: string;
  initialMarketcapUsd: string;
  tickSpacing: string;
  hooks: Address;
};

export type LaunchConfig = {
  totalSupply: bigint;
  initialMarketcap: bigint;
  tickSpacing: number;
  hooks: Address;
};

const TOKEN_DECIMALS = 18;
const USD_DECIMALS = 18;

export const DEFAULT_LAUNCH_SETTINGS: LaunchSettingsForm = {
  totalSupply: "1000000000",
  initialMarketcapUsd: "5000",
  tickSpacing: "200",
  hooks: hooks[0]?.address,
};

export const launchSettingsError = (form: LaunchSettingsForm) => {
  if (!(Number(form.totalSupply) > 0)) return "Total supply must be greater than zero";
  if (!(Number(form.initialMarketcapUsd) > 0)) return "Initial market cap must be greater than zero";
  const tickSpacing = Number(form.tickSpacing);
  if (!(Number.isInteger(tickSpacing) && tickSpacing >= 1 && tickSpacing <= 32767)) return "Tick spacing must be an integer from 1 to 32767";
  if (!form.hooks) return "Choose a hook";
  return null;
};

export const toLaunchConfig = (form: LaunchSettingsForm): LaunchConfig => ({
  totalSupply: parseUnits(form.totalSupply, TOKEN_DECIMALS),
  initialMarketcap: parseUnits(form.initialMarketcapUsd, USD_DECIMALS),
  tickSpacing: Number(form.tickSpacing),
  hooks: form.hooks,
});

export const toLaunchSettingsForm = (config: LaunchConfig): LaunchSettingsForm => ({
  totalSupply: formatUnits(config.totalSupply, TOKEN_DECIMALS),
  initialMarketcapUsd: formatUnits(config.initialMarketcap, USD_DECIMALS),
  tickSpacing: String(config.tickSpacing),
  hooks: config.hooks,
});

export type EnabledQuoteTokens = Record<Address, boolean>;

export type HookFeesForm = { launchpadFeePercent: string; creatorFeePercent: string };

export const DEFAULT_HOOK_FEES: HookFeesForm = { launchpadFeePercent: "0.5", creatorFeePercent: "0.5" };

const BPS_PER_PERCENT = 100;
const MAX_HOOK_FEES_PERCENT = 10;

export const hookFeesError = (form: HookFeesForm) => {
  const fees = [Number(form.launchpadFeePercent), Number(form.creatorFeePercent)];
  if (fees.some((fee) => !(fee >= 0))) return "Fees must be zero or more";
  if (fees[0] + fees[1] > MAX_HOOK_FEES_PERCENT) return `Launchpad and creator fees together must be at most ${MAX_HOOK_FEES_PERCENT}%`;
  return null;
};

export const toHookFeesBps = (form: HookFeesForm) =>
  [
    Math.round(Number(form.launchpadFeePercent) * BPS_PER_PERCENT),
    Math.round(Number(form.creatorFeePercent) * BPS_PER_PERCENT),
  ] as const;
