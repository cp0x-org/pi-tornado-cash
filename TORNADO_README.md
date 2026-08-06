# Tornado Cash Classic UI

> UI for non-custodial Ethereum Privacy solution

## Building locally

- Install [Node.js](https://nodejs.org) version 14
  - If you are using [nvm](https://github.com/creationix/nvm#installation) (recommended) running `nvm use` will automatically choose the right node version for you.
- Install [Yarn](https://yarnpkg.com/en/docs/install)
- Install dependencies: `yarn`
- Copy the `.env.example` file to `.env`
  - Replace environment variables with your own personal.
- Build the project to the `./dist/` folder with `yarn generate`.

## Development builds

To start a development build (e.g. with logging and file watching) run `yarn dev`.

## Deploy on IPFS

- Make sure you set `PINATA_API_KEY` and `PINATA_SECRET_API_KEY` environment variables in `.env`
- To deploy a production build run `yarn deploy-ipfs`.

## Architecture

For detailed explanation on how things work, checkout [Nuxt.js docs](https://nuxtjs.org).

## Audit

[TornadoCash_Classic_dApp_audit_Decurity.pdf](https://tornado.cash/audits/TornadoCash_Classic_dApp_audit_Decurity.pdf)

## Update cached files

### Automatic (docker compose)

`docker-compose.yml` runs two services: `ui` (the generated site served by nuxt)
and `cache-updater`, which refreshes ALL caches (events, encrypted notes, trees,
zip, governance) on start and then every `UPDATE_INTERVAL_SECONDS` (default:
weekly). Caches live in `./data/{events,trees,governance-cache}` on the host,
shared between both containers, so the UI picks up updates without a rebuild
(empty dirs are seeded from the image on the first updater start):

```
docker compose up -d
docker compose logs -f cache-updater   # watch update progress
```

Force an update out of schedule:

```
docker compose exec cache-updater bash scripts/updateCaches.sh 1
```

One-shot full update locally (chains all commands below in the right order):

```
yarn update:caches 1
```

RPC endpoints are configured in `rpcConfig.js` (only Ethereum mainnet is
actively used by this deployment).

### Manual (individual commands)

- For update deposits and withdrawals events use `yarn update:events {chainId}`
- For update encrypted notes use `yarn update:encrypted {chainId}`
- For update merkle tree use `yarn update:tree {chainId}`
- For update governance cache use `yarn update:governance-cache {chainId}`

#### NOTE!

After update cached files do not forget to use `yarn update:zip`

### Example for Ethereum Mainnet:

```
yarn update:events 1
yarn update:encrypted 1
yarn update:tree 1

yarn update:zip
```

### Example for Binance Smart Chain:

```
yarn update:events 56
yarn update:encrypted 56

yarn update:zip
```
