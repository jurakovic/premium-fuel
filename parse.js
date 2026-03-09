import fs from 'fs';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import he from 'he';

const SOURCE_URL = 'https://www.ina.hr/trazilica-benzinskih-postaja/';
const HTML_FILE = 'ina.html';
const JSON_FILE = 'ina.json';
const PREMIUM_FILE = 'premium.json';

const GASOLINE_BASIC = new Set([
    "1000298", // Eurosuper 95
    "1002498", // Eurosuper 95 Class Plus
]);

const GASOLINE_PREMIUM = new Set([
    "1002212", // Eurosuper 95 Class Plus Premium
]);

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

function hasOnlyPremium(station) {
    const hasBasic = station.fuel.some(f => GASOLINE_BASIC.has(f));
    const hasPremium = station.fuel.some(f => GASOLINE_PREMIUM.has(f));

    return hasPremium && !hasBasic;
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

        const premiumOnlyStations = stations.filter(hasOnlyPremium);

        fs.writeFileSync(
            PREMIUM_FILE,
            JSON.stringify(premiumOnlyStations.map(s => ({
                name: s.title,
                url: s.url,
                lat: s.lat,
                lng: s.lng
            })), null, 2),
            'utf8'
        );

        console.log(`${premiumOnlyStations.length} premium-only stations saved to ${PREMIUM_FILE}`);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
})();
