# Hasp

An agent may swap NEAR only inside a rule.

At most 0.02 NEAR. USDC only. Once per agent account.

A quote that breaks the rule is dropped. Nothing is deposited. A quote that fits can open one NEAR Intents deposit. Hasp holds no keys. Until that NEAR arrives, nothing is deposited. If the deposit fails, it stops and says so. Settled is shown only when NEAR Intents reports it.

Track: Agent Economy (`agents`).

## The other project

This is the second project. The first is [Kyrona](https://github.com/thesithunyein/kyrona), a spending desk with its own contract and its own key. Hasp does not use that contract, that key, or that desk. The two do not share code.

## Do this

From this repository, with Node:

```sh
node scripts/hasp-agent.mjs 0.03 name.near
```

See `DROPPED`, then a USDC quote. Nothing is deposited.

```sh
node scripts/hasp-agent.mjs 0.02 name.near
```

See `FITS`, then a USDC amount. Nothing is deposited.

On the site, enter that same agent account.

1. Amount `0.03`. Check. The quote is shown, then dropped.
2. Amount `0.02`. Check. The quote fits. Nothing is deposited yet.
3. Open deposit. NEAR Intents returns an address, or the page says the deposit failed. Send the NEAR yourself. Hasp cannot send it.
4. Read status. The clasp stays open until Intents says `SUCCESS`. A failure reopens it and says so.

`name.near` can be any real NEAR account. The rule is per account, so a second account can still try.

## NEAR

The quote is a mainnet NEAR Intents 1Click quote. Origin is wrapped NEAR. Destination is USDC, paid into Intents for that account. There is no testnet for Intents. The agent uses a dry quote. The site asks for a deposit address only after the rule fits.

## What this is not

- Not a wallet, and not a key.
- Not a job board, a chat, or a second spending desk.
- A dry quote is not a deposit.
- A deposit address is not a settled swap.
