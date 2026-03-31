# Equavicle

Convert LaTeX equations from AI chatbots (Gemini, ChatGPT, etc.) directly into Google Docs equation editor format.

## The Problem

AI chatbots output math in LaTeX format (`$$F = ma$$`), but Google Docs doesn't understand raw LaTeX. You'd normally have to manually retype everything into the equation editor. **Equavicle fixes that.**

## Features

- **Auto-Type Mode** — Opens Google Docs equation editor and types the equation for you
- **Copy Mode** — Cleans LaTeX and copies it to clipboard, ready to paste into equation editor
- **Live Preview** — See rendered equations before inserting
- **Smart Parsing** — Extracts equations from `$$...$$`, `$...$`, `\[...\]`, `\(...\)` formats
- **Auto-Detect on Paste** — Just paste and go

## Supported LaTeX

| Command | Description |
|:---|:---|
| `\frac{a}{b}` | Fractions |
| `x^{2}`, `x_{i}` | Superscripts & subscripts |
| `\sqrt{x}` | Square roots |
| `\alpha`, `\beta`, `\pi`, ... | Greek letters |
| `\int`, `\sum`, `\prod` | Operators |
| `\leq`, `\geq`, `\neq` | Comparison operators |
| `\rightarrow`, `\leftarrow` | Arrows |
| `\infty` | Infinity |
| `\cdot` | Dot product |

## Install Locally

1. Clone or download this repo
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `latex-to-gdocs` folder
6. Pin the Equavicle extension in your toolbar

## Usage

1. Copy text containing LaTeX from Gemini/ChatGPT
2. Click the Equavicle extension icon
3. Paste the text — equations are extracted automatically
4. Click **Auto-Type** (on a Google Doc) or **Copy** to clipboard

## Tech Stack

- Chrome Extension Manifest V3
- MathJax 3 for LaTeX rendering
- Vanilla JS, HTML, CSS
