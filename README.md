# Hasp

An agent may swap NEAR only through this clasp.

- At most 0.02 NEAR
- USDC only
- Once per agent account

A quote that breaks the rule is dropped. Nothing is deposited.
A quote that fits can open one NEAR Intents deposit for that account. Hasp holds no keys. Until the NEAR arrives, nothing is deposited. If the deposit fails, it stops and says so.

## Other project

Independent of [Kyrona](https://github.com/thesithunyein/kyrona). Kyrona is a spending desk with its own contract and its own key. Hasp does not use that contract, that key, or that desk.

## Run the agent

The agent asks for a dry quote. It never sends NEAR.

```sh
node scripts/hasp-agent.mjs 0.03 name.near
node scripts/hasp-agent.mjs 0.02 name.near
```

The first prints `DROPPED`. The second prints `FITS` and the USDC amount. Neither deposits.

On the site, enter that agent account and the same amount. Check, then open the deposit only if it fits. Read status. Settled only when NEAR Intents says so.
