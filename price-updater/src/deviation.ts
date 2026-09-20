const BASIS_POINTS = 10_000n;

export const UPDATE_THRESHOLD_BPS = 500n;

export const deviationBps = (currentPrice: bigint, marketPrice: bigint) => {
  const difference = marketPrice > currentPrice ? marketPrice - currentPrice : currentPrice - marketPrice;
  return (difference * BASIS_POINTS) / currentPrice;
};

export const shouldUpdatePrice = (currentPrice: bigint | undefined, marketPrice: bigint) =>
  currentPrice === undefined || deviationBps(currentPrice, marketPrice) > UPDATE_THRESHOLD_BPS;
