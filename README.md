# 🚁 AERO — Product Requirements Document v2.0

---

## 1. 📋 Opis ogólny

Zbudować aplikację webową do **ewidencji planowanych operacji lotniczych** oraz **przygotowania zlecenia na lot helikopterem**.

---

## 2. 🔍 Problem

- Potrzeba aplikacji www do ewidencji i planowania.
- Potrzeba logiki pokazującej na mapie miejsce wykonania lotu.
- Potrzeba logiki sprawdzającej procedury podczas tworzenia / potwierdzenia zlecenia na lot.

---

## 3. 🎯 Cel

Wsparcie procesu zbierania planowanych operacji oraz bezpośredniego przygotowania zlecenia na lot.

---

## 4. 👥 Użytkownicy docelowi

| Rola | Opis |
|------|------|
| 🧑‍💼 **Osoba planująca** (DE / CJI) | Wprowadza i monitoruje status planowanych operacji lotniczych |
| 🧑‍✈️ **Osoba nadzorująca** (DB) | Nadzoruje i zmienia status planowanych operacji lotniczych oraz akceptuje / odrzuca zlecenie na lot |
| ✈️ **Pilot** | Planuje zlecenie na lot i raportuje stopień realizacji operacji |
| ⚙️ **Administrator systemu** | Wprowadza konfiguracje |

---

## 5. 📖 User Stories

- **a)** Jako **osoba planująca**, chcę wprowadzić planowaną operację lotniczą, aby lot wskazanego odcinka linii został zaplanowany.
- **b)** Jako **osoba planująca**, chcę odczytywać aktualny stan planowanych operacji lotniczych, które wprowadziłem, aby śledzić kiedy jest planowana operacja lotnicza i jakie są szanse na ten lot.
- **c)** Jako **osoba planująca**, chcę zrezygnować z planowanej operacji lotniczej, które wprowadziłem, aby nie wykonywać lotu jeśli jest już zbędny.
- **d)** Jako **osoba nadzorująca**, chcę ustawiać status i daty planowanych operacji lotniczych, aby potwierdzać / odrzucać planowane operacje i wstępne planować loty w kontekście posiadanych środków.
- **e)** Jako **pilot**, chcę wprowadzić zlecenie na lot do realizacji jednego lub więcej planowanych operacji lotniczych z wybranym lotniskiem startu i lądowania z wyliczeniem długości planowanego lotu i uproszczonym pokazaniem na mapie trasy przelotu, aby dobrać odpowiednie operacje lotnicze do zlecenia.
- **f)** Jako **pilot**, chcę uzupełnić zlecenie na lot o wybór helikoptera i członków załogi ze sprawdzeniem niezbędnych warunków, aby zlecenie na lot spełniało procedury.
- **g)** Jako **osoba nadzorująca**, chcę ustawiać status zlecenia na lot, aby potwierdzać / odrzucać zlecenie na lot.
- **h)** Jako **pilot**, chcę wprowadzić co z planowanej operacji lotniczej zostało zrealizowane, ile czasu i km trwał lot, aby zaraportować stan wykonania zadania.
- **i)** Jako **administrator systemu**, chcę edytować aktualne informacje dotyczące floty helikopterów, członków załogi oraz lotnisk, aby system działał w sposób planowany i aktualny.

---

## 6. ✅ Funkcje obowiązkowe

### 6.1. 🚁 Helikopter

#### a) Wprowadzanie i edycja danych helikopterów

| Pole | Typ | Wymagalność | Ograniczenia |
|------|-----|-------------|--------------|
| Numer rejestracyjny | tekst | obowiązkowe | do 30 znaków |
| Typ helikoptera | tekst | obowiązkowe | do 100 znaków |
| Opis | tekst | opcjonalne | do 100 znaków |
| Maks. liczba członków załogi | liczba całkowita | obowiązkowe | 1–10 |
| Maks. udźwig członków załogi | liczba całkowita | obowiązkowe | 1–1000 kg |
| Status | wybór | obowiązkowe | aktywny / nieaktywny |
| Data ważności przeglądu | data | obowiązkowe dla statusu *aktywny* | — |
| Zasięg bez lądowania | liczba całkowita | obowiązkowe | 1–1000 km |

#### b) Widok listy

> 📌 **Menu → Helikoptery**
> W menu helikoptery dostępna lista rekordów z numerem rejestracyjnym, typem helikoptera i statusem, sortowanie domyślne po statusie i nr rejestracyjnym

---

### 6.2. 👤 Członkowie załogi

#### a) Wprowadzanie i edycja danych członków załogi

