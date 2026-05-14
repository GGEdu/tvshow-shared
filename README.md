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

### v0.4.0 — Hooks + Contexts with services DI

#### Frontend
- `ServicesContext` + `ServicesProvider` + `useServices()` — DI for HTTP service clients
- `AuthContext` + `AuthProvider` (refactored to use `useServices()`)
- 9 hooks (all read services via `useServices()`):
  - `useAuth`, `useUser`
  - `useMyLists`, `useAddToList`, `useUpdateList`, `useRemoveFromList`
  - `useFollowSeries`, `useListDropdown`
  - `useSeasonEpisodes`, `useTmdbSync`
  - `useWatchedBySeriesId`, `useMarkWatched`, `useMarkWatchedBulk`, `useUnmarkWatched`, `useUnmarkWatchedBulk`
  - `useSeriesWatchingState`

#### Consumer setup
In `main.jsx`:

```jsx
import { ServicesProvider, AuthProvider } from "@ggedu/tvshow-ui";
import { api } from "./services/api.js";
import { authService } from "./services/auth.js";
import { listsService } from "./services/lists.js";
import { seriesService } from "./services/series.js";
import { userService } from "./services/user.js";

const services = { api, authService, listsService, seriesService, userService };

<ServicesProvider services={services}>
  <AuthProvider>
    <App />
  </AuthProvider>
</ServicesProvider>
```

Service modules must keep their export names: `api`, `authService`, `listsService`, `seriesService`, `userService`.

### v0.5.0 — Layout + ProtectedRoute

#### Frontend
- `Layout` — accepts `desktopNav` and `bottomNav` as ReactNode props (nav components differ between consumers)
- `ProtectedRoute` — uses `useAuth()` internally; redirects to `/login` if not authenticated

#### Consumer usage
```jsx
import { Layout, ProtectedRoute } from "@ggedu/tvshow-ui";
import DesktopNav from "./components/DesktopNav.jsx";
import BottomNav from "./components/BottomNav.jsx";

<ProtectedRoute>
  <Layout desktopNav={<DesktopNav />} bottomNav={<BottomNav />}>
    {children}
  </Layout>
</ProtectedRoute>
```

### v0.6.0 — Domain UI components

#### Frontend
- `SeriesHero` — hero banner for series detail (uses resolveImageUrl from lib)
- `EpisodeRow` — single episode row with watched toggle, language flags, optional `scraping` spinner
- `SeasonAccordion` — collapsible season with episode list, progress bar, optional coverage indicator

Both `EpisodeRow` and `SeasonAccordion` accept an optional `scraping` prop (default `false`). When `false`, scraper-related UI doesn't render — backward-compatible with consumers that don't use the scraper feature.

`SeasonAccordion` conditionally renders `season.stream_coverage_pct` when present.

### v0.8.0 — Episode action slots

#### Frontend
- `EpisodeRow` añade dos props opcionales:
  - `extraActions` (ReactNode) — se renderiza junto al toggle "marcar visto"
  - `extraBelow` (ReactNode) — panel debajo de la fila (admin tools, MatchDialog, etc.)
- `SeasonAccordion` añade dos render-props opcionales:
  - `renderEpisodeActions(episode) => ReactNode`
  - `renderEpisodeBelow(episode) => ReactNode`

Ambos se inyectan en cada `EpisodeRow` interno. Sirven para que cada consumer
inyecte UI per-episodio sin acoplar la lib (ej. botón "Cambiar TMDB" + diálogo
de re-matching en TelegramTVShow).

API 100% retro-compatible: sin las props, se renderiza exactamente lo mismo.

### v0.7.0 — Shared HTTP client

#### Frontend
- `api` — fetch-based HTTP client with `get`/`post`/`put`/`patch`/`delete`
  - Reads JWT from `localStorage` and adds `Authorization: Bearer` header
  - Auto-redirects to `/login` on HTTP 401
  - Base URL from `VITE_API_URL` env var (defaults to `/api/v1`)

#### Consumer usage
The consumer's `services/api.js` becomes a thin re-export:

```js
export { api } from "@ggedu/tvshow-ui";
```

Each consumer must set `VITE_API_URL` in its env if it needs a different base path.

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
