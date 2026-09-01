# Fehmi Özbayrak's personal website

Source for [fozba.github.io](https://fozba.github.io), my personal website and
interactive engineering portfolio.

The site covers my work in computational energy engineering, reservoir
geomechanics, scientific software, machine learning, and energy systems. It
includes a Hugo-based home page and blog, a standalone mobile-friendly
portfolio, interactive Plotly visualizations, and a downloadable curriculum
vitae.

## Local development

The repository includes a reproducible local toolchain. On Linux, start the
development server with:

```bash
make dev
```

The first run installs the pinned versions of Hugo Extended, Go, Node, and npm
inside `.tools/`, then installs the project dependencies. Open
<http://127.0.0.1:1313/> after the server starts.

Useful commands:

```bash
make setup        # install or verify the local toolchain
make build        # create a minified production build in public/
make audit-plots  # audit Plotly packaging and portfolio payload sizes
make test         # build and run the portfolio verification suite
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for additional development details.

## Deployment

Pushes to `main` are built and deployed to GitHub Pages by
`.github/workflows/deploy.yml`.

## Technology

- Hugo Extended with the Toha theme module
- HTML, SCSS/CSS, and JavaScript
- Plotly.js for interactive engineering visualizations
- GitHub Actions and GitHub Pages

The Toha project provides the underlying Hugo theme; this repository contains
the content, custom layouts, portfolio application, and assets for my website.
