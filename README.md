# MarCo

AI brand visibility agent prototype. Project rules and progress log: [CLAUDE.md](CLAUDE.md).

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and enter any website address (mock mode shows sample results for FlowOps, a fictional company). To see the error screen, enter `mock-error.example.com`.

Full audit (mock): on the results page, choose "Create a free account…", then "Continue without an account". Confirm facts, pick *Use cases and customers* or *Pricing and plans*, run the deep audit, and open an action card to edit, approve, export and mark a correction as published. Then choose "Run a re-audit" on the report to compare with the baseline.

Sample report: http://localhost:3000/sample (always labeled mock data). The design system is at http://localhost:3000/styleguide.

Run the tests:

```bash
npm test
```

With no API keys, MarCo runs in mock mode. To add keys later, copy `.env.example` to `.env.local` and fill it in (never commit it).
