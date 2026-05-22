const assert = require('node:assert/strict');
const test = require('node:test');
const { performance } = require('perf_hooks');
const { createTempDataFile } = require('../helpers/moduleTools');

process.env.BOT_DATA_FILE = createTempDataFile('singleton-extreme.json').dataFile;
process.env.LOG_LEVEL = 'error';

const { DisplayService } = require('../../src/services/displayService');

async function waitForQueue(service) {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
        if (!service.isProcessing && service.updateQueue.size === 0) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 2));
    }

    throw new Error('Timed out waiting for extreme simulation queue');
}

test('simulates a 1000-person burst queue without real Discord calls', async () => {
    const started = performance.now();
    const service = new DisplayService({ queueDelayMs: 0, updateTimeoutMs: 100 });
    const processed = [];
    let releaseFirst;
    const first = new Promise(resolve => {
        releaseFirst = resolve;
    });

    service.updateMemberDisplay = async (guild, channel, memberId) => {
        processed.push(memberId);
        if (processed.length === 1) {
            await first;
        }
    };

    for (let index = 0; index < 1000; index += 1) {
        service.queueMemberUpdate({}, {}, `member-${index}`, [`role-${index % 25}`]);
    }

    for (let index = 0; index < 5000; index += 1) {
        service.queueMemberUpdate({}, {}, `member-${index % 1000}`, [`role-burst-${index}`]);
    }

    releaseFirst();
    await waitForQueue(service);

    const durationMs = Math.round(performance.now() - started);
    const memoryMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    console.log(JSON.stringify({
        simulation: '1000-person-burst',
        durationMs,
        memoryMb,
        processedUpdates: processed.length,
        deduplicatedUpdates: 6000 - processed.length,
    }));

    assert.ok(processed.length >= 1000);
    assert.ok(processed.length <= 1001);
    assert.ok(durationMs < 5000);
});
