const { spawn } = require('child_process');

async function testFrontend() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cdpPort = 9556;

    const proc = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=' + cdpPort,
        '--no-sandbox',
        'http://localhost:3000/lazysloth_cleaner.html'
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
            return new Promise((resolve) => {
                const reqId = id++;
                const handler = (ev) => {
                    const msg = JSON.parse(ev.data);
                    if (msg.id === reqId) {
                        ws.removeEventListener('message', handler);
                        resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        await call('Page.enable');
        await call('Runtime.enable');

        for (let i = 0; i < 30; i++) {
            const ready = await call('Runtime.evaluate', {
                expression: 'document.readyState === "complete" && Boolean(window.LazySlothApp)'
            });
            if (ready && ready.result && ready.result.value) break;
            await new Promise(r => setTimeout(r, 200));
        }

        console.log('Connecting frontend to http://localhost:5001...');
        const connectRes = await call('Runtime.evaluate', {
            expression: 'LazySlothApp.getGemmaService().connectLocalEndpoint("http://localhost:5001")',
            awaitPromise: true,
            returnByValue: true
        });
        console.log('Connect result:', connectRes.result.value);

        // Switch to photos
        await call('Runtime.evaluate', { expression: 'LazySlothApp.switchTab("photos")' });

        // Process real canvas image files
        console.log('Generating valid PNG images with canvas and testing real inference...');
        const processResult = await call('Runtime.evaluate', {
            expression: `(async () => {
                function createTestImg(name, color, text) {
                    const canvas = document.createElement("canvas");
                    canvas.width = 150;
                    canvas.height = 100;
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, 150, 100);
                    ctx.fillStyle = "#000000";
                    ctx.font = "14px sans-serif";
                    ctx.fillText(text, 10, 50);

                    const dataUrl = canvas.toDataURL("image/png");
                    const binStr = atob(dataUrl.split(",")[1]);
                    const bytes = new Uint8Array(binStr.length);
                    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                    const file = new File([bytes], name, { type: "image/png" });
                    return file;
                }

                const f1 = createTestImg("sunset_original.png", "#E98776", "Sunset");
                // Exact copy with identical bytes
                const buf = await f1.arrayBuffer();
                const f2 = new File([buf], "sunset_copy.png", { type: "image/png" });
                const fDoc = createTestImg("study_notes_calculus.png", "#FFFFFF", "Calculus Notes");

                await LazySlothApp.processLocalPhotoFiles([f1, f2, fDoc]);

                return Array.from(document.querySelectorAll("#photo-grid .paper-card")).map(c => ({
                    title: c.querySelector("h4")?.innerText,
                    badge: c.querySelector("span")?.innerText,
                    hasGemmaBadge: c.innerText.includes("Gemma:"),
                    fullCardText: c.innerText.replace(/\\s+/g, ' ')
                }));
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        console.log('Cards rendered in Photos grid with real Gemma inference:');
        console.log(JSON.stringify(processResult.result.value, null, 2));

    } finally {
        proc.kill();
    }
}

testFrontend().catch(console.error);
