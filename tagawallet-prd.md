# TagAWallet — Product Requirements Document (PRD)

**Product:** TagAWallet  
**Domains:** tagawallet.com, @TagAWallet  
**Version:** 1.0 — MVP  
**Date:** October 31, 2026  
**Owner:** Gabriel Russo  

---

## 1. Overview

TagAWallet is a wallet identity and organization layer for crypto users. It lets users privately tag wallet addresses, group related wallets under an entity, attach social links and official URLs, and recognize tagged wallets directly in the browser.

The product has two main surfaces:

1. **Browser extension** — detects wallet addresses on supported websites, displays identity tags inline, and lets users tag addresses quickly.
2. **Web platform** — a dashboard at `tagawallet.com` for managing private wallet lists, entities, tags, social links, sharing, and public verified profiles.

TagAWallet is **not** a crypto wallet, does not hold funds, and never requests seed phrases or private keys.

---

## 2. Problem statement

Crypto users regularly encounter wallet addresses on explorers, X, trading platforms, dApps, and research tools. These addresses are difficult to remember, easy to confuse, and often lack trustworthy context.

Users need to answer questions such as:

- Whose wallet is this?
- Is this an exchange, project treasury, KOL, scammer, or my own wallet?
- Which wallets belong to the same person, team, or project?
- Where can I verify this wallet’s official social accounts?
- How can I keep my own research organized without exposing it publicly?

Existing labeling tools focus heavily on trader intelligence or analytics. TagAWallet focuses on a simple, privacy-first **wallet CRM and identity layer**.

---

## 3. Goals and non-goals

### Goals

- Let users create private lists of wallets and organize them by entity, tag, chain, and purpose.
- Allow one entity to have multiple linked wallets across chains.
- Let users attach X, websites, ENS, Telegram, GitHub, and other relevant links.
- Recognize wallet addresses in the browser and display useful context inline.
- Make private lists the default visibility level.
- Support optional shared lists for teams, DAOs, and research groups.
- Support carefully verified public profiles for projects, exchanges, protocols, and self-claimed identities.
- Build a trustworthy, extensible product that can later support APIs and integrations.

### Non-goals for MVP

- Portfolio tracking, PnL, token balances, or transaction analytics.
- Wallet connection, transaction signing, or custody of user funds.
- Public doxxing or unverified personal attribution.
- Automated scam detection as the primary value proposition.
- Mobile app.
- Support for every blockchain at launch.

---

## 4. Target users

### Primary personas

| Persona | Need | Primary use case |
|---|---|---|
| Active DeFi user | Remember wallets and avoid mistakes | Private address book, labels, linked socials |
| On-chain researcher | Organize wallets and investigate entities | Research lists, entity grouping, source links |
| Trader | Quickly recognize relevant wallets | Inline tags on X, explorers, and trading sites |
| Project / DAO | Present official wallets clearly | Verified public profile and wallet links |
| Team / agency | Share wallet intelligence internally | Shared lists and collaborative tagging |

---

## 5. Core value proposition

> **TagAWallet: Know who’s behind every wallet.**  
> Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.

### Key differentiators

- **Private-first:** users’ personal wallet lists are private by default.
- **Entity-based:** multiple wallets can belong to one person, project, DAO, exchange, or team.
- **Actionable identity:** tags link directly to X, websites, ENS, and other verification sources.
- **Browser-native:** wallet recognition happens where users already work.
- **Separation of claims:** a wallet address is public, but identity claims are controlled and attributable.

---

## 6. Product principles

1. **Private by default.** No user-created wallet list, note, or personal attribution is public unless explicitly changed.
2. **Least privilege.** The extension requests only the permissions required for its current functionality.
3. **No custody.** TagAWallet never asks for seed phrases, private keys, or transaction signatures.
4. **Clear provenance.** Every visible label should show whether it is private, shared, community-sourced, self-claimed, or verified.
5. **Safe attribution.** Public identity claims require verification, evidence, moderation, and dispute mechanisms.
6. **Fast and non-intrusive.** The extension should not slow pages down or disrupt normal browsing.

---

## 7. MVP scope

### 7.1 User accounts

Users can sign up using:

- Email and password
- Google OAuth
- X OAuth, if available and appropriate
- Wallet signature login, optional and read-only

An account is required for cloud sync and shared/public features. Local-only usage may be supported later.

