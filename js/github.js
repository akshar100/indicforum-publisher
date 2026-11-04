/**
 * GitHub API Client for IndicForum Publisher
 * Supports both GitHub REST API (Contents API) and Git Data API (atomic multi-file commits).
 */

class GitHubClient {
  constructor(token, repo = 'akshar100/indicforum-static', branch = 'main', domain = 'https://indicforum.org') {
    this.token = token?.trim() || '';
    this.repo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    this.branch = branch?.trim() || 'main';
    this.domain = domain?.trim().replace(/\/$/, '') || 'https://indicforum.org';
    this.apiBase = 'https://api.github.com';
  }

  get headers() {
    return {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  get owner() {
    return this.repo.split('/')[0] || '';
  }

  get repoName() {
    return this.repo.split('/')[1] || '';
  }

  /**
   * Test token validity and repo access
   */
  async testConnection() {
    if (!this.token) {
      throw new Error('Please enter a GitHub Personal Access Token.');
    }
    if (!this.repo || !this.repo.includes('/')) {
      throw new Error('Repository must be formatted as "owner/repo" (e.g., akshar100/indicforum-static).');
    }

    // 1. Check authenticated user
    const userRes = await fetch(`${this.apiBase}/user`, { headers: this.headers });
    if (!userRes.ok) {
      if (userRes.status === 401) throw new Error('Invalid or expired GitHub Personal Access Token.');
      throw new Error(`GitHub User API error: ${userRes.status} ${userRes.statusText}`);
    }
    const user = await userRes.json();

    // 2. Check repo access and push permission
    const repoRes = await fetch(`${this.apiBase}/repos/${this.repo}`, { headers: this.headers });
    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        throw new Error(`Repository "${this.repo}" was not found or your token lacks access permissions.`);
      }
      throw new Error(`GitHub Repo API error: ${repoRes.status} ${repoRes.statusText}`);
    }
    const repoData = await repoRes.json();

    const canPush = repoData.permissions ? repoData.permissions.push : true;
    if (!canPush) {
      throw new Error(`Token authenticated as @${user.login}, but lacks write/push permissions to "${this.repo}".`);
    }

    return {
      success: true,
      user: {
        login: user.login,
        name: user.name || user.login,
        avatar: user.avatar_url
      },
      repo: {
        name: repoData.full_name,
        private: repoData.private,
        default_branch: repoData.default_branch,
        canPush
      }
    };
  }

