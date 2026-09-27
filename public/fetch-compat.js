(function () {
  if (typeof window === 'undefined') return;
  try {
    var activeFetch =
      typeof window.fetch === 'function'
        ? window.fetch.bind(window)
        : undefined;

    var defineSafeFetchAccessor = function (target) {
      if (!target) return;
      try {
        var desc = Object.getOwnPropertyDescriptor(target, 'fetch');
        if (!desc || desc.configurable !== false) {
          Object.defineProperty(target, 'fetch', {
            configurable: true,
            enumerable: true,
            get: function () {
              return activeFetch;
            },
            set: function (nextFetch) {
              if (typeof nextFetch === 'function') {
                activeFetch = nextFetch;
              }
            },
          });
        }
      } catch (_innerErr) {
        // Ignore if non-configurable on this target
      }
    };

    if (typeof Window !== 'undefined' && Window.prototype) {
      defineSafeFetchAccessor(Window.prototype);
    }
    defineSafeFetchAccessor(window);
    if (typeof globalThis !== 'undefined' && globalThis !== window) {
      defineSafeFetchAccessor(globalThis);
    }
  } catch (_err) {
    // Ignore if non-configurable
  }
})();
