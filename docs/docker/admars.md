# ADMars

Active Directory user management web app — single Docker container, modern UI.

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

Open `http://localhost:4000` and complete the setup wizard.

## Features

- Browse, search, and edit all AD user fields
- Photo upload with crop/zoom editor
- Password resets
- Group management (add/remove)
- Account controls (enable, disable, unlock, delete)
- Self-service profile editing for domain users
- Web-based setup wizard — no config files needed

## Platforms

| Architecture | Supported |
|---|---|
| linux/amd64 | ✅ |
| linux/arm64 | ✅ |

## Configuration

All settings are configured through the web UI on first launch:

| Setting | Example |
|---|---|
| LDAP URL | `ldap://your-dc.domain.lan` |
| Bind DN | `CN=bind,CN=Users,DC=domain,DC=lan` |
| Bind Password | *(your service account password)* |
| Search Base DN | `OU=Users,DC=domain,DC=lan` |
| Admin Group | `CN=Domain Admins,CN=Users,DC=domain,DC=lan` |

Settings are persisted in a SQLite database in the `/data` volume.

## Links

- **Source**: [github.com/mariof1/admars](https://github.com/mariof1/admars)
