export const RaydiumLiquidityPoolV4 =
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

export const JupiterAggregatorV6 =
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

export const JupiterAggregatorEventAuthority =
  "D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf";

export const SOL_DECIMALS = 9;
export const PUMP_FUN_TOKEN_DECIMALS = 6;
export const SOL_ADDRESS = "So11111111111111111111111111111111111111112";

export interface ParsedTokenAccountData {
  info: {
    isNative: boolean;
    mint: string;
    owner: string;
    state: string;
    tokenAmount: {
      amount: string;
      decimals: number;
      uiAmount: number;
      uiAmountString: string;
    };
  };
  type: string;
}

export interface ParsedTransferTokenData {
  info: {
    amount: string;
    authority: string;
    destination: string;
    source: string;
  };
  type: string;
}

export interface GetParsedAccountInfoData {
  program: string;
  parsed: ParsedTokenAccountData;
  space: number;
}

export interface Order {
  type?: string;
  sol_amount: string;
  token_amount: string;
  tx_id: string;
  router_name?: string;
  fee: string;
  token_address?: string;
}
