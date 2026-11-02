# Hasp

An agent may swap NEAR only inside a rule.

At most 0.02 NEAR. USDC only. Once per agent account.

Site: https://theclasp.vercel.app

![The clasp, before a quote is checked.](docs/home.png)

A quote that breaks the rule is dropped. Nothing is deposited. A quote that fits can open one NEAR Intents deposit. Hasp holds no keys and cannot send the NEAR. Until that NEAR arrives, nothing is deposited. If the deposit fails, the page says so. Settled is shown only when NEAR Intents reports `SUCCESS`.

Track: Agent Economy (`agents`).

## The other project

This is the second project. The first is [Kyrona](https://github.com/thesithunyein/kyrona), a spending desk with its own contract and its own key. Hasp does not use that contract, that key, or that desk. The two do not share code.

## What happened

Account `sithunyein.near`.

One deposit of 0.02 NEAR was refunded. NEAR Intents reported `REFUNDED` with reason `NO_LIQUIDITY`. The 0.02 NEAR went back to that account. The page said the deposit failed and nothing was kept.

A second deposit settled. NEAR Intents reported `SUCCESS`: 0.02 NEAR in, 0.082181 USDC out, nothing refunded. The USDC is in the Intents balance for `sithunyein.near`, not in the NEAR balance of a wallet. The page now says the clasp is shut and will not open again for that account.

Deposit address: `aec93e908cfb10059e100ced9b324da6bc0bc4aa321fff98c39c0a4af7356a93`

Status: https://1click.chaindefuser.com/v0/status?depositAddress=aec93e908cfb10059e100ced9b324da6bc0bc4aa321fff98c39c0a4af7356a93

NEAR transactions: [9kPEnrpySh2X7qzoYAepsSbqofMENPYTWZUh28ivqCp](https://nearblocks.io/txns/9kPEnrpySh2X7qzoYAepsSbqofMENPYTWZUh28ivqCp), [xDrRSHsxmpQNB8JzmqddVTtwqKQRq2W61xLaC5dXJUL](https://nearblocks.io/txns/xDrRSHsxmpQNB8JzmqddVTtwqKQRq2W61xLaC5dXJUL)

## Do this

From this repository, with Node. These commands ask for a dry quote. They deposit nothing.

```sh
node scripts/hasp-agent.mjs 0.03 name.near
```

See `DROPPED`. Nothing is deposited.

```sh
node scripts/hasp-agent.mjs 0.02 name.near
```

See `FITS`, then a USDC amount. Nothing is deposited.

On https://theclasp.vercel.app:

1. Enter an agent account that has not settled. Amount `0.03`. Check. The quote is dropped.
2. Amount `0.02`. Check. The quote fits. Nothing is deposited yet.
3. Open deposit. An address appears, or the page says the deposit failed. Send the 0.02 NEAR yourself.
4. Read status. The clasp stays open until Intents says `SUCCESS`. A failure reopens it and says so.

`sithunyein.near` is already shut. A second account can still try. The rule is per account.

## NEAR

The quote is a mainnet NEAR Intents 1Click quote. Origin is wrapped NEAR. Destination is USDC, paid into Intents for that account. There is no testnet for Intents. The agent script uses a dry quote. The site asks for a deposit address only after the rule fits.

## What this is not

- Not a wallet, and not a key.
- Not a job board, a chat, or a second spending desk.
- A dry quote is not a deposit.
- A deposit address is not a settled swap.
