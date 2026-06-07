const { Plugin, Notice, PluginSettingTab, Setting } = require('obsidian');
const { execFile } = require('child_process');
const path = require('path');

const DEFAULT_SETTINGS = {
    repoUrl: ''
};

class QuickGitHubSyncPlugin extends Plugin {
    syncing = false;

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('cloud-upload', 'Sync vault with GitHub', () => this.sync());

        this.addCommand({
            id: 'sync',
            name: 'Sync vault with GitHub',
            callback: () => this.sync()
        });

        this.addSettingTab(new QuickGitHubSyncSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getToken() {
        return this.app.loadLocalStorage('quick-github-sync:token') ?? '';
    }

    setToken(value) {
        this.app.saveLocalStorage('quick-github-sync:token', value);
    }

    run(args) {
        return new Promise((resolve, reject) => {
            execFile('git', args, (err, stdout, stderr) => {
                if (err) reject(stderr || err.message);
                else resolve(stdout.trim());
            });
        });
    }

    buildRemoteUrl(repoUrl, token) {
        const url = new URL(repoUrl);
        if (url.protocol !== 'https:') {
            throw new Error('only HTTPS URLs are supported');
        }
        url.username = token;
        url.password = '';
        return url.toString();
    }

    redact(str, token) {
        return token ? str.split(token).join('***') : str;
    }

    async sync() {
        if (this.syncing) {
            new Notice('Quick GitHub Sync: sync already in progress');
            return;
        }

        const { repoUrl } = this.settings;
        const token = this.getToken();

        if (!repoUrl || !token) {
            new Notice('Quick GitHub Sync: please fill in the plugin settings');
            return;
        }

        let remote;
        try {
            remote = this.buildRemoteUrl(repoUrl, token);
        } catch (e) {
            new Notice(`Quick GitHub Sync: invalid repository URL — ${e.message}`);
            return;
        }

        const vault = this.app.vault.adapter.basePath;

        let gitRoot;
        try {
            gitRoot = await this.run(['-C', vault, 'rev-parse', '--show-toplevel']);
        } catch {
            new Notice('Quick GitHub Sync: vault is not a git repository');
            return;
        }

        if (path.resolve(gitRoot) !== path.resolve(vault)) {
            new Notice('Quick GitHub Sync: vault is inside another git repository — aborting to prevent unintended staging');
            return;
        }

        const git = (...args) => this.run(['-C', vault, ...args]);
        const now = new Date().toLocaleString('en-GB');

        this.syncing = true;
        new Notice('Quick GitHub Sync: syncing...');

        try {
            let branch;
            try {
                branch = await git('rev-parse', '--abbrev-ref', 'HEAD');
            } catch (e) {
                new Notice(`Quick GitHub Sync: failed to detect branch\n${e}`);
                return;
            }

            try {
                await git('pull', remote, branch);
            } catch (e) {
                new Notice(`Quick GitHub Sync: pull failed\n${this.redact(e, token)}`);
                return;
            }

            try {
                await git('add', '.');
            } catch (e) {
                new Notice(`Quick GitHub Sync: staging failed\n${e}`);
                return;
            }

            try {
                await git('commit', '-m', `Obsidian Auto Sync ${now}`);
            } catch (_) {
                // nothing to commit — continue
            }

            try {
                await git('push', remote, branch);
            } catch (e) {
                new Notice(`Quick GitHub Sync: push failed\n${this.redact(e, token)}`);
                return;
            }

            new Notice('Quick GitHub Sync: sync complete');
        } finally {
            this.syncing = false;
        }
    }
}

class QuickGitHubSyncSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Quick GitHub Sync' });

        new Setting(containerEl)
            .setName('Repository URL')
            .setDesc('HTTPS URL of your GitHub repository (e.g. https://github.com/username/repo.git)')
            .addText(text => text
                .setPlaceholder('https://github.com/username/repo.git')
                .setValue(this.plugin.settings.repoUrl)
                .onChange(async (value) => {
                    this.plugin.settings.repoUrl = value.trim();
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Personal Access Token')
            .setDesc('GitHub PAT with repo scope. Create one at: GitHub → Settings → Developer settings → Personal access tokens')
            .addText(text => {
                text.inputEl.type = 'password';
                text.setPlaceholder('ghp_...')
                    .setValue(this.plugin.getToken())
                    .onChange((value) => {
                        this.plugin.setToken(value.trim());
                    });
            });
    }
}

module.exports = QuickGitHubSyncPlugin;
