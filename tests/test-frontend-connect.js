const { spawn } = require('child_process');

async function testFrontendConnection() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cdpPort = 9337;
    const proc = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=' + cdpPort,
        '--no-sandbox',
        'http://localhost:3000/lazysloth_cleaner.html'
    ]);

    await new Promise(r => setTimeout(r, 2000));
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
            if (msg.method === 'Network.responseReceived') {
                networkEvents.push({
                    type: 'response',
                    url: msg.params.response.url,
                    status: msg.params.response.status,
                    headers: msg.params.response.headers
                });
            }
            if (msg.method === 'Network.loadingFailed') {
                networkEvents.push({
                    type: 'failed',
                    url: msg.params.url,
                    errorText: msg.params.errorText,
                    blockedReason: msg.params.blockedReason
                });
            }
            if (msg.method === 'Console.messageAdded') {
                consoleEvents.push(msg.params.message);
            }
        };

        await call('Page.enable');
        await call('Runtime.enable');
        await call('Console.enable');
        await call('Network.enable');

        // Wait for page
        for (let i = 0; i < 40; i++) {
            const isReady = await call('Runtime.evaluate', {
                expression: 'document.readyState === "complete" && Boolean(window.LazySlothApp)'
            });
            if (isReady && isReady.result && isReady.result.value) break;
            await new Promise(r => setTimeout(r, 200));
        }

        console.log('--- Triggering connectLocalEndpoint from frontend ---');
        const connectEval = await call('Runtime.evaluate', {
            expression: 'window.LazySlothApp.getGemmaService().connectLocalEndpoint("http://localhost:5001")',
            awaitPromise: true,
            returnByValue: true
        });
        console.log('connectLocalEndpoint result:', JSON.stringify(connectEval.result.value, null, 2));

        const statusEval = await call('Runtime.evaluate', {
            expression: 'window.LazySlothApp.getGemmaService().getStatus()',
            returnByValue: true
        });
        console.log('Gemma Service Status:', JSON.stringify(statusEval.result.value, null, 2));

        const pillText = await call('Runtime.evaluate', {
            expression: 'document.getElementById("ai-status-label").innerText',
            returnByValue: true
        });
        console.log('UI AI Status Pill Text:', pillText.result.value);

        console.log('Network Events for 5001:', JSON.stringify(networkEvents.filter(e => e.url && e.url.includes('5001')), null, 2));
        console.log('Console Errors:', JSON.stringify(consoleEvents.filter(m => m.level === 'error'), null, 2));

    } finally {
        proc.kill();
    }
}

testFrontendConnection().catch(console.error);
