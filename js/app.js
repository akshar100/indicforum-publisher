/**
 * IndicForum Publisher - Main Application Controller
 */

(function () {
  // Application State
  const AppState = {
    config: {
      pat: localStorage.getItem('if_pat') || '',
      repo: localStorage.getItem('if_repo') || 'akshar100/indicforum-static',
      branch: localStorage.getItem('if_branch') || 'main',
      domain: localStorage.getItem('if_domain') || 'https://indicforum.org',
      assetDir: localStorage.getItem('if_asset_dir') || 'assets/images'
    },
    user: null,
    repoInfo: null,
    client: null,
    history: JSON.parse(localStorage.getItem('if_history') || '[]'),
    activeTab: 'dashboard',
    
    // Image Uploader State
    imageUpload: {
      file: null,
      base64: null,
      dataUrl: null,
      filename: '',
      targetPath: '',
      isUploading: false
    },

    // Zip Event State
    zipEvent: {
      file: null,
      parsed: null,
      isPublishing: false
    },

    // PWA deferred prompt
    deferredPrompt: null
  };

  // DOM Elements
  const DOM = {};

  // Initialize App
  document.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    initServiceWorker();
    initPwaInstall();
    initNavigation();
    initSettings();
    initImageUploader();
    initZipUploader();
    initVisualBuilder();
    initGithubClient();
    renderHistory();

    // Check token on start
    if (AppState.config.pat) {
      testGithubConnection(false);
    } else {
      updateConnectionStatus('unconfigured');
    }
  });

  function cacheDomElements() {
    DOM.connStatus = document.getElementById('conn-status');
    DOM.connUser = document.getElementById('conn-user');
    DOM.toastContainer = document.getElementById('toast-container');
    DOM.installBtn = document.getElementById('pwa-install-btn');

    // Settings
    DOM.patInput = document.getElementById('setting-pat');
    DOM.repoInput = document.getElementById('setting-repo');
    DOM.branchInput = document.getElementById('setting-branch');
    DOM.domainInput = document.getElementById('setting-domain');
    DOM.assetDirInput = document.getElementById('setting-asset-dir');
    DOM.saveSettingsBtn = document.getElementById('btn-save-settings');
    DOM.testSettingsBtn = document.getElementById('btn-test-settings');
    DOM.togglePatBtn = document.getElementById('btn-toggle-pat');

    // Image Uploader
    DOM.imgDropzone = document.getElementById('img-dropzone');
    DOM.imgInput = document.getElementById('img-file-input');
    DOM.imgPreviewSection = document.getElementById('img-preview-section');
    DOM.imgPreviewEl = document.getElementById('img-preview-img');
    DOM.imgMetaEl = document.getElementById('img-meta');
    DOM.imgFilenameInput = document.getElementById('img-filename-input');
    DOM.imgPathInput = document.getElementById('img-path-input');
    DOM.imgCommitMsgInput = document.getElementById('img-commit-msg');
    DOM.imgUploadBtn = document.getElementById('btn-upload-image');
    DOM.imgResultSection = document.getElementById('img-result-section');
    DOM.imgCancelBtn = document.getElementById('btn-cancel-image');

    // Zip Event Creator
    DOM.zipDropzone = document.getElementById('zip-dropzone');
    DOM.zipInput = document.getElementById('zip-file-input');
    DOM.btnDownloadSample = document.getElementById('btn-download-sample');
    DOM.zipPreviewSection = document.getElementById('zip-preview-section');
    DOM.zipFilesList = document.getElementById('zip-files-list');
    DOM.zipValidationAlert = document.getElementById('zip-validation-alert');
    DOM.zipEventCardContainer = document.getElementById('zip-card-container');
    DOM.zipCommitMsgInput = document.getElementById('zip-commit-msg');
    DOM.btnPublishZip = document.getElementById('btn-publish-zip');
    DOM.btnCancelZip = document.getElementById('btn-cancel-zip');
    DOM.zipResultSection = document.getElementById('zip-result-section');

    // History
    DOM.historyTable = document.getElementById('history-table-body');
    DOM.historyEmpty = document.getElementById('history-empty');
    DOM.btnClearHistory = document.getElementById('btn-clear-history');
  }

  // --- SERVICE WORKER & PWA ---
  function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(
          (reg) => console.log('SW registered:', reg.scope),
          (err) => console.warn('SW registration failed:', err)
        );
      });
    }
  }

  function initPwaInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      AppState.deferredPrompt = e;
      if (DOM.installBtn) DOM.installBtn.classList.remove('hidden');
    });

    if (DOM.installBtn) {
      DOM.installBtn.addEventListener('click', async () => {
        if (!AppState.deferredPrompt) return;
        AppState.deferredPrompt.prompt();
        const { outcome } = await AppState.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('IndicForum Publisher installed successfully!', 'success');
          DOM.installBtn.classList.add('hidden');
        }
        AppState.deferredPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      if (DOM.installBtn) DOM.installBtn.classList.add('hidden');
    });
  }

  // --- NAVIGATION & TABS ---
  function initNavigation() {
    const navButtons = document.querySelectorAll('[data-tab-target]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab-target');
        switchTab(tab);
      });
    });
  }

  function switchTab(tabId) {
    AppState.activeTab = tabId;
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(c => c.classList.add('hidden'));

    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.remove('hidden');

    const navButtons = document.querySelectorAll('[data-tab-target]');
    navButtons.forEach(btn => {
      const match = btn.getAttribute('data-tab-target') === tabId;
      if (match) {
        btn.classList.add('border-amber-500', 'text-amber-400', 'bg-amber-500/10');
        btn.classList.remove('border-transparent', 'text-stone-400');
      } else {
        btn.classList.remove('border-amber-500', 'text-amber-400', 'bg-amber-500/10');
        btn.classList.add('border-transparent', 'text-stone-400');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- GITHUB CLIENT & SETTINGS ---
  function initGithubClient() {
    AppState.client = new GitHubClient(
      AppState.config.pat,
      AppState.config.repo,
      AppState.config.branch,
      AppState.config.domain
    );
  }

  function initSettings() {
    // Populate form values
    DOM.patInput.value = AppState.config.pat;
    DOM.repoInput.value = AppState.config.repo;
    DOM.branchInput.value = AppState.config.branch;
    DOM.domainInput.value = AppState.config.domain;
    DOM.assetDirInput.value = AppState.config.assetDir;

    // Toggle password view
    DOM.togglePatBtn.addEventListener('click', () => {
      const isPassword = DOM.patInput.type === 'password';
      DOM.patInput.type = isPassword ? 'text' : 'password';
      DOM.togglePatBtn.textContent = isPassword ? 'Hide' : 'Show';
    });

    // Save Settings
    DOM.saveSettingsBtn.addEventListener('click', () => {
      saveSettings(true);
    });

    // Test Connection
    DOM.testSettingsBtn.addEventListener('click', () => {
      saveSettings(false);
      testGithubConnection(true);
    });
  }

  function saveSettings(showNotification = true) {
    const pat = DOM.patInput.value.trim();
    const repo = DOM.repoInput.value.trim();
    const branch = DOM.branchInput.value.trim() || 'main';
    const domain = DOM.domainInput.value.trim() || 'https://indicforum.org';
    const assetDir = DOM.assetDirInput.value.trim() || 'assets/images';

    AppState.config = { pat, repo, branch, domain, assetDir };
    localStorage.setItem('if_pat', pat);
    localStorage.setItem('if_repo', repo);
    localStorage.setItem('if_branch', branch);
    localStorage.setItem('if_domain', domain);
    localStorage.setItem('if_asset_dir', assetDir);

    initGithubClient();

    if (showNotification) {
      showToast('Settings saved successfully.', 'success');
      testGithubConnection(false);
    }
  }

  async function testGithubConnection(showToastMessage = false) {
    updateConnectionStatus('testing');
    try {
      initGithubClient();
      const result = await AppState.client.testConnection();
      AppState.user = result.user;
      AppState.repoInfo = result.repo;

      updateConnectionStatus('connected', result.user.login, result.repo.name);
      if (showToastMessage) {
        showToast(`Connected as @${result.user.login} with write access to ${result.repo.name}!`, 'success');
      }

      // Update Dashboard stats
      const elDashUser = document.getElementById('dash-github-user');
      const elDashRepo = document.getElementById('dash-github-repo');
      if (elDashUser) elDashUser.textContent = `@${result.user.login}`;
      if (elDashRepo) elDashRepo.textContent = result.repo.name;

    } catch (err) {
      updateConnectionStatus('error', err.message);
      if (showToastMessage) {
        showToast(err.message, 'error');
      }
    }
  }

  function updateConnectionStatus(status, user = '', repo = '') {
    if (!DOM.connStatus) return;

    if (status === 'connected') {
      DOM.connStatus.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60';
      DOM.connStatus.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Connected: <strong>@${user}</strong> (${repo})</span>
      `;
    } else if (status === 'testing') {
      DOM.connStatus.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60';
      DOM.connStatus.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        <span>Verifying GitHub Token...</span>
      `;
    } else if (status === 'unconfigured') {
      DOM.connStatus.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-800 text-stone-400 border border-stone-700';
      DOM.connStatus.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-stone-500"></span>
        <span>GitHub Token Not Configured</span>
      `;
    } else {
      DOM.connStatus.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800/60';
      DOM.connStatus.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-red-400"></span>
        <span title="${user}">Connection Error (Click Settings)</span>
      `;
    }
  }

  // --- IMAGE UPLOADER ---
  function initImageUploader() {
    // Drag & drop
    ['dragenter', 'dragover'].forEach(name => {
      DOM.imgDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        DOM.imgDropzone.classList.add('dropzone-active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      DOM.imgDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        DOM.imgDropzone.classList.remove('dropzone-active');
      });
    });

    DOM.imgDropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files[0]) handleSelectedImage(files[0]);
    });

    DOM.imgDropzone.addEventListener('click', () => DOM.imgInput.click());
    DOM.imgInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleSelectedImage(e.target.files[0]);
    });

    DOM.imgFilenameInput.addEventListener('input', updateImageTargetPath);
    DOM.imgCancelBtn.addEventListener('click', resetImageUploader);

    DOM.imgUploadBtn.addEventListener('click', executeImageUpload);
  }

  function handleSelectedImage(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP, SVG).', 'error');
      return;
    }

    AppState.imageUpload.file = file;

    // Slugify filename
    const ext = file.name.split('.').pop().toLowerCase();
    const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const cleanSlug = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const filename = `${cleanSlug}.${ext}`;

    AppState.imageUpload.filename = filename;
    DOM.imgFilenameInput.value = filename;
    updateImageTargetPath();

    // Read as Base64 & DataURL
    const reader = new FileReader();
    reader.onload = (e) => {
      AppState.imageUpload.dataUrl = e.target.result;
      AppState.imageUpload.base64 = e.target.result.split(',')[1];

      // Update UI
      DOM.imgPreviewEl.src = AppState.imageUpload.dataUrl;
      const sizeKb = (file.size / 1024).toFixed(1);
      DOM.imgMetaEl.textContent = `${file.name} • ${sizeKb} KB • ${file.type}`;
      DOM.imgCommitMsgInput.value = `Upload image: ${filename}`;

      DOM.imgDropzone.classList.add('hidden');
      DOM.imgPreviewSection.classList.remove('hidden');
      DOM.imgResultSection.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }

  function updateImageTargetPath() {
    const filename = DOM.imgFilenameInput.value.trim() || AppState.imageUpload.filename;
    const dir = AppState.config.assetDir.replace(/^\/|\/$/g, '');
    const targetPath = `${dir}/${filename}`;
    AppState.imageUpload.targetPath = targetPath;
    DOM.imgPathInput.value = targetPath;
  }

  function resetImageUploader() {
    AppState.imageUpload = {
      file: null,
      base64: null,
      dataUrl: null,
      filename: '',
      targetPath: '',
      isUploading: false
    };
    DOM.imgInput.value = '';
    DOM.imgDropzone.classList.remove('hidden');
    DOM.imgPreviewSection.classList.add('hidden');
    DOM.imgResultSection.classList.add('hidden');
    DOM.imgUploadBtn.disabled = false;
    DOM.imgUploadBtn.innerHTML = '<span>Upload to GitHub</span>';
  }

  async function executeImageUpload() {
    if (!AppState.config.pat) {
      showToast('Please configure your GitHub Personal Access Token in Settings.', 'error');
      switchTab('settings');
      return;
    }

    if (!AppState.imageUpload.base64 || !AppState.imageUpload.targetPath) {
      showToast('No image selected for upload.', 'error');
      return;
    }

    DOM.imgUploadBtn.disabled = true;
    DOM.imgUploadBtn.innerHTML = `
      <svg class="animate-spin h-4 w-4 mr-2 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      Uploading to GitHub...
    `;

    try {
      const commitMsg = DOM.imgCommitMsgInput.value.trim() || `Upload image: ${AppState.imageUpload.filename}`;
      const res = await AppState.client.putFile(
        AppState.imageUpload.targetPath,
        AppState.imageUpload.base64,
        commitMsg
      );

      // Display links
      displayImageUploadResults(res);
      showToast('Image uploaded successfully to GitHub!', 'success');

      // Record to history
      addHistoryRecord({
        type: 'image',
        title: AppState.imageUpload.filename,
        path: res.path,
        url: res.urls.domainUrl,
        commitSha: res.commitSha,
        commitUrl: res.commitUrl,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      DOM.imgUploadBtn.disabled = false;
      DOM.imgUploadBtn.innerHTML = '<span>Upload to GitHub</span>';
    }
  }

  function displayImageUploadResults(res) {
    DOM.imgPreviewSection.classList.add('hidden');
    DOM.imgResultSection.classList.remove('hidden');

    const urls = res.urls;
    document.getElementById('res-domain-url').value = urls.domainUrl;
    document.getElementById('res-raw-url').value = urls.rawUrl;
    document.getElementById('res-jsdelivr-url').value = urls.jsdelivrUrl;
    document.getElementById('res-markdown').value = urls.markdown;
    document.getElementById('res-html').value = urls.html;

    const commitLink = document.getElementById('res-commit-link');
    if (commitLink) {
      commitLink.href = res.commitUrl;
      commitLink.textContent = res.commitSha.substring(0, 7);
    }

    const previewLink = document.getElementById('res-preview-link');
    if (previewLink) previewLink.href = urls.domainUrl;

    // Attach copy button listeners
    document.querySelectorAll('[data-copy-target]').forEach(btn => {
      btn.onclick = () => {
        const targetId = btn.getAttribute('data-copy-target');
        const input = document.getElementById(targetId);
        if (input) copyToClipboard(input.value, btn);
      };
    });

    const btnUploadAnother = document.getElementById('btn-upload-another');
    if (btnUploadAnother) {
      btnUploadAnother.onclick = resetImageUploader;
    }
  }

  // --- EVENT CREATOR (ZIP UPLOADER) ---
  function initZipUploader() {
    // Download sample zip button
    DOM.btnDownloadSample.addEventListener('click', (e) => {
      e.preventDefault();
      ZipHandler.downloadSampleZip()
        .then(() => showToast('Sample Event Package downloaded!', 'success'))
        .catch(err => showToast(`Failed: ${err.message}`, 'error'));
    });

    // Drag & drop
    ['dragenter', 'dragover'].forEach(name => {
      DOM.zipDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        DOM.zipDropzone.classList.add('dropzone-active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      DOM.zipDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        DOM.zipDropzone.classList.remove('dropzone-active');
      });
    });

    DOM.zipDropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files[0]) handleSelectedZip(files[0]);
    });

    DOM.zipDropzone.addEventListener('click', () => DOM.zipInput.click());
    DOM.zipInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleSelectedZip(e.target.files[0]);
    });

    DOM.btnCancelZip.addEventListener('click', resetZipUploader);
    DOM.btnPublishZip.addEventListener('click', executeZipPublish);
  }

  async function handleSelectedZip(file) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      showToast('Please upload a .zip file.', 'error');
      return;
    }

    showToast('Unpacking and validating event package...', 'info');

    try {
      const parsed = await ZipHandler.parseEventZip(file);
      AppState.zipEvent.file = file;
      AppState.zipEvent.parsed = parsed;

      // Update UI
      DOM.zipDropzone.classList.add('hidden');
      DOM.zipPreviewSection.classList.remove('hidden');
      DOM.zipResultSection.classList.add('hidden');

      // Populate file breakdown
      DOM.zipFilesList.innerHTML = parsed.rawFiles.map(fn => `
        <li class="flex items-center gap-2 py-1 border-b border-stone-800 text-stone-300">
          <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span class="font-mono text-xs">${fn}</span>
        </li>
      `).join('');

      // Validation Alert
      if (parsed.errors.length > 0) {
        DOM.zipValidationAlert.classList.remove('hidden');
        DOM.zipValidationAlert.innerHTML = `
          <div class="font-semibold text-red-300 mb-1">Package Validation Warnings:</div>
          <ul class="list-disc list-inside space-y-0.5 text-xs text-red-200">
            ${parsed.errors.map(err => `<li>${err}</li>`).join('')}
          </ul>
        `;
        DOM.btnPublishZip.disabled = true;
      } else {
        DOM.zipValidationAlert.classList.add('hidden');
        DOM.btnPublishZip.disabled = false;
      }

      // Default commit message
      DOM.zipCommitMsgInput.value = `Add event: ${parsed.event.title}`;

      // Render Live Card Preview
      DOM.zipEventCardContainer.innerHTML = SiteGenerator.renderPreviewCard(
        parsed.event,
        parsed.cover ? parsed.cover.dataUrl : null
      );

    } catch (err) {
      showToast(`Failed to parse zip: ${err.message}`, 'error');
    }
  }

  function resetZipUploader() {
    AppState.zipEvent = {
      file: null,
      parsed: null,
      isPublishing: false
    };
    DOM.zipInput.value = '';
    DOM.zipDropzone.classList.remove('hidden');
    DOM.zipPreviewSection.classList.add('hidden');
    DOM.zipResultSection.classList.add('hidden');
    DOM.btnPublishZip.disabled = false;
  }

  async function executeZipPublish() {
    if (!AppState.config.pat) {
      showToast('Please configure your GitHub Personal Access Token in Settings.', 'error');
      switchTab('settings');
      return;
    }

    const parsed = AppState.zipEvent.parsed;
    if (!parsed || !parsed.event) {
      showToast('No valid event package loaded.', 'error');
      return;
    }

    DOM.btnPublishZip.disabled = true;
    DOM.btnPublishZip.innerHTML = `
      <svg class="animate-spin h-4 w-4 mr-2 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      Publishing Event to GitHub...
    `;

    try {
      // 1. Fetch current events.json
      showToast('Fetching latest events.json from repository...', 'info');
      const existingFile = await AppState.client.getFile('events.json');
      if (!existingFile) {
        throw new Error('Could not find "events.json" in the repository. Please verify repo & branch settings.');
      }

      // 2. Prepare cover image path
      const filesToCommit = [];
      let coverRelPath = parsed.event.cover_image;

      if (parsed.cover && parsed.cover.base64) {
        // Build slugified filename for cover
        const ext = parsed.cover.filename.split('.').pop().toLowerCase() || 'jpg';
        const cleanTitleSlug = parsed.event.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 40);
        const imagePath = `assets/images/${cleanTitleSlug}.${ext}`;
        coverRelPath = imagePath;

        filesToCommit.push({
          path: imagePath,
          content: parsed.cover.base64,
          encoding: 'base64'
        });
      }

      // 3. Merge event into events.json
      const { updatedJson, eventRecord } = SiteGenerator.mergeEventIntoJson(
        existingFile.content,
        parsed.event,
        coverRelPath
      );

      // Add updated events.json to commit files
      filesToCommit.push({
        path: 'events.json',
        content: updatedJson,
        encoding: 'utf-8'
      });

      // 4. Commit atomically via Git Data API
      showToast(`Committing ${filesToCommit.length} files atomically via Git Data API...`, 'info');
      const commitMsg = DOM.zipCommitMsgInput.value.trim() || `Add event: ${eventRecord.title}`;
      
      const commitResult = await AppState.client.createMultiFileCommit(filesToCommit, commitMsg);

      // Display results
      displayZipPublishResults(commitResult, eventRecord);
      showToast(`Event "${eventRecord.title}" published successfully! Vercel build triggered.`, 'success');

      // Record to history
      addHistoryRecord({
        type: 'event',
        id: eventRecord.id,
        title: eventRecord.title,
        speaker: eventRecord.primary_speaker,
        commitSha: commitResult.commitSha,
        commitUrl: commitResult.commitUrl,
        eventUrl: `${AppState.config.domain}/events/${eventRecord.id}.html`,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      showToast(`Publishing failed: ${err.message}`, 'error');
    } finally {
      DOM.btnPublishZip.disabled = false;
      DOM.btnPublishZip.innerHTML = '<span>Publish Event to GitHub</span>';
    }
  }

  function displayZipPublishResults(commitResult, eventRecord) {
    DOM.zipPreviewSection.classList.add('hidden');
    DOM.zipResultSection.classList.remove('hidden');

    const elTitle = document.getElementById('res-zip-title');
    const elId = document.getElementById('res-zip-id');
    const elCommitLink = document.getElementById('res-zip-commit-link');
    const elEventLink = document.getElementById('res-zip-event-link');
    const elFilesList = document.getElementById('res-zip-files-list');

    if (elTitle) elTitle.textContent = eventRecord.title;
    if (elId) elId.textContent = `#${eventRecord.id}`;

    if (elCommitLink) {
      elCommitLink.href = commitResult.commitUrl;
      elCommitLink.textContent = commitResult.commitSha.substring(0, 7);
    }

    if (elEventLink) {
      const liveUrl = `${AppState.config.domain}/events/${eventRecord.id}.html`;
      elEventLink.href = liveUrl;
      elEventLink.textContent = liveUrl;
    }

    if (elFilesList) {
      elFilesList.innerHTML = commitResult.filesCommitted.map(f => `
        <li class="font-mono text-xs text-stone-300 flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          ${f}
        </li>
      `).join('');
    }

    const btnPublishAnother = document.getElementById('btn-publish-another-zip');
    if (btnPublishAnother) {
      btnPublishAnother.onclick = resetZipUploader;
    }
  }

  // --- VISUAL EVENT BUILDER ---
  function initVisualBuilder() {
    const btnExportZip = document.getElementById('btn-builder-export-zip');
    const btnPublishDirect = document.getElementById('btn-builder-publish');
    const coverInput = document.getElementById('builder-cover-file');
    const coverPreview = document.getElementById('builder-cover-preview');

    let builderCover = null;

    if (coverInput) {
      coverInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          builderCover = {
            filename: file.name,
            mimeType: file.type,
            base64: ev.target.result.split(',')[1],
            dataUrl: ev.target.result
          };
          if (coverPreview) {
            coverPreview.src = builderCover.dataUrl;
            coverPreview.classList.remove('hidden');
          }
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnExportZip) {
      btnExportZip.addEventListener('click', async () => {
        const eventData = getBuilderEventData();
        if (!eventData.title || !eventData.primary_speaker) {
          showToast('Title and Primary Speaker are required.', 'error');
          return;
        }

        try {
          const zip = new window.JSZip();
          zip.file('event.json', JSON.stringify(eventData, null, 2));
          zip.file('description.md', eventData.description || '');

          if (builderCover) {
            zip.file(builderCover.filename, builderCover.base64, { base64: true });
          }

          const blob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${eventData.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)}-event.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToast('Event zip package generated and downloaded!', 'success');
        } catch (e) {
          showToast(`Export failed: ${e.message}`, 'error');
        }
      });
    }

    if (btnPublishDirect) {
      btnPublishDirect.addEventListener('click', async () => {
        const eventData = getBuilderEventData();
        if (!eventData.title || !eventData.primary_speaker) {
          showToast('Title and Primary Speaker are required.', 'error');
          return;
        }

        // Pass to Zip Publisher flow
        AppState.zipEvent.parsed = {
          isValid: true,
          errors: [],
          rawFiles: ['event.json', 'description.md', builderCover ? builderCover.filename : 'cover.jpg'],
          event: eventData,
          cover: builderCover
        };

        switchTab('event-zip');
        DOM.zipDropzone.classList.add('hidden');
        DOM.zipPreviewSection.classList.remove('hidden');
        DOM.zipResultSection.classList.add('hidden');
        DOM.zipValidationAlert.classList.add('hidden');
        DOM.btnPublishZip.disabled = false;

        DOM.zipCommitMsgInput.value = `Add event: ${eventData.title}`;
        DOM.zipFilesList.innerHTML = `
          <li class="flex items-center gap-2 py-1 text-stone-300 text-xs font-mono">From Visual Event Builder</li>
        `;
        DOM.zipEventCardContainer.innerHTML = SiteGenerator.renderPreviewCard(
          eventData,
          builderCover ? builderCover.dataUrl : null
        );
      });
    }
  }

  function getBuilderEventData() {
    return {
      title: document.getElementById('builder-title')?.value.trim() || '',
      primary_speaker: document.getElementById('builder-speaker')?.value.trim() || '',
      start_time: document.getElementById('builder-datetime')?.value.trim() || '',
      minutes: parseInt(document.getElementById('builder-minutes')?.value, 10) || 60,
      location: document.getElementById('builder-location')?.value.trim() || 'Zoom Online Webinar',
      status: document.getElementById('builder-status')?.value || 'upcoming',
      youtube_id: document.getElementById('builder-youtube')?.value.trim() || '',
      amazon_url: document.getElementById('builder-amazon')?.value.trim() || '',
      registration_url: document.getElementById('builder-registration')?.value.trim() || '',
      joining_information: document.getElementById('builder-joining')?.value.trim() || '',
      moderator: document.getElementById('builder-moderator')?.value.trim() || '',
      whatsapp_url: document.getElementById('builder-whatsapp')?.value.trim() || 'https://rebrand.ly/ifwap',
      contact_email: document.getElementById('builder-email')?.value.trim() || 'contact@indiccouncil.org',
      description: document.getElementById('builder-description')?.value.trim() || ''
    };
  }

  // --- HISTORY & ACTIVITY LOG ---
  function renderHistory() {
    if (!DOM.historyTable) return;

    if (AppState.history.length === 0) {
      if (DOM.historyEmpty) DOM.historyEmpty.classList.remove('hidden');
      DOM.historyTable.innerHTML = '';
      return;
    }

    if (DOM.historyEmpty) DOM.historyEmpty.classList.add('hidden');

    DOM.historyTable.innerHTML = AppState.history.slice(0, 15).map(item => {
      const isEvent = item.type === 'event';
      const typeBadge = isEvent
        ? `<span class="px-2 py-0.5 rounded text-xs bg-amber-950 text-amber-400 border border-amber-800">Event</span>`
        : `<span class="px-2 py-0.5 rounded text-xs bg-cyan-950 text-cyan-400 border border-cyan-800">Image</span>`;

      const dateStr = new Date(item.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <tr class="border-b border-stone-800/60 hover:bg-stone-900/40 transition-colors">
          <td class="py-3 px-4">${typeBadge}</td>
          <td class="py-3 px-4 font-medium text-stone-200">
            <div>${SiteGenerator.escapeHtml(item.title)}</div>
            ${item.speaker ? `<div class="text-xs text-stone-400">${SiteGenerator.escapeHtml(item.speaker)}</div>` : ''}
          </td>
          <td class="py-3 px-4 text-xs font-mono text-stone-400">
            <a href="${item.commitUrl}" target="_blank" rel="noopener" class="text-amber-400 hover:underline">
              ${item.commitSha.substring(0, 7)}
            </a>
          </td>
          <td class="py-3 px-4 text-xs text-stone-400">${dateStr}</td>
          <td class="py-3 px-4 text-right">
            <a href="${item.url || item.eventUrl}" target="_blank" rel="noopener" class="text-xs text-stone-300 hover:text-amber-400 underline">
              View
            </a>
          </td>
        </tr>
      `;
    }).join('');

    if (DOM.btnClearHistory) {
      DOM.btnClearHistory.onclick = () => {
        AppState.history = [];
        localStorage.removeItem('if_history');
        renderHistory();
        showToast('Activity history cleared.', 'info');
      };
    }
  }

  function addHistoryRecord(record) {
    AppState.history.unshift(record);
    if (AppState.history.length > 50) AppState.history.pop();
    localStorage.setItem('if_history', JSON.stringify(AppState.history));
    renderHistory();
  }

  // --- UTILITIES: TOAST & CLIPBOARD ---
  function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-900/90 border-emerald-600 text-emerald-100',
      error: 'bg-red-900/90 border-red-600 text-red-100',
      info: 'bg-stone-900/95 border-amber-600/60 text-amber-100'
    };

    toast.className = `toast max-w-md px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-sm font-medium ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      <div class="flex-1">${message}</div>
      <button class="text-stone-400 hover:text-white">&times;</button>
    `;

    toast.querySelector('button').onclick = () => toast.remove();
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function copyToClipboard(text, btnElement = null) {
    if (!navigator.clipboard) {
      showToast('Clipboard access unavailable.', 'error');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!', 'success');
      if (btnElement) {
        const originalText = btnElement.innerHTML;
        btnElement.classList.add('bg-emerald-600', 'text-white');
        btnElement.innerHTML = '<span>Copied!</span>';
        setTimeout(() => {
          btnElement.classList.remove('bg-emerald-600', 'text-white');
          btnElement.innerHTML = originalText;
        }, 1500);
      }
    }).catch(err => {
      showToast(`Copy failed: ${err.message}`, 'error');
    });
  }

  window.AppState = AppState;
})();
