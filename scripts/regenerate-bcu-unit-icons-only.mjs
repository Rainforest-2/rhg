process.env.BCU_ICON_BUILD_SCOPE = 'unit';

await import(`./build-bcu-unit-icon-index.mjs?ts=${Date.now()}`);
await import(`./build-bcu-unit-icon-bundles-lite.mjs?ts=${Date.now()}`);

console.log('regenerate-bcu-unit-icons-only: OK');