| Pole                    | Typ               | Wymagalność                  | Ograniczenia                            |
| ----------------------- | ----------------- | ---------------------------- | --------------------------------------- |
| Imię                    | tekst             | obowiązkowe                  | do 100 znaków                           |
| Nazwisko                | tekst             | obowiązkowe                  | do 100 znaków                           |
| Email / login           | tekst             | obowiązkowe                  | do 100 znaków, walidacja email ¹        |
| Waga                    | liczba całkowita  | obowiązkowe                  | 30–200 kg                               |
| Rola                    | wybór jednokrotny | obowiązkowe                  | ze słownika (np. *Pilot*, *Obserwator*) |
| Nr licencji pilota      | tekst             | obowiązkowe dla roli *Pilot* | do 30 znaków                            |
| Data ważności licencji  | data              | obowiązkowe dla roli *Pilot* | —                                       |
| Data ważności szkolenia | data              | obowiązkowe                  | —                                       |

> ¹ **Walidacja email** — litery, znaki `.-@`, dokładnie jeden `@`, po nim co najmniej dwa ciągi liter przedzielone kropką.

#### b) Widok listy

> 📌 **Menu → Członkowie załogi**
> W menu członkowie załogi dostępna lista rekordów z Email, rola, data ważności licencji i data ważności szkolenia, sortowanie domyślne po email 

---

### 6.3. 🛬 Lądowiska planowe

#### a) Wprowadzanie i edycja danych lądowiska

| Pole | Typ | Wymagalność |
|------|-----|-------------|
| Nazwa | tekst | obowiązkowe |
| Współrzędne | współrzędne | obowiązkowe |

#### b) Widok listy

> 📌 **Menu → Lądowiska planowe**
> W menu lądowiska planowe dostępna lista rekordów z Nazwa, domyślne sortowanie po Nazwa

---

### 6.4. 🔐 Użytkownicy

#### a) Wprowadzanie i edycja danych użytkowników

| Pole | Typ | Wymagalność | Ograniczenia |
|------|-----|-------------|--------------|
| Imię | tekst | obowiązkowe | do 100 znaków |
| Nazwisko | tekst | obowiązkowe | do 100 znaków |
| Email / login | tekst | obowiązkowe | do 100 znaków, walidacja email |
| Rola | wybór jednokrotny | obowiązkowe | ze słownika (np. *Administrator*, *Osoba planująca*, *Osoba nadzorująca*, *Pilot*) |

#### b) Widok listy

> 📌 **Menu → Użytkownicy**
> W menu użytkownicy dostępna lista rekordów z Email, rola, sortowanie domyślne po email

---

### 6.5. 📋 Planowana operacja lotnicza

#### a) Wprowadzanie i edycja danych operacji lotniczej

| Pole | Typ | Wymagalność | Ograniczenia / Uwagi |
|------|-----|-------------|----------------------|
| Nr planowanej operacji | autonumer | automatyczne | kolejny numer |
| Nr zlecenia / projektu | tekst | obowiązkowe | do 30 znaków, np. `DE-25-12020`, `CJI-3203` |
| Opis skrócony | tekst | obowiązkowe | do 100 znaków |
| Zbiór punktów / ślad trasy | plik KML | obowiązkowe | 1 plik, do 5000 punktów, teren Polski |
| Proponowane daty — najwcześniej | data | opcjonalne | np. `01-05-2026` |
| Proponowane daty — najpóźniej | data | opcjonalne | np. `30-09-2026` |
| Rodzaj czynności | wielokrotny wybór | obowiązkowe | min. 1 wartość ze słownika (np. *oględziny wizualne*, *skan 3D*, *lokalizacja awarii*, *zdjęcia*, *patrolowanie*) |
| Dodatkowe informacje (termin/priorytet) | tekst | opcjonalne | do 500 znaków |
| Liczba km trasy | liczba całkowita | obowiązkowe | obliczana — patrz 6.5.b |
| Planowane daty — najwcześniej | data | opcjonalne | — |
| Planowane daty — najpóźniej | data | opcjonalne | — |
| Komentarz | tekst | opcjonalne | do 500 znaków, lista kolejnych wpisów |
| Historia zmian | automatyczne | — | stara/nowa wartość, data zmiany, osoba |
| Status | wybór jednokrotny | obowiązkowe | patrz tabela statusów poniżej |
| Osoba wprowadzająca | email | automatyczne | bieżący użytkownik |
| Osoby kontaktowe | zbiór email | opcjonalne | — |
| Uwagi po realizacji | tekst | opcjonalne | do 500 znaków |
| Lista powiązanych zleceń | automatyczne | — | przez powiązanie w zleceniu |

**Tabela statusów operacji:**

