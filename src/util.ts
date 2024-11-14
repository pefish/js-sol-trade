import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  Metaplex,
  toMetadata,
  toMetadataAccount,
} from "@metaplex-foundation/js";
import HttpUtil from "@pefish/js-http";
import { StringUtil } from "@pefish/js-node-assist";
import TimeUtil from "@pefish/js-util-time";
import {
  bool,
  i64,
  publicKey,
  struct,
  u128,
  u64,
  u8,
} from "@raydium-io/raydium-sdk-v2";
import {
  Connection,
  ParsedInnerInstruction,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
} from "@solana/web3.js";
import axios from "axios";
import needle from "needle";
import { inspect } from "util";
import {
  GetParsedAccountInfoData,
  JupiterAggregatorEventAuthority,
  JupiterAggregatorV6,
  Order,
  ParsedTransferTokenData,
  PUMP_FUN_ADDRESS,
  PUMP_FUN_TOKEN_DECIMALS,
  RaydiumLiquidityPoolV4,
  SOL_ADDRESS,
  SOL_DECIMALS,
} from "./constants";

import { ILogger } from "@pefish/js-logger";
import {
  getAccountInfo,
  getMultipleParsedAccounts,
  getParsedTransaction,
  getSignaturesForAddress,
  sendRawTransaction,
} from "./solana-web3/ignore429";

export function findInnerInstructions(
  transaction: ParsedTransactionWithMeta,
  instructionIndex: number
): (ParsedInstruction | PartiallyDecodedInstruction)[] {
  // 找到内部指令
  let innerInstruction: ParsedInnerInstruction = null;
  for (const innerInstruction_ of transaction.meta.innerInstructions) {
    if (innerInstruction_.index == instructionIndex) {
      innerInstruction = innerInstruction_;
      break;
    }
  }
  if (!innerInstruction) {
    throw new Error(
      `<${transaction.transaction.signatures}> 没有找到 swap 的内部指令`
    );
  }
  return innerInstruction.instructions;
}

export async function sendRawTransactionByMultiNode(
  logger: ILogger,
  urls: string[],
  rawTransaction: Buffer | Uint8Array | Array<number>
): Promise<string> {
  const promises = [];
  for (const url of urls) {
    promises.push(
      (async () => {
        const connection = new Connection(url);
        logger.info(`使用 ${url} 广播`);
        const txid = await sendRawTransaction(connection, rawTransaction, {
          skipPreflight: true,
          maxRetries: 5,
        });
        logger.info(`${url} 广播成功 ${txid}`);
        return txid;
      })()
    );
  }
  const results = await Promise.allSettled<string>(promises);
  let txid = "";
  let errors = [];
  for (const result of results) {
    if (result.status == "fulfilled") {
      txid = result.value;
      break;
    } else {
      errors.push(result.reason);
    }
  }
  if (txid == "") {
    throw new Error(`交易广播失败 ${errors}`);
  }
  return txid;
}

