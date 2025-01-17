import "./appsignal.js";

import { accountFromAny } from "@cosmjs/stargate";
import { Protocol } from "./config.js";
import { querier } from "./query.js";
import { ORCHESTRATOR } from "./wallet.js";
import * as bow from "./workers/bow.js";
import { createGrant, getGrant } from "./workers/index.js";
import * as usk from "./workers/usk.js";

const ENABLED = [...usk.contracts, ...bow.contracts];

const run = async () => {
  await Promise.all(
    ENABLED.map(
      async (c: { address: string; protocol: Protocol }, idx: number) => {
        switch (c.protocol) {
          case Protocol.BOW:
            return bow.run(c.address, idx + 1);
          case Protocol.USK:
            return usk.run(c.address, idx + 1);
        }
      }
    )
  );
};

(async function () {
  const orchestrator = await ORCHESTRATOR;

  try {
    const any = await querier.auth.account(orchestrator[1]);
    const account = any && accountFromAny(any);
    console.info(`[STARTUP] Orchestrator: ${account?.address}`);
  } catch (error: any) {
    console.error(`Account ${orchestrator[1]} does not exist. Send funds.`);
    process.exit();
  }

  const grants = await Promise.all(ENABLED.map((x, idx) => getGrant(idx + 1)));

  await Promise.all(
    grants.reduce((agg, grant, idx: number) => {
      return grant ? agg : [...agg, createGrant(idx + 1)];
    }, [] as Promise<void>[])
  );

  try {
    await run();
  } catch (error: any) {
    console.error(error);
  } finally {
    await run();
  }
})();
