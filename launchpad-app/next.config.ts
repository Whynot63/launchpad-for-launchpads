import type { NextConfig } from "next";

const UNUSED_OPTIONAL_WALLET_SDK_IMPORTS = [
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm/exact/client",
];

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: Object.fromEntries(
      UNUSED_OPTIONAL_WALLET_SDK_IMPORTS.map((specifier) => [specifier, "./src/stubs/empty.js"]),
    ),
  },
};

export default nextConfig;
