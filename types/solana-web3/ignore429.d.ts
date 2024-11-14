import { AccountInfo, Commitment, ConfirmedSignatureInfo, Connection, Finality, GetAccountInfoConfig, GetMultipleAccountsConfig, ParsedAccountData, ParsedTransactionWithMeta, PublicKey, RpcResponseAndContext, SendOptions, SignaturesForAddressOptions, TransactionSignature } from "@solana/web3.js";
export declare function getParsedTransaction(connection: Connection, txId: string): Promise<ParsedTransactionWithMeta>;
export declare function getMultipleParsedAccounts(connection: Connection, publicKeys: PublicKey[], rawConfig?: GetMultipleAccountsConfig): Promise<RpcResponseAndContext<AccountInfo<Buffer | ParsedAccountData>[]>>;
export declare function getAccountInfo(connection: Connection, publicKey: PublicKey, commitmentOrConfig?: Commitment | GetAccountInfoConfig): Promise<AccountInfo<Buffer>>;
export declare function getSignaturesForAddress(connection: Connection, address: PublicKey, options?: SignaturesForAddressOptions, commitment?: Finality): Promise<ConfirmedSignatureInfo[]>;
export declare function sendRawTransaction(connection: Connection, rawTransaction: Buffer | Uint8Array | Array<number>, options?: SendOptions): Promise<TransactionSignature>;
