import { BigDecimal } from "envio";

const Q192 = 2n ** 192n;
const WAD = 10n ** 18n;

export const isTokenCurrency1 = (token: string, quoteToken: string) => BigInt(quoteToken) < BigInt(token);

export const quoteUnitsPerWholeToken = (sqrtPriceX96: bigint, tokenIsCurrency1: boolean) => {
  const currency1PerCurrency0X192 = sqrtPriceX96 * sqrtPriceX96;
  const quotePerTokenWad = tokenIsCurrency1
    ? (Q192 * WAD * WAD) / currency1PerCurrency0X192
    : (currency1PerCurrency0X192 * WAD * WAD) / Q192;
  return new BigDecimal(quotePerTokenWad.toString()).shiftedBy(-18);
};