| Kod | Status |
|-----|--------|
| 1 | 🆕 Wprowadzone |
| 2 | ❌ Odrzucone |
| 3 | ✅ Potwierdzone do planu |
| 4 | 📅 Zaplanowane do zlecenia |
| 5 | 🔄 Częściowo zrealizowane |
| 6 | ✔️ Zrealizowane |
| 7 | 🚫 Rezygnacja |

#### b) Obliczanie km trasy

Liczba km jest obliczana w przybliżony sposób na podstawie sumy odcinków między kolejnymi punktami ze zbioru punktów.

#### c) Uprawnienia do edycji

Wprowadzanie i edycja możliwe przez **osobę planującą** i **osobę nadzorującą**.

#### d) Zakresy edycji wg roli

- **Osoba planująca** — edycja w statusach: `1`, `2`, `3`, `4`, `5`
- **Osoba nadzorująca** — edycja we wszystkich statusach

#### e) Pola zablokowane dla osoby planującej

> ⚠️ Osoba planująca **nie może edytować:**
> - pól wyliczanych automatycznie
> - planowanych dat (najwcześniej / najpóźniej)
> - statusu (domyślnie `1 — Wprowadzone`)
> - uwag po realizacji

#### f) Przyciski dla osoby nadzorującej (status = 1)

| Przycisk | Zmiana statusu | Warunek |
|----------|---------------|---------|
| 🟥 **Odrzuć** | 1 → 2 | — |
| 🟩 **Potwierdź do planu** | 1 → 3 | wymagane wypełnienie planowanych dat |

#### g) Przyciski dla osoby planującej (statusy 1, 3, 4)

| Przycisk | Zmiana statusu |
|----------|---------------|
| 🚫 **Rezygnuj** | 1, 3, 4 → 7 |

#### h) Automatyczne zmiany statusów

| Zmiana | Kiedy? |
|--------|--------|
| 3 → 4 | Po wybraniu rekordu przez pilota do otwartego zlecenia na lot |
| 4 → 5 | Po wybraniu przez pilota *„Zrealizowane w części"* |
| 4 → 6 | Po wybraniu przez pilota *„Zrealizowane w całości"* |
| 4 → 3 | Po wybraniu przez pilota *„Nie zrealizowane"* |

#### i) Mapa

> 🗺️ Wyświetlanie na mapie załączonego zbioru punktów.

#### j) Widok listy

> 📌 **Menu → Lista operacji**
> W menu lista operacji dostępna lista rekordów z Nr planowanej operacji, Nr zlecenia, rodzaj czynności, proponowane daty - najwcześniej i najpóźniej, planowane daty - najwcześniej i najpóźniej, status. 
> Z możliwością własnego filtrowania, domyślne filtrowanie - status 3.
> Sortowanie domyślne po planowane daty - najwcześniej rosnąco.

---

### 6.6. 📝 Zlecenia na lot

#### a) Wprowadzanie i edycja danych zleceń na lot

| Pole | Typ | Wymagalność | Ograniczenia / Uwagi |
|------|-----|-------------|----------------------|
| Nr zlecenia na lot | autonumer | automatyczne | kolejny numer |
| Data i godzina planowanego startu | data + czas | obowiązkowe | — |
| Data i godzina planowanego lądowania | data + czas | obowiązkowe | — |
| Pilot | wybór jednokrotny | obowiązkowe | ze słownika członków załogi z rolą *Pilot*, wyświetlane: *Imię Nazwisko*, sort. alfabet. |
| Status | wybór jednokrotny | obowiązkowe | patrz tabela statusów poniżej |
| Helikopter | wybór jednokrotny | obowiązkowe | tylko helikoptery ze statusem *aktywny* |
| Członkowie załogi | wielokrotny wybór | opcjonalne | ze słownika członków załogi (dowolna rola), wyświetlane: *Imię Nazwisko*, sort. alfabet. |
| Waga załogi | liczba całkowita (kg) | automatyczne | suma: pilot + wszyscy wybrani członkowie |
| Lądowisko startowe | wybór jednokrotny | obowiązkowe | ze słownika lądowisk |
| Lądowisko końcowe | wybór jednokrotny | obowiązkowe | ze słownika lądowisk |
| Wybrane planowane operacje | wielokrotny wybór | obowiązkowe | operacje ze statusem `3`, sort. po najwcześniejszej planowanej dacie |
| Szacowana długość trasy | liczba całkowita | obowiązkowe | — |
| Data i godzina rzeczywistego startu | data + czas | obowiązkowe przed statusem 5 / 6 | — |
| Data i godzina rzeczywistego lądowania | data + czas | obowiązkowe przed statusem 5 / 6 | — |

**Tabela statusów zlecenia:**

| Kod | Status |
|-----|--------|
| 1 | 🆕 Wprowadzone |
| 2 | 📤 Przekazane do akceptacji |
| 3 | ❌ Odrzucone |
| 4 | ✅ Zaakceptowane |
| 5 | 🔄 Zrealizowane w części |
| 6 | ✔️ Zrealizowane w całości |
| 7 | 🚫 Nie zrealizowane |

