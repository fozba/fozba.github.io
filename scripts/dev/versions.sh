#!/usr/bin/env bash

# Hugo/npm match Netlify's explicit pins. Node uses the current Node 24 LTS line,
# matching the active GitHub Pages workflow's `node-version: '24'` runtime.
HUGO_VERSION="0.146.4"
NODE_VERSION="24.20.0"
NPM_VERSION="10.9.2"

# Hugo modules require the Go command. This version matches Hugo 0.146.x's
# toolchain generation and comfortably exceeds this repository's Go 1.21 floor.
GO_VERSION="1.24.2"
