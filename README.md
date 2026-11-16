# Atlas

An offline worldbuilding app for writers, game masters and storytellers. Keep your characters, places, factions, items, maps, timelines, boards, sheets, manuscripts and a static wiki of your world, all on your own computer.

> Status: in testing. Expect rough edges and report what you find.

## Features

- **Worlds** with a home page, a relationship graph, highlights and themes (dark, light, parchment).
- **Cards** with custom types, folders and colors, rich text, `@mentions` to other cards, `#tags`, and backlinks.
- **Maps** with pins, regions, zones, labels and paths (roads, rivers), with submaps.
- **Timelines** with eras, events, alternative versions, and births, foundations and endings.
- **Boards** and **relation trees**, with links that become real relations between cards.
- **Sheets and tables** for character traits, inventories and data.
- **Writing** with books, chapters, version history, focus mode and a radio of your own music.
- **Static wiki** that you can publish and open in your browser.
- **Import** from Obsidian, Notion, Word, Google Docs and World Anvil.
- **Art stock** of images organized by genre.
- **Workshop** of data-only extensions with ready-made templates.
- Portuguese (Brazil) and English.

Everything runs locally. There is no account, no login and no internet connection required after installation.

## Requirements

- Windows 10 or 11 (the installer is built for Windows).
- [Node.js](https://nodejs.org) 22 LTS, for building from source.

## Run from source

```
npm install
npm run dev
```

## Build the installer

```
npm install
npm run build
```

The installer is created in the `dist` folder. On Windows you can also double-click `GERAR-EXE.bat`.

## Project structure

```
src/main       Electron main process: database, file access, IPC
src/preload    Safe bridge between the interface and the main process
src/renderer   React interface
src/shared     Types shared by both sides
stock-art/     Art stock, organized by genre (see stock-art/README.md)
exemplos/      Example extension for the Workshop
```

Data is stored in your user folder (`%APPDATA%\Atlas\dados`), never in the project folder.

## License

See [LICENSE](LICENSE). Art in `stock-art/` has its own terms, see its README.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