export async function parseOrderTransaction(
  logger: ILogger,
  connection: Connection,
  txId: string
): Promise<Order | null> {
  logger.debug(`parsing <${txId}>...`);
  const transaction = await getParsedTransaction(connection, txId);
  if (transaction.meta.err) {
    return null;
  }
  const order: Order = {
    tx_id: txId,
    sol_amount: "0",
    token_amount: "0",
    fee: "0",
    user: transaction.transaction.message.accountKeys[0].pubkey.toString(),
  };

  for (const [
    index,
    instruction,
  ] of transaction.transaction.message.instructions.entries()) {
    switch (instruction.programId.toString()) {
      case RaydiumLiquidityPoolV4:
        logger.debug(`<${txId}> is raydium swap`);
        const raydiumSwapInstruction =
          instruction as PartiallyDecodedInstruction;
        order.router_name = "RaydiumLiquidityPoolV4";
        if (
          bs58
            .decode(raydiumSwapInstruction.data)
            .subarray(0, 1)
            .toString("hex") != "09"
        ) {
          continue;
        }
        const coinTokenAccount = raydiumSwapInstruction.accounts[5];
        const pcTokenAccount = raydiumSwapInstruction.accounts[6];
        const coinPcAccounts = await getMultipleParsedAccounts(
          connection,
          [coinTokenAccount, pcTokenAccount],
          {
            commitment: "confirmed",
          }
        );

        const coinTokenAccountData: GetParsedAccountInfoData = coinPcAccounts
          .value[0].data as GetParsedAccountInfoData;
        const pcTokenAccountData: GetParsedAccountInfoData = coinPcAccounts
          .value[1].data as GetParsedAccountInfoData;
        // logger.info(coinTokenAccountInfo);
        let coinIsSol = false;
        if (coinTokenAccountData.parsed.info.isNative) {
          // logger.info(`coin is sol`);
          coinIsSol = true;
          order.token_address = pcTokenAccountData.parsed.info.mint;
        } else {
          order.token_address = coinTokenAccountData.parsed.info.mint;
        }
        // logger.info(`token address is <${order.token_address}>`);

        const raydiumSwapInnerInstructions = findInnerInstructions(
          transaction,
          index
        );
        // logger.info(raydiumSwapInnerInstructions);
        const transferParsedData0: ParsedTransferTokenData = (
          raydiumSwapInnerInstructions[0] as ParsedInstruction
        ).parsed;
        const transferParsedData1: ParsedTransferTokenData = (
          raydiumSwapInnerInstructions[1] as ParsedInstruction
        ).parsed;
        if (
          (transferParsedData0.info.destination ==
            coinTokenAccount.toString() &&
            coinIsSol) ||
          (transferParsedData0.info.destination !=
            coinTokenAccount.toString() &&
            !coinIsSol)
        ) {
          order.type = "buy";
          order.sol_amount = StringUtil.start(transferParsedData0.info.amount)
            .unShiftedBy(SOL_DECIMALS)
            .toString();
          order.token_amount = StringUtil.start(transferParsedData1.info.amount)
            .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
            .toString();
        } else {
          order.type = "sell";
          order.sol_amount = StringUtil.start(transferParsedData1.info.amount)
            .unShiftedBy(SOL_DECIMALS)
            .toString();
          order.token_amount = StringUtil.start(transferParsedData0.info.amount)
            .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
            .toString();
        }
        break;
      case JupiterAggregatorV6:
        logger.info(`<${txId}> is jupiter swap`);
        const jupiterSwapInstruction =
          instruction as PartiallyDecodedInstruction;
        order.router_name = "JupiterAggregatorV6";
        if (
          bs58
            .decode(jupiterSwapInstruction.data)
            .subarray(0, 8)
            .toString("hex") != "e517cb977ae3ad2a"
        ) {
          continue;
        }
        const jupiterSwapInnerInstructions = findInnerInstructions(
          transaction,
          index
        );
        const swapEventInnerInstruction: PartiallyDecodedInstruction =
          jupiterSwapInnerInstructions[3] as PartiallyDecodedInstruction;

        // logger.info(swapEventInnerInstruction);
        let feeEventInnerInstruction: PartiallyDecodedInstruction = null;
        if (jupiterSwapInnerInstructions.length >= 6) {
          feeEventInnerInstruction =
            jupiterSwapInnerInstructions[5] as PartiallyDecodedInstruction;
        }
        if (
          swapEventInnerInstruction.accounts[0].toString() !=
          JupiterAggregatorEventAuthority
        ) {
          throw new Error(
            `Account <${swapEventInnerInstruction.programId.toString()}> is not <Jupiter Aggregator Event Authority>`
          );
        }

        const swapEventParsedData = struct([
          u128("id"),
          publicKey("amm"),
          publicKey("inputMint"),
          u64("inputAmount"),
          publicKey("outputMint"),
          u64("outputAmount"),
        ]).decode(bs58.decode(swapEventInnerInstruction.data));
        // logger.info(swapEventParsedData);
        if (swapEventParsedData.inputMint.toString() == SOL_ADDRESS) {
          order.type = "buy";
          order.sol_amount = StringUtil.start(swapEventParsedData.inputAmount)
            .unShiftedBy(SOL_DECIMALS)
            .toString();
          order.token_amount = StringUtil.start(
            swapEventParsedData.outputAmount
          )
            .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
            .toString();
          order.token_address = swapEventParsedData.outputMint.toString();
        } else {
          order.type = "sell";
          order.sol_amount = StringUtil.start(swapEventParsedData.outputAmount)
            .unShiftedBy(SOL_DECIMALS)
            .toString();
          order.token_amount = StringUtil.start(swapEventParsedData.inputAmount)
            .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
            .toString();
          order.token_address = swapEventParsedData.inputMint.toString();
        }
        if (feeEventInnerInstruction) {
          const feeEventParsedData = struct([
            u128("id"),
            publicKey("account"),
            publicKey("mint"),
            u64("amount"),
          ]).decode(bs58.decode(feeEventInnerInstruction.data));
          order.fee = StringUtil.start(feeEventParsedData.amount)
            .unShiftedBy(SOL_DECIMALS)
            .toString();
        }
        break;
      case PUMP_FUN_ADDRESS:
        logger.debug(`<${txId}> is pump fun swap`);
        const pumpfunSwapInstruction =
          instruction as PartiallyDecodedInstruction;
        order.router_name = "PumpFun";
        const methodHex = bs58
          .decode(pumpfunSwapInstruction.data)
          .subarray(0, 8)
          .toString("hex");
        if (
          methodHex != "66063d1201daebea" &&
          methodHex != "33e685a4017f83ad"
        ) {
          continue;
        }

        const pumpfunSwapInnerInstructions = findInnerInstructions(
          transaction,
          index
        );
        // logger.info(pumpfunSwapInnerInstructions);
        const pumpfunLogInstruction = pumpfunSwapInnerInstructions[
          pumpfunSwapInnerInstructions.length - 1
        ] as PartiallyDecodedInstruction;
        // logger.info(pumpfunLogInstruction);
        const pumpfunSwapEventParsedData = struct([
          u128("id"),
          publicKey("mint"),
          u64("solAmount"),
          u64("tokenAmount"),
          bool("isBuy"),
          publicKey("user"),
          i64("timestamp"),
          u64("virtualSolReserves"),
          u64("virtualTokenReserves"),
        ]).decode(bs58.decode(pumpfunLogInstruction.data));
        // logger.info(pumpfunSwapEventParsedData);

        order.type = pumpfunSwapEventParsedData.isBuy ? "buy" : "sell";
        order.sol_amount = StringUtil.start(
          pumpfunSwapEventParsedData.solAmount
        )
          .unShiftedBy(SOL_DECIMALS)
          .toString();
        order.token_amount = StringUtil.start(
          pumpfunSwapEventParsedData.tokenAmount
        )
          .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
          .toString();
        order.token_address = pumpfunSwapEventParsedData.mint.toString();
        break;
      default:
        continue;
    }
  }
  if (!order.type) {
    logger.debug(`<${txId}> 没有找到交易`);
    return null;
  }

  return order;
}