### Requirements

- Users can create an account, log in, log out, and reset passwords.
- Users can delete their account and associated personal data.
- Users can manage email notification preferences.
- Sessions must be secure and expire appropriately.
- Passwords must be hashed using a modern password-hashing algorithm.
- OAuth account linking must be supported.

---

## 8. Web platform

The web platform is built with **Next.js** and uses **MongoDB** as the primary database.

### 8.1 Dashboard

After login, the user sees a dashboard with:

- Recent wallets and entities
- Lists sidebar
- Search across wallets, entities, tags, and notes
- Quick-add wallet form
- Privacy status for each list
- Onboarding checklist

### 8.2 Wallet lists

A list is a user-owned collection of wallets and entities.

#### List fields

- Name
- Description
- Visibility: `private`, `shared`, or `public`
- Owner
- Collaborators
- Tags
- Created/updated timestamps
- Share settings

#### Requirements

- Users can create, rename, duplicate, archive, and delete lists.
- Private is the default visibility.
- Users can add wallets directly to a list.
- Users can move or copy wallets between lists.
- Users can export a list as JSON or CSV.
- Users can import wallets from JSON or CSV.
- Shared lists support invite links or email invitations with roles.
- Shared list roles: `viewer`, `editor`, and `admin`.
- Deleting a list requires confirmation.
- Deleting a wallet from a list does not delete the wallet from other lists.

### 8.3 Wallet records

A wallet represents a blockchain address on a specific chain.

#### Wallet fields

- Address
- Chain: Ethereum, Base, Arbitrum, Optimism, Polygon, Solana, Bitcoin, etc.
- Display name
- Notes
- Tags
- Entity association
- Visibility of the association
- Source: user-added, imported, extension-added, verified claim
- Created/updated timestamps

#### Requirements

- Users can add a wallet manually by pasting an address.
- The system validates address format per chain.
- EVM addresses should support checksum validation where applicable.
- Users can assign one or more tags.
- Users can attach notes.
- Users can mark a wallet as `mine`, `watchlist`, `scam`, `trusted`, or custom status.
- Users can view all lists containing a wallet.
- Duplicate detection should warn users when adding an existing address to the same list.
- Wallet addresses must be stored in a normalized format.

### 8.4 Entities

An entity represents the real-world or on-chain identity associated with one or more wallets.

Examples:

- A person
- A crypto project
- A DAO
- An exchange
- A venture fund
- A protocol treasury
- A creator

#### Entity fields

- Name
- Type: individual, project, DAO, exchange, protocol, company, other
- Description
- Avatar/logo
- Website
- X/Twitter
- Telegram
- Discord
- GitHub
- ENS
- Other URLs
- Tags
- Visibility
- Verification status
- Owner
- Created/updated timestamps

#### Requirements

- Users can create an entity and link multiple wallets to it.
- Users can edit entity details.
- Users can attach multiple social and official URLs.
- Users can view all wallets associated with an entity.
- Users can remove a wallet from an entity without deleting the wallet.
- Entities may be private, shared, or public depending on the context and claim type.
- Public entities require a verification workflow.

### 8.5 Social links and verification

Users can attach links to wallets or entities.

Supported link types for MVP:

- X/Twitter
- Website
- ENS
- Telegram
- Discord
- GitHub
- LinkedIn
- YouTube
- Custom URL

#### Requirements

- URLs must be validated and sanitized.
- Users can label each link, such as “Official website” or “Personal X.”
- Users can mark a link as official, personal, community, or source.
- For public profiles, users can verify ownership through:
  - X post containing a verification code
  - Website DNS TXT record or meta tag
  - ENS text record
  - Wallet signature, where appropriate
- Verification status must be visible: `unverified`, `self-claimed`, or `verified`.
- Users can report incorrect public information.

### 8.6 Public profiles

Public profiles are optional and must be distinguished from private data.

#### Public profile requirements

- Public profiles must be explicitly published by the owner or approved through moderation.
- Public profiles must show verification status.
- Public profiles must show the source of each attribution.
- Public profiles must include a report/dispute button.
- Public profiles must not be indexed by search engines until published intentionally.
- Public profiles must not include sensitive personal information.
- Users cannot publicly claim that an unnamed wallet belongs to a specific private individual without verification or sufficient evidence review.

