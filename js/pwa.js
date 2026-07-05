const manifestLink = document.querySelector('link[rel="manifest"]');
const appRoot = manifestLink?.href ? new URL('.', manifestLink.href) : new URL('./', window.location.href);

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', appRoot).href, { scope: appRoot.href })
      .catch((error) => {
        console.warn('PWA service worker registration failed', error);
      });
  });
}
