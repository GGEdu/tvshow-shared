# tvshow-shared

Código compartido entre [AgenticTVShow](https://github.com/GGEdu/AgenticTVShow) y [TelegramTVShow](https://github.com/GGEdu/TelegramTVShow).

Dos paquetes en un solo repo, distribuidos vía git URL dependency con tags semver:

| Paquete | Tipo | Path | Consumir vía |
|---------|------|------|--------------|
| `@ggedu/tvshow-ui` | npm | `/` (raíz del repo) | `npm install` desde git URL |
| `tvshow-common` | pip | `/backend` | `pip install` desde git URL con `subdirectory=backend` |

---

## Contenido

### v0.1.0 — Base set

#### Frontend (`@ggedu/tvshow-ui`)
- 12 UI primitives: `Badge`, `Button`, `Card`, `Dialog`, `EmptyState`, `FlagImg`, `LanguageBadges`, `PosterOverlay`, `ProgressBar`, `SearchInput`, `Skeleton`, `Tabs`
- Lib utilities: `constants`, `image` (`resolveImageUrl`), `languages` (`getLangMeta`, `normalizeLanguages`), `queryKeys`

#### Backend (`tvshow-common`)
- `tvshow_common.core.base.Base` — declarative SQLAlchemy base
- Modelos: `User`, `UserList`, `ListType`, `Season`
- Schemas: `Token`, `TokenPayload`, `LoginRequest`, `EpisodeCreate`, `EpisodeRead`, `UserCreate`, `UserRead`, `UserUpdate`

### v0.2.0 — Repository layer

#### Backend
- `tvshow_common.repositories.base.BaseRepository` — generic CRUD repository
- `tvshow_common.repositories.user_repository.UserRepository`

### v0.3.0 — Auth layer with dependency injection

#### Backend
- `tvshow_common.core.security` — JWT + password hashing with **settings DI**:
  - `configure(settings)` — call once at startup
  - `verify_password`, `get_password_hash`, `create_access_token`, `decode_access_token`
- `tvshow_common.services.auth_service.AuthService` — register/login business logic
- `tvshow_common.api.auth.create_auth_router(get_db)` — FastAPI router factory

#### Consumer setup
In `app/main.py`:

```python
from tvshow_common.core import security as common_security
from app.core.config import settings

common_security.configure(settings)
```

In `app/api/v1/auth.py` (replaces the previous file):

```python
from app.core.database import get_db
from tvshow_common.api.auth import create_auth_router

router = create_auth_router(get_db)
```

The settings object must expose `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`.

---

## Uso desde un consumer

### Frontend (`package.json`)
```json
{
  "dependencies": {
    "@ggedu/tvshow-ui": "git+https://github.com/GGEdu/tvshow-shared.git#v0.1.0"
  }
}
```

```jsx
import { Button, Card, Dialog } from "@ggedu/tvshow-ui";
import { resolveImageUrl } from "@ggedu/tvshow-ui";
```

**Importante:** En `vite.config.js` del consumer añade el paquete a `optimizeDeps.include` para que Vite procese el JSX:

```js
export default defineConfig({
  optimizeDeps: { include: ["@ggedu/tvshow-ui"] }
});
```

### Backend (`pyproject.toml`)
```toml
dependencies = [
    "tvshow-common @ git+https://github.com/GGEdu/tvshow-shared.git@v0.1.0#subdirectory=backend",
]
```

```python
from tvshow_common.core.base import Base
from tvshow_common.models import User, UserList, Season
from tvshow_common.schemas.auth import LoginRequest, Token
```

---

## Workflow de actualización

1. Edita el archivo en este repo.
2. Bumpea la versión en `package.json` y `backend/pyproject.toml`.
3. Commit + tag: `git tag v0.1.1 && git push --tags`.
4. En cada consumer: bump del tag en `package.json` / `pyproject.toml`, luego `npm install` / `uv sync`.

---

## Roadmap

- **v0.2.0** — Añadir hooks compartidos (`useUser`, `useFollowSeries`) tras refactor de servicios.
- **v0.3.0** — Backend: `core/security.py` y `core/database.py` con settings injection.
- **v0.4.0** — Componentes complejos (Layout, ProtectedRoute) tras abstraer DesktopNav/BottomNav.
