# World leaderboard (optional)

Out of the box FLAPPENING keeps a top 10 per map on each device.
To get one shared **world** board for everyone, deploy this worker (free Cloudflare plan is enough):

```bash
npm i -g wrangler
wrangler login
cd worker
wrangler kv namespace create LB        # copy the id it prints into wrangler.toml
wrangler deploy                         # prints https://flappening-lb.<you>.workers.dev
```

Then open `js/config.js` and set:

```js
leaderboardUrl: 'https://flappening-lb.<you>.workers.dev'
```

Push, and the LEADERBOARD screen gets a **WORLD** tab. Scores are validated (known map + flyer, 1–999, 12-char names) and rate-limited per IP.
