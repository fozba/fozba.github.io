# Local development

The project carries a reproducible toolchain in `.tools/`; Hugo, Go, Node, npm,
and their caches do not need system-wide installation. The pinned versions match
the active GitHub Pages workflow and the explicit Netlify settings where
applicable:

- Hugo Extended 0.146.4
- Node 24.20.0 LTS (the major version used by the GitHub Pages workflow)
- npm 10.9.2
- Go 1.24.2 (required for Hugo modules)

On a Linux x86-64 or ARM64 machine, start the site with:

```bash
make dev
```

The first run downloads the official release archives, verifies SHA-256
checksums, and runs `npm ci`. Later runs reuse the local tools. Open
<http://127.0.0.1:1313/> in Firefox; use Responsive Design Mode to test phone
layouts. Stop the server with `Ctrl+C`.

The server address can be changed without editing files:

```bash
make dev DEV_HOST=127.0.0.1 DEV_PORT=1414
```

Other commands:

```bash
make setup        # install or verify the pinned local toolchain
make build        # production build in public/
make audit-plots  # reject embedded Plotly runtimes and report raw/gzip sizes
make test         # production build followed by the plot audit
```

`make audit-plots` scans the active portfolio source files. After a build it
reports the actual `public/portfolio/` payload; before a build it reports source
payloads. The original standalone exports used to generate the compact figures
live under `scripts/portfolio/source_exports/` and are intentionally excluded
from deployment. Explicit paths may be passed when needed:

```bash
make audit-plots PLOT_AUDIT_PATHS="static/portfolio layouts/portfolio"
```

Downloaded archives remain in `.tools/downloads/`, making repeated setup runs
fast. Delete only `.tools/` if a completely clean toolchain reinstall is needed;
the directory is ignored by Git.
