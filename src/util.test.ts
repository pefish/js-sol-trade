import { Logger } from "@pefish/js-logger";
import { Connection } from "@solana/web3.js";
import { parseOrderTransaction } from "./util";

describe("util", () => {
  before(async () => {});

  it("parseOrderTransaction", async () => {
    const order = await parseOrderTransaction(
      new Logger(),
      new Connection("https://api.mainnet-beta.solana.com", {
        commitment: "confirmed",
      }),
      "3GBMVDFauKP1Euiz8dK9GFS4xtqhkCgSzoJQ1yEsPABqA9Heru461tSJZbAMsjjYXpzfeYC7b29JfN2EaZxJAtLv"
    );
    console.log(order);
  });
});
