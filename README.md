<p align="center">
  <img src="assets/logo.png" width="560" alt="FLAPPENING">
</p>

<p align="center">
  <b>Pick a meme. Pick a world. Flap. Die. Repeat.</b><br>
  A pixel flyer for PC and phone — 8 meme flyers, 4 worlds, coins, power-ups and a leaderboard.
</p>

<p align="center">
  <a href="https://mywestlord.github.io/flappening/"><b>▶ PLAY NOW</b></a>
</p>

<p align="center">
  <img src="assets/og.png" width="760" alt="8 flyers, 4 worlds">
</p>

## Screens

| Menu | Claude Code | To The Moon | Wasted City |
|:---:|:---:|:---:|:---:|
| <img src="assets/shot-menu.png" width="190"> | <img src="assets/shot-code.png" width="190"> | <img src="assets/shot-moon.png" width="190"> | <img src="assets/shot-wasted.png" width="190"> |

| Flyers | Maps | Cloud Nine | Neon run |
|:---:|:---:|:---:|:---:|
| <img src="assets/shot-flyers.png" width="190"> | <img src="assets/shot-maps.png" width="190"> | <img src="assets/shot-cloud.png" width="190"> | <img src="assets/shot-city.png" width="190"> |

## Flyers

| | Flyer | How to get | Vibe |
|:---:|---|---|---|
| <img src="assets/flyer-wurst.png" width="80"> | **Wurst Wing** | free | A bird on a sausage. Do not ask. |
| <img src="assets/flyer-moon.png" width="80"> | **Moon Boi** | free | A bird in a space helmet riding a rocket. One direction only: up. |
| <img src="assets/flyer-duck.png" width="80"> | **Debug Duck** | free | Explains your bug back to you. |
| <img src="assets/flyer-pigeon.png" width="80"> | **Pigeonardo Bombardini** | 30 coins | Half pigeon. Half bomber. All brainrot. |
| <img src="assets/flyer-capy.png" width="80"> | **Capy Copter** | 60 coins | Never stressed. Never landed. |
| <img src="assets/flyer-toast.png" width="80"> | **Toastito** | 100 coins | Butter side up. Always. |
| <img src="assets/flyer-gull.png" width="80"> | **Chad Gull** | 150 coins | Steals fries. Steals hearts. |
| <img src="assets/flyer-brick.png" width="80"> | **Flying Brick** | score 25 anywhere | Physics said no. He said yes. |

## Worlds

| World | Obstacles | Twist |
|---|---|---|
| **Cloud Nine** | marble columns with ivy | the warm-up |
| **Claude Code** | stacked terminal windows, code rain | every pass is a commit, death is a `SEGFAULT` |
| **Wasted City** | neon towers, synthwave sun, palms | wanted stars pile up, police lights, `WASTED` on death |
| **To The Moon** | green `PUMP` and red `RUG` candles | the candles move from score 3 — `RUGGED` on death |

## Features

- **Character select** with animated previews, coin shop and a score-locked secret flyer
- **4 maps**, each with its own sky, parallax, obstacles, ground, death screen and music key
- **Coins** in the gaps, **PERFECT** pass bonus, **shield** and **magnet** power-ups
- Moving gaps as you get better, speed ramps up
- **Leaderboard**: top 10 per map on every device + optional world board ([worker/](worker/README.md))
- **Medals**: bronze 10, silver 20, gold 40, diamond 80
- **Share on X** straight from the game-over screen
- Chiptune music and sound effects generated live (no audio files), mute button
- Works on **PC** (Space / ↑ / click, P to pause) and **phone** (tap, full-screen portrait, installable to home screen)
- Zero dependencies, zero build step: plain HTML + canvas + JS

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
