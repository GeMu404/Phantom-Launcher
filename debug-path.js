const fs = require('fs');
const path = require('path');

const testPaths = [
    "D%3A%5CMedia%5CDesktop%5CRos--Streamline-Simple-Icons.png",
    "C%3A%5CUsers%5CGeMu%5CAppData%5CLocal%5CPhantomLauncher%5Csystem%5Cstorage%5Cassets%5Csteam_105600%5Cbanner.jpg"
];

console.log("--- Path Resolution Debug ---");

testPaths.forEach(rawPath => {
    console.log(`\nTesting: ${rawPath}`);

    // Exact logic from server.ts
    let candidates = [
        path.resolve(rawPath),
        rawPath,
        decodeURIComponent(rawPath)
    ];
    // Remove duplicates
    candidates = [...new Set(candidates)];

    let found = false;
    for (const p of candidates) {
        console.log(`Checking candidate: "${p}"`);
        if (fs.existsSync(p)) {
            console.log(`  -> FOUND!`);
            found = true;
            break;
        } else {
            console.log(`  -> Not found`);
        }
    }

    if (!found) console.log("FAILED to find file in any candidate.");
});
