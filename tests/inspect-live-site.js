const { spawn } = require('child_process');

async function testLiveDeployedSite() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cdpPort = 9339;
    const proc = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=' + cdpPort,
        '--no-sandbox',
        'https://lazysloth-cleaner.onrender.com/'
    ]);

    await new Promise(r => setTimeout(r, 2500));
    try {
        const listRes = await fetch('http://localhost:' + cdpPort + '/json/list');
        const list = await listRes.json();
        const page = list.find(t => t.type === 'page');
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);
        let id = 1;

        function call(method, params = {}) {
            return new Promise((resolve, reject) => {
                const reqId = id++;
                const handler = (ev) => {
                    const msg = JSON.parse(ev.data);
                    if (msg.id === reqId) {
                        ws.removeEventListener('message', handler);
                        if (msg.error) reject(new Error(msg.error.message));
                        else resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        const networkEvents = [];
        const consoleEvents = [];
        ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.method === 'Console.messageAdded') consoleEvents.push(msg.params.message);
            if (msg.method === 'Network.loadingFailed') networkEvents.push(msg.params);
        };

        await call('Page.enable');
        await call('Runtime.enable');
        await call('Console.enable');
        await call('Network.enable');

        for (let i = 0; i < 40; i++) {
            const isReady = await call('Runtime.evaluate', {
                expression: 'document.readyState === "complete" && Boolean(window.LazySlothApp)'
            });
            if (isReady && isReady.result && isReady.result.value) break;
            await new Promise(r => setTimeout(r, 200));
        }

        const pillText = await call('Runtime.evaluate', {
            expression: 'document.getElementById("ai-status-label").innerText',
            returnByValue: true
        });
        console.log('Live Site UI Status Pill:', pillText.result.value);

        const statusRes = await call('Runtime.evaluate', {
            expression: 'window.LazySlothApp.getGemmaService().getStatus()',
            returnByValue: true
        });
        console.log('Live Site Gemma Service State:', JSON.stringify(statusRes.result.value, null, 2));

        console.log('--- Testing connect to localhost:5001 from live HTTPS site ---');
        const connectRes = await call('Runtime.evaluate', {
            expression: 'window.LazySlothApp.getGemmaService().connectLocalEndpoint("http://localhost:5001")',
            awaitPromise: true,
            returnByValue: true
        });
        console.log('Connect Result from Live Site:', JSON.stringify(connectRes.result.value, null, 2));

        console.log('Console Messages on Live Site:', JSON.stringify(consoleEvents, null, 2));
        console.log('Network Failures on Live Site:', JSON.stringify(networkEvents, null, 2));

    } finally {
        proc.kill();
    }
}

testLiveDeployedSite().catch(console.error);
