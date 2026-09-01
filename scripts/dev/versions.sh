#!/usr/bin/env bash

# Hugo/npm match Netlify's explicit pins. Node uses the final Node 18 release,
# matching the active GitHub Pages workflow's `node-version: '18'` runtime.
HUGO_VERSION="0.146.4"
NODE_VERSION="18.20.8"
NPM_VERSION="10.9.2"

# Hugo modules require the Go command. This version matches Hugo 0.146.x's
# toolchain generation and comfortably exceeds this repository's Go 1.21 floor.
GO_VERSION="1.24.2"
