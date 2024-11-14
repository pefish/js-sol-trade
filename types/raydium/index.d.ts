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
    id: string;
    mintA: PoolInfoToken;
    mintB: PoolInfoToken;
    price: number;
    mintAmountA: number;
    mintAmountB: number;
    feeRate: number;
    openTime: string;
    tvl: number;
    marketId: string;
    lpMint: PoolInfoToken;
    lpPrice: number;
    lpAmount: number;
    burnPercent: number;
    day: PriceInfo;
    week: PriceInfo;
    month: PriceInfo;
}
export declare function getPoolInfoByLPAddress(lpAddress: string): Promise<PoolInfo>;
export declare function getPoolInfoByTokenAddress(tokenAddress: string): Promise<PoolInfo>;
export {};