  /**
   * Fetch a single file from the repository
   */
  async getFile(path) {
    const cleanPath = path.replace(/^\//, '');
    const url = `${this.apiBase}/repos/${this.repo}/contents/${cleanPath}?ref=${encodeURIComponent(this.branch)}`;
    const res = await fetch(url, { headers: this.headers });

    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch file "${cleanPath}": ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data.type !== 'file') {
      throw new Error(`Target path "${cleanPath}" is a directory or submodule, not a file.`);
    }

    // Decode base64 UTF-8 content
    const rawBase64 = data.content.replace(/\s/g, '');
    let textContent = '';
    try {
      const binaryStr = atob(rawBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      textContent = new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      textContent = atob(rawBase64);
    }

    return {
      path: data.path,
      sha: data.sha,
      size: data.size,
      content: textContent,
      rawBase64: rawBase64
    };
  }

  /**
   * Upload or update a single file via GitHub Contents API
   */
  async putFile(path, contentBase64, message = 'Upload file', existingSha = null) {
    const cleanPath = path.replace(/^\//, '');
    const url = `${this.apiBase}/repos/${this.repo}/contents/${cleanPath}`;

    // If existingSha not provided, check if file exists
    let sha = existingSha;
    if (!sha) {
      try {
        const existing = await this.getFile(cleanPath);
        if (existing) sha = existing.sha;
      } catch (e) {
        // file doesn't exist, proceed
      }
    }

    const payload = {
      message,
      content: contentBase64,
      branch: this.branch
    };
    if (sha) payload.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Failed to upload ${cleanPath}: ${errBody.message || res.statusText}`);
    }

    const result = await res.json();
    return {
      success: true,
      path: cleanPath,
      commitSha: result.commit.sha,
      commitUrl: result.commit.html_url,
      urls: this.generateUrls(cleanPath)
    };
  }

  /**
   * Create an atomic multi-file commit using Git Data API (Blobs -> Trees -> Commits -> Ref)
   * files: Array of { path: string, content: string, encoding: 'utf-8'|'base64' }
   */
  async createMultiFileCommit(files, message = 'Update IndicForum content') {
    if (!files || files.length === 0) {
      throw new Error('No files provided for commit.');
    }

    // 1. Get latest commit SHA on the branch
    const refRes = await fetch(`${this.apiBase}/repos/${this.repo}/git/ref/heads/${encodeURIComponent(this.branch)}`, {
      headers: this.headers
    });
    if (!refRes.ok) {
      throw new Error(`Failed to get ref for branch "${this.branch}": ${refRes.status} ${refRes.statusText}`);
    }
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get base tree SHA from the latest commit
    const commitRes = await fetch(`${this.apiBase}/repos/${this.repo}/git/commits/${latestCommitSha}`, {
      headers: this.headers
    });
    if (!commitRes.ok) {
      throw new Error(`Failed to get commit ${latestCommitSha}: ${commitRes.status} ${commitRes.statusText}`);
    }
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs for each file
    const treeEntries = [];
    for (const file of files) {
      const cleanPath = file.path.replace(/^\//, '');
      const blobPayload = {
        content: file.content,
        encoding: file.encoding || 'utf-8'
      };

      const blobRes = await fetch(`${this.apiBase}/repos/${this.repo}/git/blobs`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(blobPayload)
      });

      if (!blobRes.ok) {
        const err = await blobRes.json().catch(() => ({}));
        throw new Error(`Failed to create blob for "${cleanPath}": ${err.message || blobRes.statusText}`);
      }

      const blobData = await blobRes.json();
      treeEntries.push({
        path: cleanPath,
        mode: '100644', // standard file mode
        type: 'blob',
        sha: blobData.sha
      });
    }

    // 4. Create new tree
    const treeRes = await fetch(`${this.apiBase}/repos/${this.repo}/git/trees`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries
      })
    });
    if (!treeRes.ok) {
      const err = await treeRes.json().catch(() => ({}));
      throw new Error(`Failed to create tree: ${err.message || treeRes.statusText}`);
    }
    const treeData = await treeRes.json();
    const newTreeSha = treeData.sha;

    // 5. Create commit
    const newCommitRes = await fetch(`${this.apiBase}/repos/${this.repo}/git/commits`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        message,
        tree: newTreeSha,
        parents: [latestCommitSha]
      })
    });
    if (!newCommitRes.ok) {
      const err = await newCommitRes.json().catch(() => ({}));
      throw new Error(`Failed to create commit: ${err.message || newCommitRes.statusText}`);
    }
    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;

    // 6. Update reference heads/{branch}
    const updateRefRes = await fetch(`${this.apiBase}/repos/${this.repo}/git/refs/heads/${encodeURIComponent(this.branch)}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({
        sha: newCommitSha,
        force: false
      })
    });
    if (!updateRefRes.ok) {
      const err = await updateRefRes.json().catch(() => ({}));
      throw new Error(`Failed to update branch ref: ${err.message || updateRefRes.statusText}`);
    }

    return {
      success: true,
      commitSha: newCommitSha,
      commitUrl: `https://github.com/${this.repo}/commit/${newCommitSha}`,
      filesCommitted: files.map(f => f.path)
    };
  }

  /**
   * Generate multiple public URLs for an uploaded asset
   */
  generateUrls(path) {
    const cleanPath = path.replace(/^\//, '');
    const domainUrl = `${this.domain}/${cleanPath}`;
    const rawUrl = `https://raw.githubusercontent.com/${this.repo}/${this.branch}/${cleanPath}`;
    const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/${this.repo}@${this.branch}/${cleanPath}`;

    return {
      domainUrl,
      rawUrl,
      jsdelivrUrl,
      markdown: `![${cleanPath.split('/').pop()}](${domainUrl})`,
      html: `<img src="${domainUrl}" alt="${cleanPath.split('/').pop()}" />`
    };
  }
}

window.GitHubClient = GitHubClient;
