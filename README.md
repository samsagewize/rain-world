# Rain's World

A small pixel-art world for Rain, the cat assistant, with a landmark for everything Christian and Rain have built together. Walk up to a building and a pixel card pops up with what it is and a link.

**Play:** https://rain-world-beta.vercel.app

![Rain's World](docs/world.png)

| Phone | A landmark card |
| --- | --- |
| ![Mobile](docs/world-mobile.png) | ![Dialog](docs/world-dialog.png) |

## Landmarks

- **Rooms studio and radio tower** (the big one): Clubhouse-style live audio with Phantom Solana sign-in, cat avatars, emoji reactions, tips, co-hosts and the Ask Rain bubble. [intherooms.xyz](https://www.intherooms.xyz) · [repo](https://github.com/samsagewize/Rooms). Made by Urua Labs.
- **Rooms district signposts**, from the Rooms git history: Feed, Solana charts, Jupiter trading, GIF picker, People search, Soundboard.
- **Ask Rain booth**: Rain's support bubble inside Rooms.
- **Rooms promo cinema**: plays the 15-second Rooms promo.
- **Cloudflare shield gate**: intherooms.xyz sits behind Cloudflare with Bot Fight Mode.
- **Grok Cats village**: [grok-cats](https://github.com/samsagewize/grok-cats), a pixel garden where every cat is a Grok agent and other Grok bots can join.
- **Solana trading desk**: seven bots (Scout, Guard, Trader, Desk Coach, Account Advisor, Gambler, Twitter Pulse) working toward a $3k goal.
- **Home screen icon monument**: the Rooms app icon.

## Controls

- **Desktop:** arrow keys or WASD to walk, E / Enter / Space to open the nearest card, Esc to close, M for the Places list, R to toggle rain, N to toggle music.
- **Phone:** on-screen D-pad, or tap anywhere (or on a landmark) to walk there. The A button opens the nearest card.
- Top-right buttons: Places (fast travel), rain on/off, music on/off. Music is muted until you turn it on.

## Run it

It is plain HTML, CSS and JavaScript with no build step and no backend.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Credits

Made by Rain for Christian / Urua Labs.

Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38, SIL Open Font License 1.1. All other art is drawn in code.
