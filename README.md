# Broadside

**Broadside** is a naval-combat themed perpetuals trading game built on **Pacifica**.

It turns perp trading into a tactical battle experience: opening a long or short becomes firing a broadside, leverage becomes combat risk, and liquidation pressure becomes hull damage. The goal is to make trading feel more intuitive, engaging, and memorable through a game-native interface.

## For Judges

- **Track:** Pacifica Gaming Track
- **Project:** Broadside
- **What it does:** A battleship-style trading interface for perpetuals on Pacifica
- **Core idea:** Transform trading decisions into tactical naval combat mechanics
- **Built with:** Pacifica API, Next.js, Phaser, Zustand, Privy
- **Best way to evaluate:** Watch the demo, then try the live app

## Why Broadside

Perpetual trading interfaces are powerful, but they can feel sterile and intimidating. Broadside explores a different approach:

- make trading **visceral and game-like**
- make risk states more **readable through metaphor**
- create a more memorable and engaging way to interact with perps
- show how trading infrastructure can support **new consumer experiences**, not just standard dashboards

## How It Works

Players enter a naval battle command interface and trade perps through combat actions:

- **Open Long / Short** positions through the command panel
- **Adjust leverage** as your combat risk multiplier
- **Track PnL, liquidation risk, and market stats** through the HUD
- **Retreat** to close your position
- Watch price movement and position state play out in a real-time battleship UI

The experience reframes trading as tactical command rather than abstract chart clicking.

## Pacifica Integration

Broadside uses Pacifica for core trading functionality, including:

- perpetual market price access
- market statistics and position state
- leverage configuration
- market order execution
- position monitoring
- builder code approval flow

This project was built specifically to explore a **game-native frontend for Pacifica perps**.

## Features

- Naval-combat themed perp trading interface
- Real-time market-driven game state
- Command panel for trade execution
- HUD for position status, PnL, and risk
- Leaderboard / rank / mission progression
- Wallet connection flow
- Demo fallback support for presentation and testing

## Tech Stack

- **Frontend:** Next.js, React, TypeScript
- **Game Engine:** Phaser
- **State Management:** Zustand
- **Auth / Wallet:** Privy + Solana wallet support
- **API / Trading:** Pacifica
- **Styling:** CSS / Tailwind-era utility setup

## Demo

- **Live app:** [Add link]
- **Demo video:** [Add link]

## Screenshots

Add these before submission:
- Landing / wallet connect screen
- Main battle interface
- Command panel while opening a trade
- HUD showing active position / PnL / risk
- Optional GIF of opening and closing a position

## Local Development

```bash
npm install
npm run dev