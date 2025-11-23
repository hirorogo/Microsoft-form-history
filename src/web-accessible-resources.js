window.postMessage(
  {
    source: "google-form-history",
    payload: FB_PUBLIC_LOAD_DATA_,
  },
  window.location.origin
);
