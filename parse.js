import fs from 'fs';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import he from 'he';

const SOURCE_URL = 'https://www.ina.hr/trazilica-benzinskih-postaja/';
const HTML_FILE = 'ina.html';
const JSON_FILE = 'ina.json';

async function ensureHtml() {
    if (fs.existsSync(HTML_FILE)) {
        console.log('Koristim postojeci ina.html');
        return fs.readFileSync(HTML_FILE, 'utf8');
    }

    console.log('Skidam HTML sa INA stranice...');
    const html = await fetch(SOURCE_URL, {
        headers: {
            'User-Agent': 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
        }
    }).then(r => r.text());

    fs.writeFileSync(HTML_FILE, html, 'utf8');
    console.log('Spremljeno u ina.html');

    return html;
}

function parseStations(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const mdata = document.querySelector('#mdata');
    if (!mdata) {
        throw new Error('#mdata element nije pronaden');
    }

    const rawStations = mdata.getAttribute('stations');
    if (!rawStations) {
        throw new Error('stations atribut nije pronaden');
    }

    // HTML decode
    const decoded = he.decode(rawStations);

    // JSON parse
    return JSON.parse(decoded);
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

        console.log(`Parsirano ${stations.length} postaja`);
        console.log(`JSON spremljen u ${JSON_FILE}`);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
})();
