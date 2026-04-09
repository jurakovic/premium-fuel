import fs from 'fs';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import he from 'he';

const SOURCE_URL = 'https://www.ina.hr/trazilica-benzinskih-postaja/';
const HTML_FILE = 'ina.html';
const JSON_FILE = 'ina.json';
const PREMIUM_GASOLINE_FILE = 'docs/premium-gasoline.json';
const PREMIUM_DIESEL_FILE   = 'docs/premium-diesel.json';
const HISTORY_FILE          = 'docs/history.json';

// Stations to check for temporary closure (stale data / PRIVREMENO ZATVORENO)
const CHECK_CLOSURE = new Set([
    'lucko-sjever',
]);

const GASOLINE_BASIC = new Set([
    "1000298", // Eurosuper 95
    "1002498", // Eurosuper 95 Class Plus
]);

const GASOLINE_PREMIUM = new Set([
    "1002212", // Eurosuper 95 Class Plus Premium
]);

const DIESEL_BASIC = new Set([
    "1000628", // Eurodiesel
    "1002840", // Eurodiesel Class Plus
    "1002223", // Eurodiesel Class Plus Expert
]);

const DIESEL_PREMIUM = new Set([
    "1002835", // Eurodiesel Class Plus Premium
]);

async function isTemporarilyClosed(url) {
    const slug = url.replace(/^https?:\/\/[^/]+\/station\//, '').replace(/\/$/, '');
    if (!CHECK_CLOSURE.has(slug)) return false;

    const html = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
        }
    }).then(r => r.text());

    const dom = new JSDOM(html);
    const table = dom.window.document.querySelector('table.station__info__tablebox__table');
    return table?.textContent.includes('PRIVREMENO ZATVORENO') ?? false;
}

async function ensureHtml() {
    if (fs.existsSync(HTML_FILE)) {
        console.log('Using existing ina.html');
        return fs.readFileSync(HTML_FILE, 'utf8');
    }

    console.log('Fetching HTML from INA website...');
    const html = await fetch(SOURCE_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
        }
    }).then(r => r.text());

    fs.writeFileSync(HTML_FILE, html, 'utf8');
    console.log('Saved to ina.html');

    return html;
}

function parseStations(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const mdata = document.querySelector('#mdata');
    if (!mdata) {
        throw new Error('#mdata element not found');
    }

    const rawStations = mdata.getAttribute('stations');
    if (!rawStations) {
        throw new Error('stations attribute not found');
    }

    // HTML decode
    const decoded = he.decode(rawStations);

    // JSON parse
    return JSON.parse(decoded);
}

function hasOnlyPremiumGasoline(station) {
    const hasBasic   = station.fuel.some(f => GASOLINE_BASIC.has(f));
    const hasPremium = station.fuel.some(f => GASOLINE_PREMIUM.has(f));
    return hasPremium && !hasBasic;
}

function hasOnlyPremiumDiesel(station) {
    const hasBasic   = station.fuel.some(f => DIESEL_BASIC.has(f));
    const hasPremium = station.fuel.some(f => DIESEL_PREMIUM.has(f));
    return hasPremium && !hasBasic;
}

function mergeWithHistory(activeStations, existingFile, today) {
    const existing = fs.existsSync(existingFile)
        ? JSON.parse(fs.readFileSync(existingFile, 'utf8'))
        : [];

    const registry = new Map(existing.map(s => [s.url, s]));

    for (const s of activeStations) {
        if (registry.has(s.url)) {
            const entry = registry.get(s.url);
            if (!entry.dates.includes(today)) entry.dates.push(today);
        } else {
            registry.set(s.url, { name: s.title, url: s.url, lat: s.lat, lng: s.lng, dates: [today] });
        }
    }

    return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
}

(async () => {
    try {
        const html = await ensureHtml();
        const stations = parseStations(html);

        fs.writeFileSync(
            JSON_FILE,
            JSON.stringify(stations, null, 2),
            'utf8'
        );

        console.log(`Parsed ${stations.length} stations`);
        console.log(`JSON saved to ${JSON_FILE}`);

        const today = new Date().toISOString().slice(0, 10);

        const premiumGasoline = [];
        for (const s of stations.filter(hasOnlyPremiumGasoline)) {
            if (await isTemporarilyClosed(s.url)) {
                console.log(`Skipping temporarily closed station: ${s.title}`);
            } else {
                premiumGasoline.push(s);
            }
        }
        const gasolineOutput = mergeWithHistory(premiumGasoline, PREMIUM_GASOLINE_FILE, today);
        fs.writeFileSync(PREMIUM_GASOLINE_FILE, JSON.stringify(gasolineOutput, null, 2), 'utf8');
        console.log(`${premiumGasoline.length} premium-gasoline stations saved to ${PREMIUM_GASOLINE_FILE}`);

        const premiumDiesel = [];
        for (const s of stations.filter(hasOnlyPremiumDiesel)) {
            if (await isTemporarilyClosed(s.url)) {
                console.log(`Skipping temporarily closed station: ${s.title}`);
            } else {
                premiumDiesel.push(s);
            }
        }
        const dieselOutput = mergeWithHistory(premiumDiesel, PREMIUM_DIESEL_FILE, today);
        fs.writeFileSync(PREMIUM_DIESEL_FILE, JSON.stringify(dieselOutput, null, 2), 'utf8');
        console.log(`${premiumDiesel.length} premium-diesel stations saved to ${PREMIUM_DIESEL_FILE}`);

        const history = fs.existsSync(HISTORY_FILE)
            ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
            : [];
        if (!history.some(h => h.date === today)) {
            history.push({ date: today, gasoline: premiumGasoline.length, diesel: premiumDiesel.length });
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
            console.log(`History updated: ${today} gasoline=${premiumGasoline.length} diesel=${premiumDiesel.length}`);
        }
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
})();
