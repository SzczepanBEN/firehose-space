# 🔥 Firehose.space

**Open publishing platform where anyone can share links and articles. No gatekeeping, just pure content flow.**

Firehose.space to globalna platforma publikacji treści, gdzie każdy może wrzucać linki lub artykuły bez żadnych barier. Wykorzystuje algorytm "hotness" do promowania najciekawszych treści i umożliwia społeczności kurację przez głosowanie i komentowanie.

## ✨ Funkcjonalności

- 📝 **Publikacja treści** - Linki z internetu lub własne artykuły w Markdown
- 🔥 **Globalny feed** - Hot/New/Top z algorytmem hotness
- 👍 **System głosowania** - Upvoty na posty i komentarze  
- 💬 **Komentarze** - Płaskie, z obsługą Markdown
- 🏆 **Ranking autorów** - Punkty za upvoty i kliki
- 🔐 **Magic link auth** - Logowanie bez haseł
- 📈 **SEO-friendly** - Własne URL, schema.org, sitemapy
- 🚀 **API** - Automatyzacja dla botów i agentów AI
- 💰 **Płatne promocje** - Przypięcie postów (Stripe)
- 🛡️ **Minimalna moderacja** - Tylko spam i nielegalne treści

## 🏗️ Architektura

**Frontend:**
- [Astro](https://astro.build) - Static site generator
- [Tailwind CSS](https://tailwindcss.com) - Styling
- Cloudflare Pages - Hosting

**Backend:**
- [Cloudflare Workers](https://workers.cloudflare.com) - API logic
- [Cloudflare D1](https://developers.cloudflare.com/d1) - SQLite database
- [Cloudflare KV](https://developers.cloudflare.com/kv) - Caching
- Cron Triggers - Background jobs

**Integracje:**
- Magic link authentication (własna implementacja)
- Stripe Checkout - Płatności
- Turnstile - Bot protection

## 🚀 Quick Start

### Wymagania
- Node.js 18+
- Cloudflare account
- Wrangler CLI

### 1. Klonowanie i instalacja

```bash
git clone https://github.com/yourusername/firehose-space.git
cd firehose-space
npm install
```

### 2. Konfiguracja Cloudflare

```bash
# Zaloguj się do Cloudflare
npx wrangler login

# Stwórz bazę D1
npx wrangler d1 create firehose-db

# Stwórz KV namespace
npx wrangler kv:namespace create CACHE
```

### 3. Konfiguracja środowiska

Zaktualizuj `wrangler.toml` z ID-ami z poprzednich komend:

```toml
[[env.development.d1_databases]]
binding = "DB"
database_name = "firehose-db"
database_id = "TWÓJ_DATABASE_ID"

[[env.development.kv_namespaces]]
binding = "CACHE"
id = "TWÓJ_KV_NAMESPACE_ID"
```

### 4. Inicjalizacja bazy danych

```bash
# Zastosuj schema
npx wrangler d1 execute firehose-db --file=./schema.sql

# (Opcjonalnie) Dodaj przykładowe dane
npx wrangler d1 execute firehose-db --file=./scripts/seed-db.sql
```

### 5. Uruchomienie dev server

```bash
npm run dev
```

Strona będzie dostępna pod `http://localhost:3000`

## 📝 Konfiguracja produkcyjna

### Zmienne środowiskowe

Ustaw następujące zmienne w Cloudflare Workers:

```bash
# JWT secret dla sesji użytkowników
npx wrangler secret put JWT_SECRET

# Klucz Stripe (do płatnych promocji)
npx wrangler secret put STRIPE_SECRET_KEY

# Klucz Turnstile (bot protection)
npx wrangler secret put TURNSTILE_SECRET_KEY

# Klucz Resend lub innego providera email (do magic links)
npx wrangler secret put RESEND_API_KEY
```

### Deploy

```bash
# Deploy Worker API
npx wrangler deploy

# Deploy frontend do Cloudflare Pages
npm run build
# Następnie podłącz repozytorium w dashboard Cloudflare Pages
```

## 🗄️ Model danych

**Główne tabele:**
- `users` - Użytkownicy z podstawowymi danymi
- `posts` - Posty (linki i self-posty)  
- `post_bodies` - Treść markdown dla self-postów
- `comments` - Komentarze (płaskie)
- `votes` - Głosy na posty i komentarze
- `promotions` - Płatne promocje postów

**Pomocnicze:**
- `magic_tokens` - Tokeny do magic link auth
- `user_sessions` - Sesje użytkowników
- `reports` - Zgłoszenia moderacyjne

## 🔥 Algorytm Hotness

```
hotness = (upvotes + 0.2 * comments) / (age_hours + 2)^1.5
```

- Świeże posty z wysokimi upvotami będą na górze
- Komentarze też zwiększają hotness (mniejszą wagą)
- Starsze posty naturalnie spadają w rankingu

## 🎯 Rate Limiting

- **Publikacja postów**: 1 post / użytkownik / dzień
- **Komentarze**: 10 / użytkownik / godzinę  
- **Głosy**: 100 / użytkownik / godzinę
- **Magic links**: 3 / email / godzinę

## 🛡️ Moderacja

**Zasady:**
- Brak kategorii czy subforów - jeden globalny feed
- Automatyczne wykrywanie duplikatów URL
- Shadow-ban dla spammerów
- Reakcja na zgłoszenia jedynie dla: treści nielegalnych, DMCA, doxxing

**Zakazane:**
- CSAM, terroryzm, oszustwa
- Naruszenia praw autorskich (DMCA)
- Publikowanie danych osobowych bez zgody
- Spam i masowe publikacje

## 🔌 API

### Autentykacja
```bash
# Wyślij magic link
POST /api/auth/login
{"email": "user@example.com"}

# Zweryfikuj token
POST /api/auth/verify  
{"token": "magic-token"}

# Sprawdź sesję
GET /api/auth/me
Authorization: Bearer <jwt-token>
```

### Posty
```bash  
# Pobierz feed
GET /api/posts/feed?sort=hot&limit=50&offset=0

# Wyślij post
POST /api/posts/submit
Authorization: Bearer <jwt-token>
{
  "type": "link",
  "title": "Interesting article",
  "url": "https://example.com"
}

# Głosuj na post
POST /api/posts/:id/vote
Authorization: Bearer <jwt-token>
{"vote_type": "up"}
```

Pełna dokumentacja API: `/api` po uruchomieniu aplikacji

## 📊 Analytics

- DAU/WAU/MAU tracking
- CTR na linki zewnętrzne  
- Metryki publikacji i upvotów
- Indeksacja w Google (GSC)
- Konwersje płatnych promocji

## 🤝 Contributing

1. Fork projektu
2. Stwórz feature branch (`git checkout -b feature/amazing-feature`)
3. Commit zmian (`git commit -m 'Add amazing feature'`)
4. Push do branch (`git push origin feature/amazing-feature`)
5. Otwórz Pull Request

## 📄 Licencja

MIT License - zobacz [LICENSE](LICENSE) 

## 🆘 Support

- 📧 Email: hello@firehose.space
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/firehose-space/issues)
- 💬 Discord: [Dołącz do społeczności](https://discord.gg/firehose)

---

**Zbudowałeś coś fajnego używając Firehose.space? [Daj nam znać!](mailto:hello@firehose.space)**
