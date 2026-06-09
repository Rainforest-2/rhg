process.env.BCU_ICON_BUILD_SCOPE = 'unit';

await import(`./build-bcu-unit-icon-index.mjs?ts=${Date.now()}`);
await import(`./build-bcu-icon-bundles.mjs?scope=unit&ts=${Date.now()}`);

console.log('regenerate-bcu-unit-icons-only: OK');
