# 380

## Desktop Packaging

### Prerequisites

```bash
pnpm install
```

### Build Desktop Assets

```bash
pnpm run build:desktop
```

### Windows Installer (NSIS)

```bash
pnpm run dist:win
```

### macOS Installer (DMG + ZIP)

```bash
pnpm run dist:mac
```

### macOS Architecture-Specific Builds

```bash
pnpm run dist:mac:arm64
pnpm run dist:mac:x64
```

Build outputs are written to the `release/` directory.