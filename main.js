const { Plugin, Notice, PluginSettingTab, Setting } = require('obsidian');
const { exec } = require('child_process');

const DEFAULT_SETTINGS = {
    repoUrl: ''
};

class GitHubVaultSyncPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('cloud-upload', 'Sync vault with GitHub', () => this.sync());

        this.addCommand({
            id: 'github-vault-sync',
            name: 'Sync vault with GitHub',
            callback: () => this.sync()
        });

        this.addSettingTab(new GitHubVaultSyncSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getToken() {
        return this.app.loadLocalStorage('github-vault-sync:token') ?? '';
    }

    setToken(value) {
        this.app.saveLocalStorage('github-vault-sync:token', value);
    }

    run(cmd) {
        return new Promise((resolve, reject) => {
            exec(cmd, (err, stdout, stderr) => {
                if (err) reject(stderr || err.message);
                else resolve(stdout.trim());
            });
        });
    }

    buildRemoteUrl(repoUrl, token) {
        try {
            const url = new URL(repoUrl);
            url.username = token;
            return url.toString();
        } catch {
            return repoUrl;
        }
    }

    async sync() {
        const { repoUrl } = this.settings;
        const token = this.getToken();

        if (!repoUrl || !token) {
            new Notice('GitHub Vault Sync: please fill in the plugin settings');
            return;
        }

        const vault = this.app.vault.adapter.basePath;
        const remote = this.buildRemoteUrl(repoUrl, token);
        const git = (args) => this.run(`git -C "${vault}" ${args}`);
        const now = new Date().toLocaleString('en-GB');

        new Notice('GitHub Vault Sync: syncing...');

        let branch;
        try {
            branch = await git('rev-parse --abbrev-ref HEAD');
        } catch (e) {
            new Notice(`GitHub Vault Sync: failed to detect branch\n${e}`);
            return;
        }

        try {
            await git(`pull ${remote} ${branch}`);
        } catch (e) {
            new Notice(`GitHub Vault Sync: pull failed\n${e}`);
            return;
        }

        await git('add .');

        try {
            await git(`commit -m "Obsidian Auto Sync ${now}"`);
        } catch (_) {
            // nothing to commit — continue
        }

        try {
            await git(`push ${remote} ${branch}`);
        } catch (e) {
            new Notice(`GitHub Vault Sync: push failed\n${e}`);
            return;
        }

        new Notice('GitHub Vault Sync: sync complete');
    }
}

class GitHubVaultSyncSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'GitHub Vault Sync' });

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
                text.setPlaceholder('ghp_...')
                    .setValue(this.plugin.getToken())
                    .onChange((value) => {
                        this.plugin.setToken(value.trim());
                    });
                text.inputEl.type = 'password';
            });
    }
}

module.exports = GitHubVaultSyncPlugin;
