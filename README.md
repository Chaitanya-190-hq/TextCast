# TextCast — Public Digital Archive & Knowledge Vault

TextCast is a public digital archive where every uploaded text file transforms into an elegant card. Designed with aesthetics inspired by **Apple**, **Arc Browser**, **Linear**, and **Notion**, TextCast provides a Notion-style gallery, instant search, archive filtering, and a Medium-grade dedicated reading experience.

---

## Highlights & Features

### Public Archive Gallery (`index.html`)
- **Notion Gallery Cards**: Every upload becomes an individual card featuring title, summary snippet, date, reading time badge, unique ID (e.g. `P001`), and interactive hover transitions.
- **Dedicated Reading View (`/post/:id` or `#/post/:id`)**:
  - Distraction-free reading view with serif / sans-serif typography.
  - Live top **Reading Progress Bar** tracking scroll progress.
  - **Copy Content**: One-click copy of the note to clipboard.
  - **Download TXT**: Export and save any card as a `.txt` file with clean headers.
  - **Share Article**: Native Web Share API on mobile devices with instant link copy fallback on desktop.
  - **Smooth Back Navigation**: Escape key or back button returns to archive instantly.
- **Search & Archive System**:
  - Instant debounced search across **Title**, **Description**, and **ID**.
  - Search match highlighting (`<mark>`).
  - Sort by **Newest First**, **Oldest First**, **Quick Reads**, or **Deep Reads**.
  - Filter by **Month** (dynamically extracted from archived cards).
  - Total uploads & archive reading time metrics.
  - **Recently Added Spotlight**: Features the latest card on top with quick read actions.
- **Dark & Light Themes**: Polished Obsidian dark mode and Pearl light mode with system preference auto-detection and persistence.

### Admin Studio (`admin.html`)
- **Drag & Drop .txt File Upload**: Simply drag and drop any plain text file. TextCast extracts the title, preview text, and full content automatically.
- **Manual Paste Tab**: Write or paste markdown and plain text directly.
- **Auto-Generated Unique IDs**: Automatically calculates and assigns sequential IDs (`P001`, `P002`, `P003`, etc.).
- **Live Auto-Calculated Read Time**: Computes word count and estimated reading time in real-time.
- **Live Card Preview**: Preview exactly how the card will look in the gallery before publishing.
- **Non-Destructive Publishing**: New cards are appended to the archive without overwriting previous uploads.
- **Export & Commit (`content.json`)**: Download the updated `content.json` file or copy the JSON structure with 1 click to commit to your GitHub repository.

---

## Data Structure

All posts are stored in `data/content.json` using the following schema:

```json
{
  "posts": [
    {
      "id": "P001",
      "title": "Probability Notes & Foundations",
      "description": "Important formulas, Bayes theorem, discrete distributions, and conditional probability concepts.",
      "content": "Full markdown or plain text content...",
      "createdAt": "2026-09-14",
      "readTime": "3 min"
    },
    {
      "id": "P002",
      "title": "Quantum Computing Basics",
      "description": "Introduction to qubits, superposition, entanglement, and quantum logic gates.",
      "content": "Full markdown or plain text content...",
      "createdAt": "2026-09-15",
      "readTime": "4 min"
    }
  ]
}
```

---

## Project Structure

```
TextCast/
├── index.html              # Public archive gallery & reading view (Single-Page App)
├── admin.html              # Admin Studio for uploading and publishing notes
├── README.md               # Documentation & quick start guide
├── assets/
│   ├── css/
│   │   └── styles.css      # Design system, glassmorphism, responsive styles
│   └── js/
│       ├── main.js         # Viewer routing, live search/filtering, reading view
│       └── admin.js        # File parsing, auto-ID calculation, publishing engine
└── data/
    └── content.json        # Public JSON database of all archived cards
```

---

## Quick Start & Local Testing

Because TextCast uses modern `fetch()` to load `data/content.json`, run a local HTTP server to preview:

```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx serve .
```

Open `http://localhost:8000` in your browser.

---

## Deploy to GitHub Pages

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Deploy TextCast premium digital archive"
   git branch -M main
   git remote add origin https://github.com/yourusername/textcast.git
   git push -u origin main
   ```
2. In GitHub, navigate to **Settings** → **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch** → choose `main` branch → `/ (root)`.
4. Click **Save**. Your digital archive is live at `https://yourusername.github.io/textcast/`!
