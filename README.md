# HARI BOT — Your Personal AI Portfolio Companion

HARI BOT is an interactive, premium single-page AI portfolio companion built with HTML, CSS, and vanilla JavaScript. It is designed to provide immediate, highly conversational, and offline-safe answers to queries about Hariharan's mechatronics projects, energy healing expertise, chess highlights, and personal preferences.

## 🚀 Key Features

* **Visual Viewport Keyboard Resilience**: Automatically sizes and reposition itself to fit the visual viewport on mobile (iOS/Android) when the soft keyboard rises, keeping the chat input fully visible and preventing browser scrolling issues.
* **Ambient Animation Background**: Interactive particles networking canvas and gradient blobs with custom performance tuning (scaled particle counts for mobile viewports).
* **Hybrid Resilient RAG Fallback**: Configured with a client-side keyword-based search engine that intercepts prompt handling when offline, or when the OpenRouter API requests time out (12s limit) or fail.
* **Easter Eggs**: Built-in triggers (e.g. asking about crush/girlfriend or best friends) that activate interactive animations (falling, splattering eggs on walls/floors).

## 🛠️ Tech Stack

* **Front-End**: HTML5, Vanilla JavaScript, CSS3
* **AI Model**: Llama 3.3 70B via OpenRouter API
* **Fonts**: Orbitron, DM Sans, JetBrains Mono

## 💻 Running Locally

Simply run a local HTTP server in this directory:
```bash
# Using Python
python -m http.server 8000
```
Then visit [http://localhost:8000](http://localhost:8000) in your browser.