export async function getTweetMetrics(
  keyword: string,
  token: string
): Promise<number> {
  const url = `https://api.twitter.com/2/tweets/search/recent`;
  const params = {
    query: keyword,
    max_results: 100,
    "tweet.fields": "public_metrics",
  };

  const res = await needle("get", url, params, {
    headers: {
      "User-Agent": "v2RecentSearchJS",
      authorization: `Bearer ${token}`,
    },
  });

  if (!res.body) {
    throw new Error("Unsuccessful request");
  }

  const tweets = res.body.data;
  if (!tweets) {
    throw new Error(`X 访问出错 ${inspect(res.body)}`);
  }

  let heatScore = 0;
  tweets.forEach((tweet) => {
    heatScore += tweet.public_metrics.like_count;
    heatScore += tweet.public_metrics.retweet_count;
    heatScore += tweet.public_metrics.reply_count;
  });

  return heatScore;
}

export function getMetadataAccount(
  connection: Connection,
  tokenAddress: string
): string {
  const metaplex = Metaplex.make(connection);
  const mintAddress = new PublicKey(tokenAddress);
  return metaplex.nfts().pdas().metadata({ mint: mintAddress }).toString();
}

// 获取 Token 的元数据地址
export async function getTokenMetadata(
  connection: Connection,
  tokenAddress: string
): Promise<{
  model: string;
  address: PublicKey;
  mintAddress: PublicKey;
  updateAuthorityAddress: PublicKey;
  json: any | null;
  jsonLoaded: boolean;
  name: string;
  symbol: string;
  uri: string;
  isMutable: boolean;
  primarySaleHappened: boolean;
  sellerFeeBasisPoints: number;
  editionNonce: number;
  creators: PublicKey[];
  tokenStandard: number;
  collection: any | null;
  collectionDetails: any | null;
  uses: any | null;
  programmableConfig: any | null;
}> {
  const metadataAccount = getMetadataAccount(connection, tokenAddress);
  const metadataAccountInfo = await getAccountInfo(
    connection,
    new PublicKey(metadataAccount)
  );

  return toMetadata(toMetadataAccount(metadataAccountInfo as any)) as any;
}

