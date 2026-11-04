# IndicForum Event Package (.ZIP) Specification

This specification defines the standard archive format for packaging and publishing new events to IndicForum through the IndicForum Publisher Progressive Web App.

---

## 1. Overview

An **Event Package** is a standard `.zip` archive containing the event metadata, promotional poster image, and formatted talk description.

When uploaded to the Publisher PWA, the application:
1. Unpacks and validates the contents in the browser using client-side JSZip.
2. Allocates a new event ID (e.g. `1202`, `1252`, etc.).
3. Formats and uploads the cover image to `assets/images/{slug}-talk.jpg`.
4. Updates the centralized `events.json` database.
5. Generates the individual event HTML page (`dist/events/{id}.html`).
6. Regenerates the homepage (`dist/index.html`), catalog (`dist/events.html`), and speakers list (`dist/speakers.html`).
7. Commits all files atomically to the GitHub repository using the GitHub Git Data API.
8. Automatically triggers the Vercel static site deployment.

---

## 2. Zip Archive Contents

The `.zip` archive must contain the following files at its root (or in a top-level directory):

```
my-event-package.zip
├── event.json            [REQUIRED]  Metadata for the event
├── cover.jpg             [REQUIRED]  Poster/banner image (or cover.png, banner.jpg)
└── description.md        [OPTIONAL]  Full markdown description & schedule
```

---

## 3. Metadata Schema (`event.json`)

The `event.json` file contains structured information about the talk:

| Field | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `title` | String | **Yes** | Full title of the webinar/presentation | `"Vedic Mathematics & Ancient Geometry"` |
| `primary_speaker` | String | **Yes** | Name of the primary speaker or author | `"Dr. Subhash Kak"` |
| `start_time` | String | **Yes** | Date & time formatted `YYYY-MM-DD HH:MM:SS` | `"2026-11-28 18:00:00.000000"` |
| `minutes` | Number | No | Duration in minutes (Default: `90`) | `90` |
| `location` | String | No | Event venue or platform (Default: `"Zoom Online Webinar"`) | `"Zoom Online Webinar"` |
| `status` | String | No | `"upcoming"` (default) or `"completed"` | `"upcoming"` |
| `registration_url` | String | No | Public registration link (Zoom / Google Form / TinyURL) | `"https://tinyurl.com/indicforum-nov26"` |
| `joining_information`| String | No | Access details or registration instructions | `"Register to receive Zoom credentials via email."` |
| `moderator` | String | No | Host / session moderator | `"Siddhesh Prabhu"` |
| `whatsapp_url` | String | No | WhatsApp community invite link | `"https://rebrand.ly/ifwap"` |
| `contact_email` | String | No | Inquiries email | `"contact@indiccouncil.org"` |
| `amazon_url` | String | No | Amazon link to the author's book | `"https://www.amazon.in/dp/..."` |
| `youtube_id` | String | No | YouTube video URL or ID (if already recorded) | `""` or `"https://youtube.com/watch?v=..."` |
| `ticket_price` | Number | No | Ticket price (Default: `0.0`) | `0.0` |
| `description` | String | No | Inline markdown description (if `description.md` is omitted) | `"..."` |

---

## 4. Cover Image Guidelines (`cover.jpg` / `cover.png`)

- **Aspect Ratio:** 16:9 or 16:10 landscape recommended (e.g. 1920x1080 or 1200x675).
- **Format:** JPG, PNG, or WebP.
- **File Size:** Under 3 MB recommended for optimal page load.
- **Naming:** `cover.jpg`, `cover.png`, `poster.jpg`, `banner.jpg`, or the first image file discovered in the zip root.

---

## 5. Description Format (`description.md`)

If `description.md` is present in the archive, its content will be used as the event description and rendered into high-contrast semantic HTML. Standard GitHub Flavored Markdown is supported, including:
- Bold `**text**` and italics `*text*`
- Section headings: `### Heading 3`, `## Heading 2`
- Unordered lists (`- item` or `* item`)
- Clickable markdown links: `[Link text](https://example.com)`

---

## 6. How to Generate a Package

You can create an event package zip by running:
```bash
zip -r my-event.zip event.json description.md cover.jpg
```
Alternatively, use the **IndicForum Publisher PWA** to download a pre-filled sample template or build one visually using the built-in form!