### 8.7 Search

Users can search their own data by:

- Wallet address, including partial matches
- Entity name
- Tag
- Note content
- Chain
- List name
- Social handle or URL

### Requirements

- Search must be fast for at least the first 10,000 wallets per user.
- Search should support partial address matching.
- Search results should show entity, tags, chain, and list membership.
- Search must only return data the user is authorized to view.

---

## 9. Browser extension

The extension is the primary distribution and engagement surface.

### 9.1 Supported browsers

MVP:

- Chrome
- Chromium-based browsers such as Brave and Edge

Later:

- Firefox
- Safari

### 9.2 Supported sites at launch

The extension should inject content scripts only on a curated allowlist:

- Major EVM explorers: Etherscan, BscScan, Arbiscan, Optimistic Etherscan, PolygonScan
- Solana explorers: Solscan, Solana Explorer
- X/Twitter
- Selected trading and research platforms
- Selected portfolio and DeFi dashboards

The exact site list should be configurable remotely so it can be updated without releasing a new extension version.

### 9.3 Address detection

The extension detects:

- EVM addresses: `0x` followed by 40 hexadecimal characters
- Solana addresses
- Bitcoin addresses, depending on launch scope
- ENS names ending in `.eth`
- Solana Name Service names, if supported

### Requirements

- Detection must avoid matching addresses inside unrelated long strings where possible.
- The extension should scan visible DOM text and relevant attributes.
- The extension should debounce scanning and use efficient DOM traversal.
- The extension must not send full page content to TagAWallet servers.
- Detected addresses should be normalized before lookup.
- The extension should handle dynamically loaded content through MutationObserver or equivalent.

### 9.4 Inline wallet chip

When an address is detected, the extension displays a small inline chip near it.

Example:

```text
0xAbC...9F2 [TagAWallet: Binance Hot Wallet]
```

#### Chip states

| State | Display |
|---|---|
| Known private tag | User’s private label |
| Known shared tag | Shared-list label with source |
| Verified public entity | Verified badge and entity name |
| Self-claimed public entity | Self-claimed badge and entity name |
| Community tag | Community tag with source |
| Unknown wallet | Neutral “Tag this wallet” action |

#### Requirements

- Chips must be rendered in Shadow DOM to isolate styles.
- Chips must not break the host website layout.
- Users can disable inline chips globally or per site.
- Users can choose chip style: minimal, badge, or hidden.
- Clicking a chip opens a compact wallet card.

### 9.5 Wallet card popup

Clicking an inline chip opens a floating card.

#### Card contents

- Truncated wallet address
- Copy address button
- Entity name and verification badge
- Tags
- Chain
- Linked socials
- Linked wallets count
- Source of the label
- Buttons: `View profile`, `Edit tag`, `Report`

#### Requirements

- The card must close when clicking outside it or pressing Escape.
- The card must be accessible via keyboard.
- The card must be mobile-friendly if a mobile extension version is developed later.
- The card must not collect or transmit page content.

### 9.6 Extension popup

Clicking the TagAWallet toolbar icon opens a compact popup.

#### Context: address detected

```text
0xAbC...9F2
Alice’s Trading Wallet

Tags: Trader, Watchlist
Wallets linked: 3
X · Website

[ View profile ] [ Edit tag ]
```

#### Context: multiple addresses detected

Show a list of detected addresses with known labels and a `Tag` action for each.

#### Context: no address detected

```text
No wallet detected on this page.

[ Paste address to tag ]
[ Open dashboard ]
```

#### Requirements

- The popup should load in under 300 ms where possible.
- The popup should show the current site and whether TagAWallet is enabled there.
- The popup should include a toggle to enable/disable the extension on the current site.
- The popup should include a link to the full dashboard.
- The popup should not open the dashboard automatically by default.

### 9.7 Quick tagging flow

From the extension, a user can tag an address without opening the full dashboard.

#### Flow

1. User clicks a detected address or extension icon.
2. User selects `Tag this wallet`.
3. User enters a display name.
4. User optionally selects or creates an entity.
5. User optionally adds tags, notes, and social links.
6. User selects destination list.
7. User saves.
8. Extension confirms: “Saved to Research.”

#### Requirements

- Save must work even if the user is offline, then sync when online.
- The default destination list should be the user’s most recently used private list.
- The user must be able to create a new list during the tagging flow.
- The extension must clearly show whether the tag is private or shared.

