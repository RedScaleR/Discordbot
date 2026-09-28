# Changelog

## 1.6.1

- start.bat and keep-running.bat check Mochi's packages on every start and install anything missing (fixes "Cannot find module '@napi-rs/canvas'")
- The updater installs packages more reliably on Windows and double-checks they're all there
- A command that fails to load is skipped with a message instead of crashing Mochi

## 1.6.0

- Shop: add items, badges and roles in the dashboard's new Shop tab, then people /shop, /buy and check their /inventory
- /profile draws a cute profile card with your level, rank, coins, streak and badges
- /blackjack with hit, stand and double
- /coinflip can take a bet: call heads or tails to double your coins
- Weekly /lottery: buy tickets, one lucky winner takes the whole pot
- Set a biggest-bet limit and the lottery day, hour and channel in Settings → Economy

## 1.5.2

- Flirty pack: /kiss /peck /blowkiss /kabedon /lappillow /carry
- Chaos pack: /punch /dropkick /yeet /shoot /tableflip /baka /bleh
- Mochi warns if two commands share a name instead of silently dropping one

## 1.5.1

- AI chat picks a working model by itself when the Model box is empty, and picks again if a model gets retired (fixes "model does not exist" with Groq)
- "Load models" only lists models that can chat
- "Try it out" shows which model answered

## 1.5.0

- Update-Mochi.bat: download a new zip, double-click, done. Your token, settings and data stay safe, and it backs up your data first
- Updates no longer overwrite your settings (config.json isn't in the zip anymore)
- Your own command files can go in a my-commands folder, which updates never touch
- New GIF actions: /cuddle /wave /bonk /slap /tickle /bite /feed /handhold, plus /emote for dancing, crying, blushing and more
- Free AI chat: @Mochi to talk to it. Pick Ollama, Groq, Gemini or OpenRouter and a personality in the dashboard

## 1.4.0

- autostart-on.bat and autostart-off.bat to start Mochi with Windows
- keep-running.bat restarts Mochi if it stops unexpectedly
- Mochi won't run twice at the same time

## 1.3.0

- Web dashboard at http://localhost:3000 with stats, members and settings
- Backup GIF sites

## 1.2.0

- Clearer messages when GIFs can't load

## 1.1.0

- GIFs for /hug /pat /boop /highfive

## 1.0.0

- Mochi is born :3
