# Contributing

The rule does not change: at most 0.02 NEAR, USDC only, once per account. A patch that widens it will not be accepted.

A dry quote deposits nothing:

```sh
node scripts/hasp-agent.mjs 0.03 name.near
node scripts/hasp-agent.mjs 0.02 name.near
```

The first command should print `DROPPED`. The second should print `FITS`.

Do not commit secrets. Keys and `DATABASE_URL` stay in the environment.
