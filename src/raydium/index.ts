import HttpUtil from "@pefish/js-http";

// 通过 /pools/info/lps 拿到 pool id。这里有问题，一开始根本请求不到，大概几分钟后才能请求到
// https://api-v3.raydium.io/pools/info/mint?mint1={{token address}}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=100&page=1
// https://api-v3.raydium.io/pools/info/ids?ids={{pool id}}
// https://api-v3.raydium.io/pools/info/lps?lps={{lp token address}}

interface PoolInfoToken {
  address: string;
  logoURI: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface PriceInfo {
  volume: number;
  volumeQuote: number;
  volumeFee: number;
  apr: number;
  feeApr: number;
  priceMin: number;
  priceMax: number;
  rewardApr: any[];
}

interface PoolInfo {
  type: string;
  id: string; // pool id
  mintA: PoolInfoToken;
  mintB: PoolInfoToken;
  price: number;
  mintAmountA: number;
  mintAmountB: number;
  feeRate: number;
  openTime: string;
  tvl: number;
  marketId: string; // OpenBookMarket id
  lpMint: PoolInfoToken; // lp address
  lpPrice: number;
  lpAmount: number;
  burnPercent: number;
  day: PriceInfo;
  week: PriceInfo;
  month: PriceInfo;
}

export async function getPoolInfoByLPAddress(
  lpAddress: string
): Promise<PoolInfo> {
  const httpResult: {
    success: boolean;
    data: PoolInfo[];
  } = await HttpUtil.get(
    `https://api-v3.raydium.io/pools/info/lps?lps=${lpAddress}`
  );
  if (!httpResult.success) {
    throw new Error("/pools/info/lps 请求失败");
  }
  return httpResult.data[0];
}

export async function getPoolInfoByTokenAddress(
  tokenAddress: string
): Promise<PoolInfo> {
  const httpResult: {
    success: boolean;
    data: {
      count: number;
      data: PoolInfo[];
    };
  } = await HttpUtil.get(
    `https://api-v3.raydium.io/pools/info/mint?mint1=${tokenAddress}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=100&page=1`
  );
  if (!httpResult.success) {
    throw new Error("/pools/info/mint 请求失败");
  }
  return httpResult.data.data[0];
}
