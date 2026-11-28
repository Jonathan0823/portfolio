// The hero field's ignite pours the lava in after the cover lifts. Anything that sits on the poured lava (the nav's white
// links) waits for it here. It is kept on <html>, not in a module, since the scripts that read it may be bundled apart.

const POURED_CLASS = 'hero-poured';

/** marks the hero's lava as poured, for good */
export function markHeroPoured(): void {
  document.documentElement.classList.add(POURED_CLASS);
}

/** resolves once the hero's lava has poured (at once if it already has) */
export function whenHeroPoured(): Promise<void> {
  const root = document.documentElement;
  return new Promise((resolve) => {
    if (root.classList.contains(POURED_CLASS)) return resolve();
    const watch = new MutationObserver(() => {
      if (!root.classList.contains(POURED_CLASS)) return;
      watch.disconnect();
      resolve();
    });
    watch.observe(root, { attributes: true, attributeFilter: ['class'] });
  });
}
