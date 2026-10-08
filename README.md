<p align="center">
  <img src="assets/logo.png" width="560" alt="FLAPPENING">
</p>

<p align="center">
  <b>Pick a meme. Pick a world. Flap. Die. Repeat.</b><br>
  A pixel flyer for PC and phone — 11 meme flyers with perks, 4 worlds, 8 pipe styles, FEVER mode and a leaderboard.
</p>

<p align="center">
  <a href="https://mywestlord.github.io/flappening/"><b>▶ PLAY NOW</b></a>
</p>

<p align="center">
  <img src="assets/og.png" width="760" alt="11 flyers, 4 worlds, 8 pipe styles">
</p>

## Screens

| Claude Code world | Pipe styles | Sausage Stack | FEVER mode | Rocket Silo |
|:---:|:---:|:---:|:---:|:---:|
| <img src="assets/shot-code.png" width="160"> | <img src="assets/shot-pipes.png" width="160"> | <img src="assets/shot-cloud.png" width="160"> | <img src="assets/shot-city.png" width="160"> | <img src="assets/shot-moon.png" width="160"> |

| Menu | Flyers | Worlds | Wasted |
|:---:|:---:|:---:|:---:|
| <img src="assets/shot-menu.png" width="160"> | <img src="assets/shot-flyers.png" width="160"> | <img src="assets/shot-maps.png" width="160"> | <img src="assets/shot-wasted.png" width="160"> |

## Flyers

Every flyer is hand-built pixel art with cel shading, a 6-frame flap, blinking eyes, its own flap sound, its own particles and its own **perk**.

| | Flyer | Perk | How to get |
|:---:|---|---|---|
| <img src="assets/flyer-wurst.png" width="96"> | **Wurst Wing** — a bird on a sausage, goggles and a scarf | **SNACK**: +1 coin every 5 points | free |
| <img src="assets/flyer-moon.png" width="96"> | **Moon Boi** — a bird in a space helmet riding a rocket | **BOOST**: stronger flaps, flame trail | free |
| <img src="assets/flyer-duck.png" width="96"> | **Debug Duck** — rubber duck with a headset and glasses | **RUBBER**: bounces off the ground once | free |
| <img src="assets/flyer-pigeon.png" width="96"> | **Pigeonardo Bombardini** — half pigeon, half bomber | **WAR CHEST**: coins worth x2, drops a bomb every 10 | 30 coins |
| <img src="assets/flyer-capy.png" width="96"> | **Capy Copter** — capybara, yuzu, propeller hat | **CHILL**: world moves 10% slower | 60 coins |
| <img src="assets/flyer-toast.png" width="96"> | **Toastito** — holy toast with a halo | **BLESSED**: wider PERFECT zone | 100 coins |
| <img src="assets/flyer-gull.png" width="96"> | **Chad Gull** — shades, gold chain, a stolen fry | **THIEF**: pulls coins from far away | 150 coins |
| <img src="assets/flyer-shark.png" width="96"> | **Sharko Turbini** — a shark in jet sneakers | **TURBO**: 15% faster, coins x2 | 200 coins |
| <img src="assets/flyer-cat.png" width="96"> | **Cardboard Cat** — drew wings on a box, it worked | **NINE LIVES**: survives the first hit | 250 coins |
| <img src="assets/flyer-burger.png" width="96"> | **Burgerini Jetpackini** — a double cheeseburger with a jetpack | **EXTRA CHEESE**: FEVER lasts twice as long | 300 coins |
| <img src="assets/flyer-brick.png" width="96"> | **Flying Brick** — physics said no | **HEAVY**: falls faster, +1 coin every pass | score 25 anywhere |

## Worlds

| World | Obstacles | Ambient | Death |
|---|---|---|---|
| **Cloud Nine** | marble columns with ivy | sun rays, bird flocks, petals | stars spin around your head — `OUCH!` |
| **Claude Code** | tool-call panels (`Edit`, `Bash`, `Read`, `Grep`, `Task`) with live diffs | a scrolling Claude Code session, welcome box, `Flapping...` spinner, prompt box, tokens instead of coins | glitch + `Error: bird collided with a pipe` / `Interrupted by user` — `INTERRUPTED` |
| **Wasted City** | neon towers with glowing signs | synthwave sun, rain, searchlights, a police chopper at 4 stars | world turns grey — `WASTED` |
| **To The Moon** | green `PUMP` / red `RUG` candles that move | twinkling stars, rockets, a live chart | red chart crashes across the screen — `RUGGED` |

## Pipe styles

Pick the obstacles in **PIPES** — they work on every world:

**World Default** (marble, tool calls, neon towers, candles) · **Sausage Stack** (grilled links + bun) · **Rocket Silo** (nose cones pointing at you) · **Candy Canes** · **Desert Cactus** · **Giant Pencils** · **$FLAP Stacks** (gold coin towers) · **Chaos Mix** (every pipe is a surprise)

## Game feel

- squash & stretch on every flap, per-flyer trails (flames, jets, mustard, crumbs, hearts, feathers, bombs)
- **PERFECT** passes through the centre, **CLOSE!** near-misses in slow motion
- every 10 points: giant banner, confetti and a fanfare
- **COMBO**: chain PERFECT / CLOSE passes — 3 in a row (or every 25 points) starts **FEVER**: rainbow trail, rainbow screen edges, afterimages, coins x2
- lightning storms over Wasted City
- hit-stop, screen shake and flash on death, coins fly into your counter
- glow on coins, neon and power-ups, speed lines when the world speeds up, pixel iris transitions
- **shield** and **magnet** power-ups, moving gaps as you improve

## Everything else

- flyer and world **carousels** with live animated previews, stats and swipe support
- animated logo, coin shop, a score-locked secret flyer
- **leaderboard**: top 10 per world on every device + optional world board ([worker/](worker/README.md))
- medals: bronze 10, silver 20, gold 40, diamond 80 — with a count-up and confetti on a new best
- **Share on X** from the game-over screen, chiptune music and SFX generated live, mute button
- **PC**: Space / ↑ / click, ← → in menus, P to pause · **phone**: tap, swipe, full-screen portrait, installable
- zero dependencies, zero build step: plain HTML + canvas + JS

## Run it locally

```bash
git clone https://github.com/MyWestLord/flappening
cd flappening
python3 -m http.server 8000   # open http://localhost:8000
```

## Credits

Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38 (SIL Open Font License, see `fonts/OFL.txt`).
All flyers, worlds and sounds are original and drawn in code.

MIT licensed.