#### b) Autouzupełnianie pilota

> ℹ️ Pole **pilot** jest wypełniane automatycznie danymi aktualnie zalogowanej osoby.

#### c) Walidacje przy zapisie

> ⛔ **Blokada zapisu** następuje w przypadku:
>
> - Helikopter bez ważnego przeglądu na dzień lotu
> - Pilot bez ważnej licencji na dzień lotu
> - Członek załogi bez ważnego szkolenia na dzień lotu
> - Waga załogi przekraczająca maksymalny udźwig helikoptera
> - Szacowana długość trasy większa niż zasięg helikoptera
>
> W każdym przypadku wyświetlane jest stosowne **ostrzeżenie**.

#### d) Mapa

> 🗺️ Wyświetlane na mapie:
> - Lądowisko startowe
> - Zbiór punktów ze wszystkich wybranych operacji
> - Lądowisko końcowe

#### e) Przyciski dla osoby nadzorującej (status = 2)
Dla osoby nadzorującej pojawiają się dodatkowe przyciski dla statusu 2:

| Przycisk | Zmiana statusu | Warunek |
|----------|---------------|---------|
| 🟥 **Odrzuć** | 2 → 3 | — |
| 🟩 **Zaakceptuj** | 2 → 4 | wymagane wypełnienie planowanych dat |

#### f) Przyciski dla pilota — rozliczanie (status = 4)
Dla pilota podczas rozliczania pojawią się dodatkowe przyciski dla statusu 4

| Przycisk | Zmiana statusu zlecenia | Zmiana statusu powiązanych operacji |
|----------|------------------------|-------------------------------------|
| 🔄 **Zrealizowane w części** | 4 → 5 | wszystkie → 5 |
| ✔️ **Zrealizowane w całości** | 4 → 6 | wszystkie → 6 |
| 🚫 **Nie zrealizowane** | 4 → 7 | wszystkie → 3 |

#### g) Widok listy

> 📌 **Menu → Lista zleceń**
> W menu lista zleceń dostępna lista rekordów z Nr zlecenia na lot, Data i godzina planowanego startu, helikopter, pilot, status. 
> Z możliwością własnego filtrowania, domyślne filtrowanie - status 2.
> Sortowanie domyślne po dacie i godzinie - rosnąco.

---

## 7. ⚙️ Wymagania niefunkcjonalne

### 7.1. 🧭 Menu aplikacji

```
📂 Administracja
├── 🚁 Helikoptery
├── 👤 Członkowie załogi
├── 🛬 Lądowiska planowe
└── 🔐 Użytkownicy

📂 Planowanie operacji
└── 📋 Lista operacji

📂 Zlecenia na lot
└── 📝 Lista zleceń
```

### 7.2. 🔑 Uprawnienia do menu

| Rola | Administracja | Planowanie operacji | Zlecenia na lot |
|------|:-------------:|:-------------------:|:---------------:|
| Administrator systemu | ✏️ tworzenie / edycja / podgląd | 👁️ podgląd | 👁️ podgląd |
| Osoba planująca | 🚫 brak | ✏️ tworzenie / edycja / podgląd | 🚫 brak |
| Osoba nadzorująca | 👁️ podgląd | ✏️ tworzenie / edycja / podgląd | ✏️ edycja / podgląd |
| Pilot | 👁️ podgląd | 👁️ podgląd | ✏️ tworzenie / edycja / podgląd |

### 7.3. 🔒 Uprawnienia do danych

Jak w uprawnieniach do menu (pkt 7.2).

### 7.4. 🛡️ Bezpieczeństwo

- **Uwierzytelnianie** — login + hasło
- **Kontrola dostępu** — zgodnie z uprawnieniami do menu (pkt 7.2)

### 7.5. 🚀 Wydajność

> ℹ️ Brak wymagań.

---

## 8. 🔗 Ograniczenia / Zależności

> ℹ️ Brak wymagań dotyczących czasu, narzędzi, systemów, API ani dostępności danych.

---

## 9. 🚧 Poza zakresem

- Automatyczne wyliczanie szacowanej długości przelotu
- Automatyczne pokazywanie optymalnej trasy
- Inne walidacje

---

## 10. 🏆 Demo i kryteria sukcesu

### Poziom I — Minimum Viable Demo

Pokazanie działającej aplikacji www z:

- ✅ co najmniej **2 rodzajami użytkowników** — osobą planującą i nadzorującą
- ✅ co najmniej **lista zleceń** z możliwością edycji przez osobę planującą i zmiany statusu przez osobę nadzorującą