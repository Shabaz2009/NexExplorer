<div align="center">
  <img src="public/logo.png" alt="NexExplorer Logo" width="120" />
  
  # NexExplorer

  **The ultimate modern File Explorer for Windows.**  
  Built with Tauri, React, and Rust for blazing-fast performance.

  [![React](https://img.shields.io/badge/React-19.0-blue.svg?style=flat&logo=react)](https://reactjs.org/)
  [![Tauri](https://img.shields.io/badge/Tauri-2.0-orange.svg?style=flat&logo=tauri)](https://tauri.app/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
  [![Rust](https://img.shields.io/badge/Rust-Backend-black.svg?style=flat&logo=rust)](https://www.rust-lang.org/)
</div>

<br/>

**NexExplorer** is a fully-featured, high-performance file manager designed to replace the standard Windows File Explorer. It combines a beautiful modern user interface with powerful built-in network sharing (**NexDrop**) and a suite of advanced power-user utilities.

## ✨ Key Features

- 🚀 **Modern UI & Layout**: A beautiful, responsive interface featuring multi-tab navigation, breadcrumbs, and a sleek dark/light mode aesthetic built with Tailwind CSS v4.
- ⚡ **Blazing Fast**: Powered by a Rust backend (Tauri) for heavy lifting and a lightweight React frontend, making file operations and navigation instantaneous.
- 📡 **NexDrop — Local Network File Sharing**: Seamless, cross-device local file sharing. Fully compatible with the LocalSend protocol (UDP multicast `224.0.0.167:53317`). Discover nearby devices, queue files from the Explorer, and transfer them instantly.
- 🌐 **Direct Server (HTTP/HTTPS/LAN/UPnP)**: Host a local web server from any folder. Supports four server modes — HTTP, HTTPS (self-signed TLS), raw TCP (fastest), and UPnP (remote access with automatic port forwarding). Includes a **dynamic QR Code** generator for instant mobile access.
- 🛠️ **NexTools Utility Suite**:
  - **Disk Space Analyzer**: Visual drill-down of directory sizes.
  - **Duplicate File Finder**: Uses robust SHA-256 hashing to safely find and remove duplicate files.
  - **Hash Checker**: Instantly verify MD5 and SHA-256 file integrity.
- 👁️ **Quick Look**: Press `Spacebar` for an ultra-fast preview overlay for images, videos, audio, and syntax-highlighted text.
- 🗂️ **Advanced File Operations**: Batched copy/move, dynamic sorting, folder size calculation, context menu, properties dialog, and more.
- ⚙️ **Fully Configurable Settings**: Theme selection (dark/light/system), accent color picker, font size, compact mode, NexDrop alias, save directory, port, and auto-accept toggles — all accessible from the toolbar or sidebar gear icon.

## 💻 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Framer Motion, Zustand |
| **Backend** | Tauri v2, Rust, Axum (HTTP server), Tokio (async runtime) |
| **Networking** | UDP Multicast (NexDrop discovery), TCP (file transfer), UPnP (IGD), mDNS-SD |
| **Security** | Rustls + rcgen (self-signed TLS), SHA-256 file hashing |
| **Build** | Vite 5, TypeScript compiler |

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) (C++ build tools on Windows)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Shabaz2009/NexExplorer.git
   cd NexExplorer
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run tauri dev
   ```

4. **Build for production (single `.exe`):**
   ```bash
   npm run tauri build
   ```
   The compiled `.exe` installer and portable executable will be located in `src-tauri/target/release/bundle/`.

## 📁 Project Structure

```
NexExplorer/
├── src/                          # React frontend source
│   ├── components/
│   │   ├── Explorer/             # File grid, NexDrop panel, context menu, QuickLook
│   │   ├── Layout/               # MainLayout, Sidebar, Toolbar, Settings, StatusBar
│   │   ├── LocalShare/           # ServerPanel (Direct Server + QR Code)
│   │   ├── Tools/                # DiskAnalyzer, DuplicateFinder
│   │   └── UI/                   # Shared UI primitives
│   ├── store/                    # Zustand stores (explorer, settings, tabs, nexDrop)
│   ├── hooks/                    # Custom React hooks (theme, keyboard, file ops)
│   └── styles/                   # Global CSS
├── src-tauri/                    # Rust backend source
│   ├── src/
│   │   ├── commands/             # Tauri commands (file_ops, nexdrop, tools, shell_ex)
│   │   ├── lan_server/           # Axum-based HTTP/HTTPS/LAN/UPnP server
│   │   └── main.rs              # Tauri app entry point
│   └── Cargo.toml
├── public/                       # Static assets (logo, icons)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open-source. Please see the `LICENSE` file for more details.

---
<div align="center">
  <i>Built with ❤️ by Shabaz</i>
</div>
