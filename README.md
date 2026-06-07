# GitHub Vault Sync

An [Obsidian](https://obsidian.md) plugin that syncs your vault with a GitHub repository in one click.

## Features

- One-click sync via ribbon button or Command Palette
- Pulls remote changes before pushing local ones
- Automatically detects the current branch
- PAT token is stored securely outside the vault using Obsidian's local storage API — it will never be committed to git

## Requirements

- [Git](https://git-scm.com) installed on your system
- Your vault must be a git repository (`git init` inside the vault folder)
- A GitHub repository to sync with
- A GitHub [Personal Access Token](https://github.com/settings/tokens) with `repo` scope

## Installation

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](../../releases/latest)
2. Create a folder `github-vault-sync` inside your vault's `.obsidian/plugins/` directory
3. Place the downloaded files inside that folder
4. Enable the plugin in Obsidian: **Settings → Community plugins → GitHub Vault Sync**

## Configuration

Go to **Settings → GitHub Vault Sync** and fill in:

| Field | Description |
|-------|-------------|
| **Repository URL** | HTTPS URL of your GitHub repo (e.g. `https://github.com/username/repo.git`) |
| **Personal Access Token** | GitHub PAT with `repo` scope |

## Usage

Click the **cloud upload** icon in the left ribbon, or run **Sync vault with GitHub** from the Command Palette (`Ctrl+P`).

The plugin will:
1. Pull changes from the remote repository
2. Stage all local changes
3. Commit with a timestamp (`Obsidian Auto Sync DD/MM/YYYY, HH:MM:SS`)
4. Push to the remote repository

## License

[MIT](LICENSE)
