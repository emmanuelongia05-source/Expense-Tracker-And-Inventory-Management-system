# Ledgerly

A small-business expense tracker and inventory management system with a React frontend, Express backend, and MongoDB persistence.

## MongoDB setup

Install MongoDB locally and run it, or create a MongoDB Atlas cluster. Copy `.env.example` to `.env` and set `MONGODB_URI`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=ledgerly
JWT_SECRET=replace-with-a-long-random-secret
```

If Docker Desktop is installed, the included `docker-compose.yml` starts a local MongoDB instance:

```bash
docker compose up -d mongodb
npm run server
```

Restart any old backend process after this migration so it loads the MongoDB version of `server/server.mjs`.

For Atlas, use the connection string from Atlas instead. The backend creates `expenses` and `inventory` collections, adds indexes, and seeds the demo records from `server/data.json` only when both collections are empty.

## Accounts and security

The dashboard starts on a login screen. Users can register with a username, email, and password of at least 8 characters, or sign in with their username/email and password. Passwords are hashed with `bcryptjs`; the API returns a 7-day JWT and requires it for data, expense, inventory, and analysis requests. Records are scoped to the authenticated MongoDB user.

Set a strong random `JWT_SECRET` in `.env` before deploying. Never commit `.env` or real credentials.

## Run locally

Start both services from one terminal:

```bash
npm run dev:all
```

If you prefer separate terminals, run `npm run server` and `npm run dev` individually. Do not start a second copy while those processes are already running, or port `8787` will report `EADDRINUSE`.

Open `http://localhost:5173`.

The backend runs at `http://localhost:8787` and exposes:

- `GET /api/health`
- `GET /api/data`
- `POST /api/expenses`
- `POST /api/inventory`
- `DELETE /api/expenses/:id`
- `DELETE /api/inventory/:id`
- `POST /api/analysis`

Expenses and inventory are persisted in MongoDB. `server/data.json` is used only as first-run demo seed data.

## AI analysis

The analysis panel works without credentials using local business rules that identify out-of-stock products, low-stock products, and expense concentration.

For generated recommendations, configure an OpenAI-compatible provider before starting the server:

```powershell
$env:OPENAI_API_KEY = "your-key"
$env:OPENAI_MODEL = "gpt-4o-mini"
npm run server
```

Optional `OPENAI_BASE_URL` supports compatible hosted providers. The backend falls back to local analysis if no key is configured.

## Validation

```bash
npm run build
npm run lint
```

## Deploy live with HTTPS

The repository includes `render.yaml` for a single Render web service. The service builds the React frontend, serves it from Express, and exposes the API from the same HTTPS domain.

1. Create a MongoDB Atlas cluster and database user. Add `0.0.0.0/0` to the Atlas network access list for the first deployment, or restrict it to Render outbound IPs when available.
2. Push this repository to GitHub.
3. In Render, choose **New > Blueprint**, connect the repository, and select `render.yaml`.
4. Add `MONGODB_URI` in the Render service environment. Use the Atlas SRV connection string, for example `mongodb+srv://username:password@cluster.mongodb.net/ledgerly?retryWrites=true&w=majority`. Do not leave it blank or use `mongodb://127.0.0.1:27017` on Render.
5. Deploy. Render provides an HTTPS URL such as `https://ledgerly.onrender.com`.

The public URL serves the dashboard, while `/api/health` verifies the live API. Do not commit `.env`, MongoDB credentials, or API keys.
