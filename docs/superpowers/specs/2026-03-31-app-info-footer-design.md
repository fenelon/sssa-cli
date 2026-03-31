# App Info & Footer Design

**Date:** 2026-03-31
**Scope:** Improve how the sssa-web app communicates its functionality, adds copyright/attribution, use cases, privacy stance, and offline mode explanation.

---

## Overview

Add informational content to the web app via two changes:
1. **Enhanced download banner** — expanded offline mode explanation with nuance about secret sensitivity
2. **Always-visible footer** — description, use cases, privacy badge, copyright, and attribution

The app currently has minimal informational content (a subtitle and a one-line footer). This design adds SEO-friendly, non-professional-friendly content while keeping the tool front-and-center.

---

## 1. Enhanced Download Banner

Replace the existing banner text ("For maximum security, download and run offline") with:

> **For sensitive secrets, download and run offline.** This app runs entirely in your browser — nothing is sent to any server. For additional peace of mind, download a self-contained copy and run it without an internet connection. Note that QR scanning is unavailable in offline mode due to browser security restrictions. Keep in mind that a secret like a PIN or password is often just one layer of security — knowing a PIN doesn't automatically grant access to someone's credit card. See the examples below for best practices and use cases.

**Changes from current:**
- Reframes "maximum security" to "sensitive secrets" (more approachable)
- Explains why offline matters and when it might not
- Notes QR scanning limitation in offline mode
- Points users to the examples section in the footer

---

## 2. Footer Structure

A new multi-section footer below the app, replacing the existing single-line footer. Four distinct sections in order:

### 2a. Description Block — "What is Secret Sharing?"

Narrative explanation aimed at non-professionals, optimized for SEO:

> Secret sharing lets you split sensitive information into multiple parts called "shares." You choose how many shares to create and how many are needed to recover the original — for example, split into 5 shares where any 3 can reconstruct the secret. This uses Shamir's Secret Sharing, a proven cryptographic algorithm trusted since 1979. No single share is useful on its own — only the right combination can recover your secret.

Followed by use-case examples from different domains:

> - **Personal security** — Split a password manager master password among family members, so no single person holds the full key but the family can recover access if needed.
> - **Cryptocurrency** — Back up a wallet seed phrase or private key. Store shares in separate locations so a single break-in or lost device doesn't mean lost funds.
> - **Business continuity** — Distribute access to critical systems among team leads. If someone leaves or is unavailable, the remaining team can still recover access.
> - **Estate planning** — Include shares of important passwords or PINs in documents held by different trusted parties, ensuring access passes on without exposing secrets prematurely.
> - **Secure backup** — Split any sensitive text — API keys, recovery codes, encryption passphrases — and store the shares in different places: a safe, a cloud drive, a trusted friend.

### 2b. Privacy Badge

Visually distinct callout using a bordered box with the red accent bar (matching the header's accent element) to stand apart from the surrounding text:

> **No tracking. No analytics. No data collection.**
> Your secrets never leave your browser. This app has no server-side component, no cookies, and no third-party scripts.

### 2c. Copyright

> © 2025 Ellin Pino — ellin.co

Link to https://ellin.co.

### 2d. Attribution

Separate from the copyright line:

> QR code generation by Kazuhiko Arase (MIT license)

---

## Visual Design

All footer content follows the existing Swiss typographic design language:
- Same max-width (640px), same font stack
- Sections separated by whitespace or light borders
- Privacy badge uses a bordered box with the red accent bar (consistent with header) to stand out visually
- Description block uses body text sizing (14px range)
- Copyright and attribution use smaller secondary text
- No rounded corners, no shadows — consistent with existing design

---

## What This Does NOT Include

- No separate "About" page — everything lives on the single page
- No collapsible/accordion behavior — all content is always visible
- No PWA manifest or service worker changes
- No changes to app functionality or JS logic
- No social/meta tags (out of scope)
