//jangan kore yang ini ges

/* ============================================================
   SIPFAS - CSRF HELPER (FRONTEND)

   Membungkus window.fetch agar setiap request yang mengubah
   data (POST, PUT, PATCH, DELETE) otomatis membawa header
   X-CSRF-Token. Token diambil dari api/shared/csrf-token.php.

   Cara pakai: muat file ini SEBELUM script halaman:
   <script src="../../assets/js/csrf.js"></script>
============================================================ */
(function () {
  "use strict";

  if (window.__sipfasCsrfReady) return;
  window.__sipfasCsrfReady = true;

  const nativeFetch = window.fetch.bind(window);
  const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

  // Alamat endpoint token dihitung dari lokasi file csrf.js ini
  // (assets/js/csrf.js -> ../../api/shared/csrf-token.php).
  const scriptSrc = document.currentScript && document.currentScript.src;
  const TOKEN_URL = new URL(
    "../../api/shared/csrf-token.php",
    scriptSrc || window.location.href,
  ).href;

  let tokenPromise = null;

  function getToken(forceRefresh) {
    if (!tokenPromise || forceRefresh) {
      tokenPromise = nativeFetch(TOKEN_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (result) {
          if (!result || !result.success || !result.data || !result.data.csrf_token) {
            throw new Error("Token CSRF tidak tersedia.");
          }
          return result.data.csrf_token;
        })
        .catch(function (error) {
          tokenPromise = null;
          throw error;
        });
    }
    return tokenPromise;
  }

  async function isTokenRejected(response) {
    if (response.status !== 403 && response.status !== 419) return false;
    try {
      const body = await response.clone().json();
      return /token/i.test(String((body && body.message) || ""));
    } catch (error) {
      return false;
    }
  }

  window.fetch = async function (input, init) {
    init = init || {};

    const isRequest = typeof Request !== "undefined" && input instanceof Request;
    const method = String(init.method || (isRequest ? input.method : "GET")).toUpperCase();
    const url = new URL(isRequest ? input.url : String(input), window.location.href);

    // Request aman atau ke domain lain: biarkan apa adanya.
    if (SAFE_METHODS.includes(method) || url.origin !== window.location.origin) {
      return nativeFetch(input, init);
    }

    async function send(forceRefresh) {
      const token = await getToken(forceRefresh);
      const headers = new Headers(init.headers || (isRequest ? input.headers : undefined));
      headers.set("X-CSRF-Token", token);

      return nativeFetch(
        isRequest ? input.clone() : input,
        Object.assign({}, init, { headers: headers }),
      );
    }

    let response = await send(false);

    // Token ditolak server (403/419 dengan pesan token): ambil token
    // baru lalu coba sekali lagi.
    if (await isTokenRejected(response)) {
      response = await send(true);
    }

    return response;
  };

  // Untuk dipanggil manual jika diperlukan (misalnya setelah login).
  window.sipfasCsrfRefresh = function () {
    return getToken(true);
  };
})();