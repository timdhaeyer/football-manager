// Page lifecycle hooks: re-sync immediately when the app returns to the foreground,
// and flush state when it is being hidden (iOS may kill it without further notice).

export function installLifecycle({ onVisible, onHidden }) {
  let lastVisible = document.visibilityState === 'visible';
  const visible = (source) => {
    if (document.visibilityState !== 'visible') return;
    onVisible(source, !lastVisible);
    lastVisible = true;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') visible('visibilitychange');
    else {
      lastVisible = false;
      onHidden('visibilitychange');
    }
  });
  addEventListener('pageshow', (e) => visible(e.persisted ? 'pageshow-bfcache' : 'pageshow'));
  addEventListener('focus', () => visible('focus'));
  addEventListener('pagehide', () => onHidden('pagehide'));
}
