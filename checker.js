import fetch from 'node-fetch';
import { exec } from 'child_process';
import { JSDOM } from 'jsdom';
import cron from 'node-cron';
import { readFile } from 'fs/promises';


async function getFaviconURL(doc, baseURL) {
    const selectors = [
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]',
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="mask-icon"]',
        'link[rel="favicon"]',
    ];
    for (const selector of selectors) {
        const link = doc.querySelector(selector);
        if (link?.getAttribute('href')) {
            const faviconPath = link.getAttribute('href');
            try {
                if (faviconPath.startsWith('http')) {
                    return faviconPath;
                }
                else if (faviconPath.startsWith('//')) {
                    return `https:${faviconPath}`;
                }
                else {
                    const url = new URL(faviconPath, baseURL);
                    return url.href;
                }
            }
            catch (error) {
                console.warn(`Error processing favicon path: ${faviconPath}`, error);
                continue;
            }
        }
    }
    try {
        const defaultFavicon = new URL('/favicon.ico', baseURL);
        return defaultFavicon.href;
    }
    catch (error) {
        return '';
    }
}

async function getURLMetadata(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const dom = new JSDOM(html, { url });
        const doc = dom.window.document;
        const metadata = {
            title: '',
            imageURL: '',
            description: '',
            date: '',
            favicon: '',
        };
        metadata.title =
            doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                doc.querySelector('title')?.textContent ||
                '';
        metadata.imageURL =
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
                '';
        metadata.description =
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
                '';
        metadata.date =
            doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
                doc.querySelector('meta[property="article:modified_time"]')?.getAttribute('content') ||
                doc.querySelector('time')?.getAttribute('datetime') ||
                '';
        metadata.favicon = await getFaviconURL(doc, url);
        return metadata;
    }
    catch (error) {
        throw new Error(`Failed to fetch metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function checkServers() {
    for (const server of servers) {
        try {
            const metadata = await getURLMetadata(server.url);
            console.log(`${server.name} is running....`);
        }
        catch (error) {
            console.log(`${server.name} is down. Restarting......`);
            exec(`${server.command} ${server.name}`, (err, stdout, stderr) => {
                if (err) {
                    console.error(`[ERROR] Failed to restart ${server.name}:`, err.message);
                }
                else {
                    console.log(`[INFO] Restarted ${server.name}:\n${stdout}`);
                }
            });
        }
    }
}

async function loadServerDetails() {
    try {
        const data = await readFile(new URL('./server_config.json', import.meta.url), 'utf-8'); 
        const jsonData = JSON.parse(data);
        const servers = jsonData.servers;
        return servers
    } catch (error) {
        console.error('Error loading JSON file:', error);
    }
}

const servers = await loadServerDetails()


cron.schedule('*/5 * * * *', async () => {
    console.log('Checking server statuses...');
    await checkServers();
});
