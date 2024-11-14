import { Wallet } from "@coral-xyz/anchor";
import { StringUtil } from "@pefish/js-node-assist";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import fetch from "cross-fetch";
import "dotenv/config";
import {
  Order,
  PUMP_FUN_TOKEN_DECIMALS,
  SOL_ADDRESS,
  SOL_DECIMALS,
} from "../constants";
import { parseOrderTransaction, sendRawTransactionByMultiNode } from "../util";

export async function placeOrder(
  connection: Connection,
  priv: string,
  type: "buy" | "sell",
  amount: string,
  tokenAddress: string,
  abortSignal: AbortSignal,
  nodeUrls: string[]
): Promise<Order> {
  const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(priv)));

  let url = "";
  if (type == "buy") {
    url = `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_ADDRESS}&outputMint=${tokenAddress}&amount=${StringUtil.start(
      amount
    )
      .shiftedBy(SOL_DECIMALS)
      .toString()}`;
  } else {
    url = `https://quote-api.jup.ag/v6/quote?inputMint=${tokenAddress}&outputMint=${SOL_ADDRESS}&amount=${StringUtil.start(
      amount
    )
      .shiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString()}`;
  }

  const quoteResponse: {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee: string | null;
    priceImpactPct: string;
    routePlan: {
      swapInfo: {
        ammKey: string;
        label: string;
        inputMint: string;
        outputMint: string;
        inAmount: string;
        outAmount: string;
        feeAmount: string;
        feeMint: string;
      };
      percent: number;
    }[];
    contextSlot: number;
    timeTaken: number;
  } = await (await fetch(url)).json();

  const instructions = await (
    await fetch("https://quote-api.jup.ag/v6/swap-instructions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicSlippage: {
          minBps: 50,
          maxBps: 500,
        },
        dynamicComputeUnitLimit: true,
        // computeUnitPriceMicroLamports: computeUnitPrice,
        //   prioritizationFeeLamports: "auto",
      }),
    })
  ).json();

  if (instructions.error) {
    throw new Error("Failed to get swap instructions: " + instructions.error);
  }

  const {
    setupInstructions,
    swapInstruction,
    cleanupInstruction,
    addressLookupTableAddresses,
  } = instructions;

  const addressLookupTableAccountInfos =
    await connection.getMultipleAccountsInfo(
      addressLookupTableAddresses.map((key) => new PublicKey(key))
    );

  const addressLookupTableAccounts = addressLookupTableAccountInfos.reduce(
    (acc, accountInfo, index) => {
      const addressLookupTableAddress = addressLookupTableAddresses[index];
      if (accountInfo) {
        const addressLookupTableAccount = new AddressLookupTableAccount({
          key: new PublicKey(addressLookupTableAddress),
          state: AddressLookupTableAccount.deserialize(accountInfo.data),
        });
        acc.push(addressLookupTableAccount);
      }

      return acc;
    },
    new Array<AddressLookupTableAccount>()
  );

  const deserializeInstruction = (instruction) => {
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, "base64"),
    });
  };

  const latestBlockhashInfo = await connection.getLatestBlockhash();
  let messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: latestBlockhashInfo.blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 150000,
      }),
      ...setupInstructions.map(deserializeInstruction),
      deserializeInstruction(swapInstruction),
      deserializeInstruction(cleanupInstruction),
    ],
  }).compileToV0Message(addressLookupTableAccounts);

  const accountKeys = messageV0.staticAccountKeys.map(
    (acc: PublicKey): string => {
      return acc.toString();
    }
  );
  const heliusUrls = nodeUrls.filter((url) => {
    return url.includes("helius");
  });
  if (heliusUrls.length == 0) {
    throw new Error("Helius url not be provided.");
  }
  const {
    result: { priorityFeeEstimate },
  } = await (
    await fetch(heliusUrls[0], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "helius-example",
        method: "getPriorityFeeEstimate",
        params: [
          {
            accountKeys: accountKeys,
            options: {
              recommended: true,
            },
          },
        ],
      }),
    })
  ).json();
  messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: latestBlockhashInfo.blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 150000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeEstimate,
      }),
      ...setupInstructions.map(deserializeInstruction),
      deserializeInstruction(swapInstruction),
      deserializeInstruction(cleanupInstruction),
    ],
  }).compileToV0Message(addressLookupTableAccounts);

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([wallet.payer]);
  const rawTransaction = transaction.serialize();
  const txId = await sendRawTransactionByMultiNode(nodeUrls, rawTransaction);
  global.logger.info(`<${txId}> 广播成功`);
  await connection.confirmTransaction({
    abortSignal: abortSignal,
    signature: txId,
    ...latestBlockhashInfo,
  });
  global.logger.info(`<${txId}> 已确认`);
  return await parseOrderTransaction(connection, txId);
}
