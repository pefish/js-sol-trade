import TimeUtil from "@pefish/js-util-time";
import {
  AccountInfo,
  Commitment,
  ConfirmedSignatureInfo,
  Connection,
  Finality,
  GetAccountInfoConfig,
  GetMultipleAccountsConfig,
  ParsedAccountData,
  ParsedTransactionWithMeta,
  PublicKey,
  RpcResponseAndContext,
  SendOptions,
  SignaturesForAddressOptions,
  TransactionSignature,
} from "@solana/web3.js";
import { inspect } from "util";

function isIgnoreErr(err): boolean {
  const errStr = inspect(err);
  return (
    errStr.includes("429 Too Many Requests") ||
    errStr.includes("Too many requests") ||
    errStr.includes("Connect Timeout") ||
    errStr.includes("read ECONNRESET")
  );
}

export async function getParsedTransaction(
  connection: Connection,
  txId: string
): Promise<ParsedTransactionWithMeta> {
  let transaction: ParsedTransactionWithMeta = null;
  while (true) {
    try {
      transaction = await connection.getParsedTransaction(txId, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (transaction) {
        return transaction;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getMultipleParsedAccounts(
  connection: Connection,
  publicKeys: PublicKey[],
  rawConfig?: GetMultipleAccountsConfig
): Promise<RpcResponseAndContext<AccountInfo<Buffer | ParsedAccountData>[]>> {
  let result = null;
  while (true) {
    try {
      result = await connection.getMultipleParsedAccounts(
        publicKeys,
        rawConfig
      );
      if (result) {
        return result;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getAccountInfo(
  connection: Connection,
  publicKey: PublicKey,
  commitmentOrConfig?: Commitment | GetAccountInfoConfig
): Promise<AccountInfo<Buffer>> {
  let result = null;
  while (true) {
    try {
      result = await connection.getAccountInfo(publicKey, commitmentOrConfig);
      if (result) {
        return result;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getSignaturesForAddress(
  connection: Connection,
  address: PublicKey,
  options?: SignaturesForAddressOptions,
  commitment?: Finality
): Promise<ConfirmedSignatureInfo[]> {
  let result = null;
  while (true) {
    try {
      result = await connection.getSignaturesForAddress(
        address,
        options,
        commitment
      );
      if (result) {
        return result;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function sendRawTransaction(
  connection: Connection,
  rawTransaction: Buffer | Uint8Array | Array<number>,
  options?: SendOptions
): Promise<TransactionSignature> {
  let result = null;
  while (true) {
    try {
      result = await connection.sendRawTransaction(rawTransaction, options);
      if (result) {
        return result;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}