### 9.8 Permissions

The extension must minimize permissions.

#### MVP permissions

- `storage` — local settings and cached labels
- Optional host permissions for user-enabled sites
- `activeTab` where appropriate
- Identity/authentication permissions only if required by the chosen login method

#### Explicitly avoided

- Broad `<all_urls>` host permission by default
- Reading browsing history
- Accessing downloads
- Accessing cookies beyond authentication needs
- Wallet signing permissions
- Clipboard access unless explicitly triggered by a user action

### 9.9 Settings

Users can configure:

- Inline chips on/off
- Default chip style
- Enabled websites
- Cloud sync on/off
- Default private list
- Theme: system, light, dark
- Keyboard shortcuts
- Data export
- Account logout/delete

---

## 10. Data model

MongoDB collections and key fields.

### users

```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "passwordHash": "string | null",
  "displayName": "Gabriel",
  "authProviders": ["google", "x"],
  "plan": "free",
  "createdAt": "ISODate",
  "updatedAt": "ISODate",
  "deletedAt": "ISODate | null"
}
```

### lists

```json
{
  "_id": "ObjectId",
  "ownerId": "ObjectId",
  "name": "Research",
  "description": "Wallets I am tracking",
  "visibility": "private | shared | public",
  "collaborators": [
    {
      "userId": "ObjectId",
      "role": "viewer | editor | admin"
    }
  ],
  "tags": ["string"],
  "createdAt": "ISODate",
  "updatedAt": "ISODate",
  "deletedAt": "ISODate | null"
}
```

### entities