export async function getCreateInfoFromMetadataAccount(
  connection: Connection,
  metadataAccount: string
): Promise<{
  creator: string;
  timestamp: number;
}> {
  const signatureInfos = await getSignaturesForAddress(
    connection,
    new PublicKey(metadataAccount),
    {
      limit: 10,
    }
  );
  const createSignatureInfo = signatureInfos[signatureInfos.length - 1];
  const tx = await getParsedTransaction(
    connection,
    createSignatureInfo.signature
  );
  return {
    creator: tx.transaction.message.accountKeys[0].pubkey.toString(),
    timestamp: tx.blockTime * 1000,
  };
}

export async function getLPInfoFromLpAddress(
  connection: Connection,
  lpAddress: string
): Promise<{
  tokenAddress: string;
  initTokenAmountInLP: string;
  initSOLAmountInLP: string;
}> {
  const signatureInfos = await getSignaturesForAddress(
    connection,
    new PublicKey(lpAddress),
    {
      limit: 5,
    },
    "confirmed"
  );
  for (let i = signatureInfos.length - 1; i > 0; i--) {
    const r = await getLPInfoFromAddLPTx(
      connection,
      signatureInfos[i].signature
    );
    if (r == null) {
      continue;
    }
    return r;
  }
  return null;
}

export async function getLPInfoFromAddLPTx(
  connection: Connection,
  txId: string
): Promise<{
  tokenAddress: string;
  initTokenAmountInLP: string;
  initSOLAmountInLP: string;
  pairAddress: string;
  solPoolAddress: string;
  tokenPoolAddress: string;
}> {
  let parsedTx;
  while (!parsedTx) {
    parsedTx = await getParsedTransaction(connection, txId);
    await TimeUtil.sleep(500);
  }
  const instructions = parsedTx.transaction.message.instructions;
  if (instructions.length < 4) {
    return null;
  }
  if (instructions[3].programId.toString() != RaydiumLiquidityPoolV4) {
    return null;
  }
  const accounts: PublicKey[] = instructions[3]["accounts"];
  if (accounts.length < 10) {
    return null;
  }
  const schema = struct([
    u8("discriminator"),
    u8("nonce"),
    u64("openTime"),
    u64("initPcAmount"),
    u64("initCoinAmount"),
  ]);
  const r = schema.decode(bs58.decode(instructions[3]["data"] as string));
  let tokenAddress;
  let tokenAmount;
  let solAmount;
  let solPoolAddress;
  let tokenPoolAddress;
  if (accounts[9].toString() == "So11111111111111111111111111111111111111112") {
    // pc is sol, coin is token
    solPoolAddress = accounts[11];
    tokenPoolAddress = accounts[10];
    tokenAddress = accounts[8].toString();
    tokenAmount = StringUtil.start(r.initCoinAmount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString();
    solAmount = StringUtil.start(r.initPcAmount)
      .unShiftedBy(SOL_DECIMALS)
      .toString();
  } else {
    solPoolAddress = accounts[10];
    tokenPoolAddress = accounts[11];
    tokenAddress = accounts[9].toString();
    tokenAmount = StringUtil.start(r.initPcAmount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString();
    solAmount = StringUtil.start(r.initCoinAmount)
      .unShiftedBy(SOL_DECIMALS)
      .toString();
  }
  return {
    tokenAddress: tokenAddress,
    initSOLAmountInLP: solAmount,
    initTokenAmountInLP: tokenAmount,
    pairAddress: accounts[4].toString(),
    tokenPoolAddress,
    solPoolAddress,
  };
}

export async function getRedditToken(
  clientId: string,
  clientSecret: string
): Promise<{
  access_token: string;
  expires_in: number; // 单位 s
}> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const data = await HttpUtil.postFormData(
    "https://www.reddit.com/api/v1/access_token",
    {
      params: {
        grant_type: "client_credentials",
      },
      headers: {
        Authorization: `Basic ${auth}`,
        "User-Agent": "pefish_me/1.0.0",
      },
    }
  );

  return data;
}

export async function getRedditScore(
  keyword: string,
  token: string
): Promise<number> {
  const response = await axios.get(`https://oauth.reddit.com/search`, {
    params: {
      q: keyword,
      sort: "top",
      limit: 100,
    },
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "YourAppName/1.0.0",
    },
  });
  if (!response.data.data) {
    return 0;
  }
  if (!response.data.data.children || response.data.data.children.length == 0) {
    return 0;
  }
  let score = 0;
  for (const child of response.data.data.children) {
    score += child.data.score;
  }

  return score;
}
