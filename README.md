# ADMars

Active Directory user management web app — fully TypeScript, single Docker container.

## Features

- **Browse & search** all AD users with a modern UI
- **Edit all AD fields** — identity, contact, organization, address, profile, notes
- **Photo management** — upload with crop/zoom editor, auto-resized to fit AD limits (≤100 KB)
- **Password resets** (requires LDAPS for full support)
- **Group management** — add/remove users to/from AD groups
- **Account controls** — enable, disable, unlock, and delete user accounts
- **Self-service** — domain users can log in and edit their own profile
- **Setup wizard** — configure AD connection from the web UI (no config files needed)
- **Multi-arch** — runs on amd64 and arm64

## Quick Start

```yaml
services:
  admars:
    image: mars148/admars:latest
    ports:
      - "4000:4000"
    volumes:
      - admars-data:/data
    restart: unless-stopped

volumes:
  admars-data:
```

```bash
docker compose up -d
```

Open `http://localhost:4000` and follow the setup wizard to connect to your Active Directory.

## Setup Wizard

On first launch you'll be guided through:

1. **LDAP URL** — e.g. `ldap://your-dc.domain.lan`
2. **Bind DN** — service account DN, e.g. `CN=bind,CN=Users,DC=domain,DC=lan`
3. **Bind Password** — service account password
4. **Search Base DN** — where users live, e.g. `OU=Users,DC=domain,DC=lan`
5. **Admin Group** — AD group for admin access, e.g. `CN=Domain Admins,CN=Users,DC=domain,DC=lan`

All settings are stored in a SQLite database inside the `/data` volume.

## Tech Stack

- **Backend** — Node.js, Express, TypeScript, ldapjs, better-sqlite3
- **Frontend** — React, TypeScript, Tailwind CSS, Vite
- **Container** — Single Docker image (Node 20 Alpine)

## Building from Source

```bash
git clone https://github.com/mariof1/admars.git
cd admars
docker compose up -d --build
```

## License

MIT
