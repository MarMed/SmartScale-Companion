# ⚖️ SmartScale Companion

> **SmartScale Companion** is a premium, open-source, glassmorphic Web Bluetooth dashboard designed to interface with smart kitchen scales. Read raw and tared weights in real-time, execute perfect coffee pourovers with a dedicated brewing timer, design customized recipes, and monitor full hardware telemetry—all directly from your browser.

---

## ✨ Features

### 📊 Live Telemetry Dashboard
*   **Real-time Weight Readout:** Accurate weight representation with dynamic typography that auto-scales for different units.
*   **Radial Progress Dial:** Smooth SVG dial showing current weight relative to scale capacity, shifting colors dynamically to warn of negative bounds or capacity overload.
*   **Multi-Unit Support:** Seamlessly toggle between grams (`g`), ounces (`oz`), and pounds/ounces (`lb:oz`) on the fly.
*   **Software Tare & Zero Offset:** Zero out container weight or reset scale reference counts with single-click hardware tares.
*   **History Snapshot Logging:** Keep a local, running log of key weights with precise millisecond timestamps, formatted nicely in a glassmorphic timeline.

### ☕ Advanced Coffee Pourover Assistant
*   **Dual Weight & Timer Dial:** Unified radial gauge displaying brewing duration and poured water weight simultaneously.
*   **Flow Rate Tracker:** Real-time pour-rate calculations in grams per second (`g/s`) with dynamic water ripple indicators.
*   **Recipe Builder:** Interactive slider interfaces to customize coffee grounds dose (grams) and target water ratios (e.g., `1:15`, `1:16`, `1:16.6`, or custom).
*   **Calculations Engine:** Automatically computes exact target brew yields and optimized bloom water volumes (3x dose).
*   **4-Phase Brewing Guide:** Guided workflow that steps you through:
    1.  *Preparation* (grounds setup and container tares)
    2.  *Blooming* (gas release with automatic 35-second countdown)
    3.  *Main Pour* (fluid pouring with target g/s rate guidance)
    4.  *Drawdown* (final filter drain)
*   **Auto-Start poured timer:** Advanced option to automatically start the brew timer the split second the scale registers water flow.
*   **Session Summary Analytics:** Post-brew breakdown reporting exact duration, total yield, and average flow rate.

### 💻 Integrated BLE Hardware Simulator
*   **Zero Hardware Needed:** Built-in Bluetooth simulation slider allowing developers to test and demonstrate full dashboard and coffee-brewing workflows without needing a physical scale.

---

## 🔌 Hardware Compatibility & Reverse Engineering

This project is built to interface directly with Bluetooth LE smart scales that utilize the **Perfect Company** protocol (including *Perfect Drink*, *Perfect Bake*, and *Perfect Blend* kitchen scales). 

### 📡 Bluetooth GATT Specification
The application scans for scales advertising name prefixes (`Perfect`, `Scale`, `Bake`, `Drink`, `Blend`, `Pure`, `Smart`, `Kitchen`) and communicates using the following discovered services:

*   **Primary Service UUID:** `b5600001-a0f8-16af-bb42-1d3b642ec2e1`
*   **Smoothed Weight Notification Characteristic UUID:** `b5600003-a0f8-16af-bb42-1d3b642ec2e1`
*   **Raw Zero-Delay ADC Notification Characteristic UUID:** `b5600007-a0f8-16af-bb42-1d3b642ec2e1`

### 🛠️ Parsing Math
The scale transmits weight updates as custom GATT binary packets. The reverse-engineered parser takes LSB, Mid, and MSB bytes from the notification payload, constructs a signed 24-bit integer, and applies the physical calibration scale factor:

```javascript
// Sign extension from 24-bit to 32-bit signed integer
let rawVal = b1 | (b2 << 8) | (b3 << 16);
if (rawVal & 0x800000) {
    rawVal -= 0x1000000;
}

// Convert counts to physical weight in grams (623.05 counts/gram)
const grams = rawVal / 623.05;
```

Full details of the disassembly and reverse-engineering findings can be found in the [research/](research/) directory:
*   [Disassembly Notes](research/scale_disassembly.txt) — Architectural layout of the native binary decompilation.
*   [Extracted Strings](research/extracted_strings.txt) — Native function symbols and data patterns used to identify packet structures.

---

## 🚀 Getting Started

### 📋 Prerequisites
Due to modern browser security guidelines, **Web Bluetooth** requires:
1.  **Google Chrome, Microsoft Edge, or Opera** (version 56+). *Safari and Firefox do not natively support Web Bluetooth.*
2.  **A secure context:** The page must be served over `https://` or `localhost`.

### 💻 Running Locally
1.  Clone this repository:
    ```bash
    git clone https://github.com/YOUR_USERNAME/SmartScale-Companion.git
    cd SmartScale-Companion
    ```
2.  Serve the directory locally. For example, using Python's built-in HTTP server:
    ```bash
    python3 -m http.server 8000
    ```
3.  Open `http://localhost:8000` in your Chrome or Edge browser.

---

## 🌐 Deployment to GitHub Pages

SmartScale Companion is designed entirely with **vanilla web technologies (HTML5, CSS3, ES6 JavaScript)** and is 100% serverless, making it ideal for hosting on **GitHub Pages**.

### ⚡ Automated Deploy (Recommended)
This repository includes a pre-configured GitHub Actions workflow located in [.github/workflows/static.yml](.github/workflows/static.yml).

1.  Push this repository to GitHub.
2.  Go to your repository settings on GitHub: **Settings > Pages**.
3.  Under **Build and deployment > Source**, select **GitHub Actions**.
4.  Every commit pushed to the `main` branch will automatically build and deploy the dashboard to your GitHub Pages site!

### 🖱️ Manual Deployment
If you prefer to deploy from a branch:
1.  In **Settings > Pages > Build and deployment > Source**, select **Deploy from a branch**.
2.  Select `main` as the branch and `/ (root)` as the folder, then click **Save**.

---

## 🎨 Design System & Premium Aesthetics
The application implements a premium, ultra-modern visual layout:
*   **Glassmorphism Glass Panels:** Backed by semi-transparent HSL color layers, thin boundaries, and intense backdrop blur (`backdrop-filter: blur(20px)`).
*   **Harmonious Color Accents:** A balanced dark theme blending deep slate backdrops with vibrant cyan (`var(--accent-cyan)`), emerald (`var(--accent-emerald)`), and amber (`var(--accent-amber)`) feedback states.
*   **Modern Typography:** Elegant integrations of Google Fonts (Outfit & Inter) for clean digital readouts and crisp descriptive text.
*   **Fully Responsive Layout:** Responsive grid architecture that wraps smoothly from desktop telemetry panels to handheld smartphone kitchen monitors.

---

## 🤖 AI Generation & Credits
This dashboard was entirely co-engineered, debugged, and optimized in partnership with **Antigravity**, an agentic AI coding assistant developed by the **Google DeepMind** team, customized precisely to solve specific smart kitchen scale telemetry and interface requirements.

---

## ⚖️ Legal Disclaimer
*SmartScale Companion is an independent open-source project. It is not affiliated with, authorized, sponsored, endorsed, or in any way officially connected to Perfect Company, Pure Imagination, or any of their subsidiaries or affiliates. All trademarks, service marks, and company names are the property of their respective owners. References to "Perfect Company", "Perfect Scale", "Perfect Drink", "Perfect Bake", and "Perfect Blend" scales are used strictly for compatibility and interoperability reference under fair use.*
