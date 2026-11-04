# IndicForum Publisher (PWA)

A Progressive Web App (PWA) that uses GitHub directly as its backend. It allows authorized publishers to upload image assets and publish new events to **[IndicForum.org](https://indicforum.org)** without needing a dedicated custom server or database.

---

## 🌟 Core Features

### 1. 🖼️ Image Uploader
- Upload images (`JPG`, `PNG`, `WebP`, `SVG`) directly to the target GitHub repository (`akshar100/indicforum-static`).
- Automatic filename slugification and customizable directory paths (default: `assets/images/`).
- Commits images to Git with custom commit messages.
- Instantly returns ready-to-use public URLs with one-click copy buttons:
  - **IndicForum Production URL**: `https://indicforum.org/assets/images/...`
  - **Raw GitHub URL**: `https://raw.githubusercontent.com/...`
  - **jsDelivr Global CDN URL**: `https://cdn.jsdelivr.net/gh/...`
  - **Markdown Snippet**: `![alt](url)`
  - **HTML Snippet**: `<img src="url" alt="alt" />`

### 2. 📦 Event Creator (.zip package upload)
- Drop or select a `.zip` archive containing:
  - `event.json` (Structured event metadata)
  - `description.md` (Rich talk description in GitHub Flavored Markdown)
  - `cover.jpg` / `cover.png` (High-resolution event banner)
- Unpacks entirely in-browser using JSZip.
- Live validation of fields, dates, and speaker info.
- Renders an authentic live preview card identical to IndicForum.org's production design.
- Uses the **GitHub Git Data API** (`blobs` ➔ `trees` ➔ `commits` ➔ `refs`) to perform an **atomic commit**:
  - Adds the cover image to `assets/images/`
  - Safely appends/merges the event into `events.json`
  - Generates the next sequential Event ID automatically
  - Triggers exactly one automatic Vercel production rebuild.

### 3. ✍️ Visual Event Builder
- Interactive web form to create events without manually assembling a zip archive.
- Fill in Title, Speaker, Date/Time, Location, Duration, Registration Link, YouTube URL, and Markdown Description.
- Preview your event live.
- Option to **Publish Directly to GitHub** or **Export as .Zip Archive**.

### 4. 📱 Progressive Web App (PWA)
- Installable on desktop (Chrome, Edge, Safari, Arc) and mobile (iOS Safari, Android Chrome).
- Offline-ready caching powered by Service Worker (`sw.js`).
- Secure: Personal Access Tokens are stored only in client-side `localStorage` and sent directly to `api.github.com`.

---

## 🚀 Quick Start

### Running Locally

```bash
# Clone the repository
git clone https://github.com/akshar100/indicforum-publisher.git
cd indicforum-publisher

# Start a local HTTP server
python3 -m http.server 8080
# or
npm run serve
```

Open `http://localhost:8080` in your browser.

---

## 🔑 GitHub Personal Access Token Setup

1. Visit **[GitHub Token Settings](https://github.com/settings/tokens)**.
2. Select **Generate new token (classic)**.
3. Check the **`repo`** scope (*Full control of private repositories*).
4. Generate and copy the token.
5. In IndicForum Publisher, open the **Settings** tab:
   - Paste the token into the **GitHub Personal Access Token** field.
   - Verify the target repository is set to `akshar100/indicforum-static`.
   - Click **Save Settings** & **Test Connection**.

---

## 📁 Event Zip Package Specification

A compliant event zip package must contain:

```text
my-event.zip
├── event.json        (Required: Event metadata)
├── description.md    (Required/Optional: Markdown description)
└── cover.jpg         (Required/Optional: Event banner image)
```

### Sample `event.json`
```json
{
  "title": "Ancient Mathematics: The Sulba Sutras and Geometry",
  "primary_speaker": "Prof. K. Ramasubramanian",
  "start_time": "2026-11-20 16:00:00.000000",
  "minutes": 90,
  "location": "Zoom Online Webinar",
  "status": "upcoming",
  "cover_image": "assets/images/sulba-sutras.jpg",
  "youtube_id": "",
  "amazon_url": "https://www.amazon.com/dp/example",
  "registration_url": "https://indicforum.org/register",
  "joining_information": "Zoom coordinates will be sent 24 hours in advance.",
  "moderator": "Akshar Prabhudesai",
  "whatsapp_url": "https://rebrand.ly/ifwap",
  "contact_email": "contact@indiccouncil.org"
}
```

You can download a ready-to-use template directly from the app by clicking **"Download Sample Zip Template"** in the **Publish Event** tab.

---

## 🏗️ Architecture

```text
[ Browser / PWA ] 
       │
       ├─► JSZip (Unpacks & validates uploaded .zip archive)
       │
       ├─► SiteGenerator (Markdown -> HTML, dates, preview cards, JSON merge)
       │
       └─► GitHub API Client (CORS authenticated)
             │
             ├── Single Upload: PUT /repos/{owner}/{repo}/contents/{path}
             │
             └── Atomic Event Publish: Git Data API
                   1. POST /git/blobs (Cover image base64 & events.json)
                   2. POST /git/trees (Create tree pointing to new blobs)
                   3. POST /git/commits (Commit new tree with parent SHA)
                   4. PATCH /git/refs/heads/main (Update branch pointer)
                         │
                         ▼
             [ GitHub Repository: akshar100/indicforum-static ]
                         │
                         ▼ (Webhook Trigger)
             [ Vercel Build: python3 generate_all.py ]
                         │
                         ▼
             [ Live on https://indicforum.org ]
```

---

## 📄 License
MIT © IndicCouncil / Akshar Prabhudesai