```json
{
  "_id": "ObjectId",
  "ownerId": "ObjectId | null",
  "name": "Uniswap",
  "type": "protocol | individual | dao | exchange | company | other",
  "description": "string",
  "avatarUrl": "string | null",
  "links": [
    {
      "type": "x | website | ens | telegram | github | custom",
      "url": "string",
      "label": "Official X",
      "status": "unverified | self_claimed | verified"
    }
  ],
  "tags": ["string"],
  "visibility": "private | shared | public",
  "verification": {
    "status": "unverified | self_claimed | verified",
    "verifiedAt": "ISODate | null",
    "verifiedBy": "ObjectId | null"
  },
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### wallets

```json
{
  "_id": "ObjectId",
  "address": "0x...",
  "chain": "ethereum",
  "normalizedAddress": "0x...",
  "displayLabel": "Alice’s Trading Wallet",
  "notes": "string",
  "tags": ["trader", "watchlist"],
  "status": "mine | watchlist | scam | trusted | none",
  "ownerId": "ObjectId",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### wallet_list_memberships

```json
{
  "_id": "ObjectId",
  "listId": "ObjectId",
  "walletId": "ObjectId",
  "addedBy": "ObjectId",
  "addedAt": "ISODate"
}
```

### wallet_entity_links

```json
{
  "_id": "ObjectId",
  "walletId": "ObjectId",
  "entityId": "ObjectId",
  "relationship": "owner | treasury | hot_wallet | cold_wallet | associated | custom",
  "visibility": "private | shared | public",
  "source": "user | extension | import | verified_claim",
  "claimedBy": "ObjectId | null",
  "evidence": [
    {
      "type": "signature | x_post | dns | ens | url",
      "value": "string",
      "verifiedAt": "ISODate | null"
    }
  ],
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### reports

```json
{
  "_id": "ObjectId",
  "targetType": "wallet | entity | link | wallet_entity_link",
  "targetId": "ObjectId",
  "reporterId": "ObjectId",
  "reason": "incorrect | impersonation | doxxing | spam | other",
  "details": "string",
  "status": "open | reviewing | resolved | dismissed",
  "createdAt": "ISODate",
  "resolvedAt": "ISODate | null"
}
```

### Recommended MongoDB indexes

- `users.email`: unique
- `lists.ownerId`
- `wallets.ownerId`
- `wallets.normalizedAddress`
- `wallet_list_memberships.listId`
- `wallet_list_memberships.walletId`
- `wallet_entity_links.walletId`
- `wallet_entity_links.entityId`
- `entities.ownerId`
- `entities.name`: text index
- `wallets.displayLabel`: text index
- `reports.targetType + targetId + status`

---

## 11. API design

Use Next.js API routes or Route Handlers under `/api`.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/logout` | End session |
| POST | `/api/auth/reset-password` | Request password reset |
| GET | `/api/auth/session` | Get current user/session |

### Lists

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/lists` | List user’s accessible lists |
| POST | `/api/lists` | Create list |
| GET | `/api/lists/:id` | Get list details |
| PATCH | `/api/lists/:id` | Update list |
| DELETE | `/api/lists/:id` | Delete list |
| POST | `/api/lists/:id/members` | Invite collaborator |
| DELETE | `/api/lists/:id/members/:userId` | Remove collaborator |

### Wallets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/wallets` | Search/filter wallets |
| POST | `/api/wallets` | Create wallet |
| GET | `/api/wallets/:id` | Get wallet |
| PATCH | `/api/wallets/:id` | Update wallet |
| DELETE | `/api/wallets/:id` | Delete wallet |
| POST | `/api/wallets/lookup` | Resolve address to visible labels |
| POST | `/api/wallets/import` | Import wallets |
| GET | `/api/lists/:id/export` | Export list |

### Entities

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/entities` | Search entities |
| POST | `/api/entities` | Create entity |
| GET | `/api/entities/:id` | Get entity |
| PATCH | `/api/entities/:id` | Update entity |
| DELETE | `/api/entities/:id` | Delete entity |
| POST | `/api/entities/:id/wallets` | Link wallet |
| DELETE | `/api/entities/:id/wallets/:walletId` | Unlink wallet |
| POST | `/api/entities/:id/verify` | Start verification |
| POST | `/api/entities/:id/report` | Report entity |

### Extension lookup

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/extension/resolve` | Resolve multiple addresses to visible labels |
| POST | `/api/extension/tags` | Create/update a private tag |
| GET | `/api/extension/settings` | Get user extension settings |
| PATCH | `/api/extension/settings` | Update extension settings |

The extension lookup endpoint should accept a batch of addresses and return only labels the authenticated user is authorized to see.

---

## 12. Privacy and security requirements

### Privacy

- Private lists are visible only to the owner and explicitly invited collaborators.
- Private data must never appear in public profiles, search engines, or public APIs.
- Users can export and delete their data.
- The extension must not upload page content, browsing history, or unrelated page text.
- Address lookups should send only the detected address, chain, and minimal context.
- Public attribution must be separate from private attribution.
- Users must be able to make a formerly public profile private again.

### Security

- Use HTTPS everywhere.
- Use secure, HTTP-only, SameSite cookies for session management.
- Hash passwords with bcrypt, scrypt, or Argon2.
- Apply rate limits to authentication, lookup, tagging, and reporting endpoints.
- Validate and sanitize all user-generated content.
- Sanitize URLs and block `javascript:`, `data:`, and other dangerous schemes.
- Render extension UI in Shadow DOM.
- Use Content Security Policy appropriate for Next.js and extension surfaces.
- Log administrative and moderation actions in an audit trail.
- Do not store seed phrases, private keys, or signed transactions.

---

## 13. Moderation and trust

### Reporting

Users can report:

- Incorrect wallet-entity association
- Impersonation
- Harassment or doxxing
- Spam
- Malicious links
- Stolen or copied public profile

### Moderation workflow

1. Report is created.
2. Report enters moderation queue.
3. Moderator reviews evidence and history.
4. Moderator can remove, annotate, or preserve the claim.
5. Reporter and profile owner receive status updates where appropriate.
6. Repeat abusive behavior leads to account restrictions.

### Label provenance

Every visible label must include a source:

- `Your private tag`
- `Shared by [list name]`
- `Self-claimed`
- `Verified`
- `Community`
- `Official`

---

## 14. Onboarding

### First-run extension flow

1. User installs extension.
2. Extension shows a short welcome screen.
3. User creates an account or signs in.
4. Extension explains that private tags stay private.
5. User creates a first list, such as “My Wallets” or “Research.”
6. User tags their first wallet.
7. Extension shows inline chips on supported sites.

### First-run web flow

1. User visits `tagawallet.com`.
2. User signs up.
3. User creates a list.
4. User adds a wallet manually or installs the extension.
5. User links socials and creates an entity.
6. User sees a success state with next-step suggestions.

---

## 15. Analytics

Track product usage without collecting sensitive page content.

### Activation metrics

- Account created
- First list created
- First wallet added
- First entity created
- First social link added
- Extension installed
- First inline tag viewed
- First wallet tagged from extension
- First shared list created

### Engagement metrics

- Weekly active users
- Wallets tagged per user
- Inline chip impressions
- Inline chip clicks
- Popup opens
- Dashboard sessions
- Search queries
- Shared-list collaborators
- Public profile views
- Reports submitted

### Quality metrics

- Incorrect-label reports
- Report resolution time
- Extension crash rate
- Content-script errors
- Lookup latency
- Popup load time

---

## 16. Success metrics

### MVP success criteria

Within 90 days after launch:

- 1,000 extension installs
- 30% of installs create an account
- 40% of activated users add at least five wallets
- 25% of activated users return in week two
- Median extension lookup latency under 300 ms
- Fewer than 2% of public labels receive correctness reports
- Zero incidents involving private data exposure

---

## 17. Release plan

### Phase 1 — Private wallet CRM

- Accounts and authentication
- Private lists
- Wallet creation and tagging
- Entities and multiple wallet links
- Social links
- Search
- CSV/JSON import/export
- Basic dashboard

### Phase 2 — Extension

- Chrome extension
- Address detection on curated sites
- Inline chips
- Wallet card
- Quick tagging
- Popup
- Cloud sync
- Per-site controls

### Phase 3 — Collaboration

- Shared lists
- Roles and invitations
- Team activity feed
- Bulk import/export
- Improved entity management

### Phase 4 — Public identity layer

- Public verified profiles
- Verification workflows
- Moderation tools
- Reporting and disputes
- Public API
- Integrations with explorers and trading tools

---

## 18. Technical architecture

### Platform

- **Frontend:** Next.js App Router, React, TypeScript
- **Styling:** Tailwind CSS
- **State/data fetching:** React Query or SWR
- **Authentication:** Auth.js or custom secure session system
- **Validation:** Zod
- **Forms:** React Hook Form
- **Database:** MongoDB Atlas
- **ODM/query layer:** Mongoose or native MongoDB driver
- **Hosting:** Vercel or equivalent
- **File storage:** Cloud storage for avatars/logos
- **Email:** Transactional email provider for verification and password resets

### Extension

- **Framework:** Vite + React + TypeScript, CRXJS or equivalent
- **Manifest:** Manifest V3
- **Background:** Service worker
- **Content scripts:** TypeScript address scanner and Shadow DOM UI
- **Storage:** `chrome.storage.local` plus server sync
- **Communication:** Messaging between content script, service worker, and popup

### Address resolution flow

1. Content script detects address.
2. Content script sends batched addresses to service worker.
3. Service worker checks local cache.
4. Service worker calls `/api/extension/resolve` for uncached addresses.
5. API returns only authorized labels.
6. Service worker caches response with TTL.
7. Content script renders inline chips.

---

## 19. Acceptance criteria

### Platform

- A user can create a private list and add wallets.
- A user can link multiple wallets to one entity.
- A user can attach and edit social links.
- A user can search wallets by address, name, tag, and note.
- A user can export and import wallet lists.
- Private data is not accessible to unauthenticated users or other users.
- A user can delete their account and data.

### Extension

- The extension detects supported address formats on allowlisted sites.
- The extension displays inline chips without breaking host sites.
- A user can tag an address from the extension.
- A user can view wallet identity details in a compact card.
- A user can enable or disable the extension per site.
- The extension does not request broad host permissions by default.
- The extension does not transmit page content to TagAWallet servers.

### Privacy

- Private wallet tags are never visible to other users.
- Shared tags are visible only to authorized collaborators.
- Public profiles require explicit publication and display provenance.
- Users can report incorrect public information.
- The system never requests or stores private keys or seed phrases.

---

## 20. Open questions

- Which chains should be supported at launch beyond Ethereum, EVM L2s, and Solana?
- Should Bitcoin address support be included in v1?
- Should the extension support Firefox at launch or shortly after?
- Should public community tags be allowed in v1, or should public visibility require verification?
- Should users be able to monetize shared research lists?
- Should the product offer a public API and what rate limits should apply?
- Should wallet-control verification be required for all public entity claims?
- What is the long-term pricing model: free tier, pro tier, team tier, or API-based pricing?
