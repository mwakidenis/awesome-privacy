
# Awesome Privacy API

The API allows you to browse awesome-privacy's data programmatically. It also runs some lookups/checks on listings to surface useful insights to add additional context to listings, and save time when comparing software / services.

> [!IMPORTANT]
> It's very important not to rely on this data for any decision making, as it only gives a very narrow slice of the picture. There's also many real privacy issues which the automated lookups have no way of detecting, as well as the possibility for false positives/negatives. Always do your own research.

These endpoints are used by as part of the website generation, the PR review process and the scheduled listing audits. You're also free to use it for your own purposes.

## Endpoints

For a full list of endpoints and usage, see the [API Docs](https://api.awesome-privacy.xyz) or download the [`openapi.json`](https://api.awesome-privacy.xyz/openapi.json).

Listing data
- Categories
- Sections
- Listings
- Search
- Stats

Enrichment data
- Privacy policy summary, score and data
- Known security vulnerabilities and scorecard
- GitHub repo health, license, versioning, contributors, etc
- Android trackers, permissions and de-googled compatibility
- iOS app versioning, size, reviews and info
- Docker container info
- Website security and hosting summary
- Community overview, from Discord, Reddit and Mastadon

---

## Development
Start by cloning the repo `git clone git@github.com:lissy93/awesome-privacy.git` then `cd awesome-privacy/api`

1. `bun install` - Install dependencies
2. `bun run build:data` - Build the data from `awesome-privacy.yml`
3. `bun run dev` - Start the development server (then open `http://localhost:8787`)

Or, to build + run the Docker container, use:
1. `docker build -t awesome-privacy-api .`
2. `docker run -p 8787:8787 --env-file .env awesome-privacy-api`

Before committing, make sure all checks pass:
- `bun run lint` - Linting
- `bun run typecheck` - TS typechecking
- `bun run format:check` - Check formatting
- `bun run test` - Run the test suite
- `bun run smoke` - Quick smoke test

---

## Deployment

#### Option 1: Docker
Use `docker run -p 9000:8787 lissy93/awesome-privacy-api`, then pop open `localhost:9000`

#### Option 2: Bare Metal
Follow the [development](#development) setup above, then run `bun start` to start the production server on `:8787`

#### Option 3: Cloudflare
Run `bun run deploy`. You'll need wrangler, and to be authenticated. 

<details>
<summary>authenticating</summary>

I recommend you use API token for this, as then you can scope it as narrowly as possible.<br>
Head to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens), then create one just like shown below.<br>
Then, set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` env vars in the context you run deploy in.

![creating api token](https://pixelflare.cc/alicia/screenshots/cloudflare-api-token-for-awesome-privacy)

</details>

---

## Configuring
By default no extra config needed.

#### Authentication
All endpoints are publicly exposed by default. You can change this, by setting an `API_TOKEN` env var, which will then require the `Authorization: Bearer <token>` header on the `/enrich/*` endpoints. 

#### Caching
If a KV is configured, then results from the enrich endpoints can be cached for a configurable amount of time once a success response if returned. This reduces load on upstream services.

#### Third-party fetching
Some of the enrich endpoints can also fetch from upstream providers to get some additional context. Some of these need API keys, if these keys aren't present, then those checks will just be skipped.
- `DISCORD_BOT_TOKEN`
- `APIVOID_API_KEY`
- `EXODUS_TOKEN`
- `GITHUB_TOKEN`
