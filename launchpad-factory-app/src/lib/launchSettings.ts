import { type Address, formatUnits, parseUnits } from "viem";

export type LaunchSettingsForm = {
  totalSupply: string;
  initialMarketcapUsd: string;
  poolFeePercent: string;
  tickSpacing: string;
};

export type LaunchConfig = { totalSupply: bigint; initialMarketcap: bigint; poolFee: number; tickSpacing: number };

const TOKEN_DECIMALS = 18;
const USD_DECIMALS = 18;
const POOL_FEE_UNITS_PER_PERCENT = 10_000;
const MAX_POOL_FEE_PERCENT = 100;

export const DEFAULT_LAUNCH_SETTINGS: LaunchSettingsForm = {
  totalSupply: "1000000000",
  initialMarketcapUsd: "5000",
  poolFeePercent: "1",
  tickSpacing: "200",
};

export const launchSettingsError = (form: LaunchSettingsForm) => {
  if (!(Number(form.totalSupply) > 0)) return "Total supply must be greater than zero";
  if (!(Number(form.initialMarketcapUsd) > 0)) return "Initial market cap must be greater than zero";
  const fee = Number(form.poolFeePercent);
  if (!(fee >= 0 && fee <= MAX_POOL_FEE_PERCENT)) return "Pool fee must be between 0% and 100%";
  const tickSpacing = Number(form.tickSpacing);
  if (!(Number.isInteger(tickSpacing) && tickSpacing >= 1 && tickSpacing <= 32767)) return "Tick spacing must be an integer from 1 to 32767";
  return null;
};

export const toLaunchConfig = (form: LaunchSettingsForm): LaunchConfig => ({
  totalSupply: parseUnits(form.totalSupply, TOKEN_DECIMALS),
  initialMarketcap: parseUnits(form.initialMarketcapUsd, USD_DECIMALS),
  poolFee: Math.round(Number(form.poolFeePercent) * POOL_FEE_UNITS_PER_PERCENT),
  tickSpacing: Number(form.tickSpacing),
});

export const toLaunchSettingsForm = (config: LaunchConfig): LaunchSettingsForm => ({
  totalSupply: formatUnits(config.totalSupply, TOKEN_DECIMALS),
  initialMarketcapUsd: formatUnits(config.initialMarketcap, USD_DECIMALS),
  poolFeePercent: String(config.poolFee / POOL_FEE_UNITS_PER_PERCENT),
  tickSpacing: String(config.tickSpacing),
});

export type EnabledQuoteTokens = Record<Address, boolean>;
