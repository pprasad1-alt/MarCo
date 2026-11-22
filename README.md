# MarCo

AI brand visibility agent prototype. Project rules and progress log: [CLAUDE.md](CLAUDE.md).

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and enter any website address (mock mode shows sample results for FlowOps, a fictional company). To see the error screen, enter `mock-error.example.com`. The design system is at http://localhost:3000/styleguide.

Run the tests:

```bash
npm test
```

With no API keys, MarCo runs in mock mode. To add keys later, copy `.env.example` to `.env.local` and fill it in (never commit it).
