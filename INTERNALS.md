# Internals

## How it works

`parse.js` fetches INA gas station data and filters stations that carry **only** a premium fuel variant (no basic variant). A station qualifies if it has a premium fuel ID but none of the basic fuel IDs.

Filtered results are written to `docs/premium-gasoline.json` and `docs/premium-diesel.json`, which are served as static files by GitHub Pages.

## Running the script

**Via Docker (recommended):**
```bash
docker run -it --rm --entrypoint sh -v "$(pwd):/premium-fuel" node:24-alpine
cd premium-fuel
npm install
node parse.js
```

**Directly (Node 24+):**
```bash
npm install
node parse.js
```

> To force a fresh fetch from INA, delete `ina.html` before running.

## Local preview

```bash
docker run -d -p 8081:80 --name premium-fuel -v "$(pwd)/docs:/usr/share/nginx/html" nginx
```

Open `http://localhost:8081`.

## Fuel product IDs

| ID | Product |
|----|---------|
| 1000298 | Eurosuper 95 (basic) |
| 1002498 | Eurosuper 95 Class Plus (basic) |
| 1002212 | Eurosuper 95 Class Plus Premium (**premium**) |
| 1002213 | Eurosuper 100 Class Plus Premium |
| 1000628 | Eurodiesel (basic) |
| 1002840 | Eurodiesel Class Plus (basic) |
| 1002223 | Eurodiesel Class Plus Expert (basic) |
| 1002835 | Eurodiesel Class Plus Premium (**premium**) |
| 1000340 | Eurodiesel plavi |
| 1000620 | Autoplin |
