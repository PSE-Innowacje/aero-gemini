# Konta użytkowników po seedzie (profil `full`)

Skrypt `backend/seed.py` zawsze tworzy te same konta aplikacji (niezależnie od `SEED_PROFILE`). Profil **`full`** (domyślny, ustawiany m.in. przez `SEED_PROFILE=full` w `infra/.env`) oznacza większy zestaw danych demo (śmigłowce, zlecenia itd.), ale **logowanie jest identyczne** jak przy `minimal`.

## Jak uruchomić seed z profilem full

- W `infra/.env` ustaw `SEED_PROFILE=full` (lub pomiń zmienną — domyślnie jest `full`).
- Wykonaj seed zgodnie z [dokumentacją backendu](backend.md) (np. `uv run python seed.py` w katalogu `backend`).

## Konta do logowania (środowisko developerskie)

Hasła są **tylko do lokalnego developmentu**. Nie używaj ich poza środowiskiem testowym.

| Rola w aplikacji | E-mail | Hasło |
|------------------|--------|-------|
| Administrator | `admin@example.com` | `admin123` |
| Planner | `planner@example.com` | `planner123` |
| Supervisor | `supervisor@example.com` | `supervisor123` |
| Pilot (użytkownik) | `pilot-user@example.com` | `pilot123` |

Imiona i nazwiska w bazie (dla orientacji w UI): Admin User, Paula Planner, Sam Supervisor, Pete Pilot.

Źródło danych: `backend/seed.py` (tablica `user_specs`).
