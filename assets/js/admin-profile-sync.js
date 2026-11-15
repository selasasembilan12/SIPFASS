/* Sinkronisasi nama dan foto pada header seluruh halaman Admin. */
(function () {
  "use strict";

  function readJSON(storage, key, fallback) {
    try {
      return JSON.parse(storage.getItem(key)) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function normalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  function syncAdminProfile() {
    const active = readJSON(sessionStorage, "sipfasActiveUser", null);
    if (!active || !["admin", "administrator"].includes(normalize(active.role)))
      return;

    const users = readJSON(localStorage, "sipfasUsers", []);
    const account =
      Array.isArray(users) &&
      users.find((user) => {
        if (!user) return false;
        if (active.id && user.id) return String(active.id) === String(user.id);
        if (active.username && user.username)
          return normalize(active.username) === normalize(user.username);
        return Boolean(
          active.email &&
          user.email &&
          normalize(active.email) === normalize(user.email),
        );
      });

    const name =
      account?.name ||
      account?.fullName ||
      account?.nama ||
      active.name ||
      active.fullName ||
      active.nama ||
      "Administrator";

    // Gunakan kunci yang sama persis dengan Profil-Saya.js (termasuk huruf kapital).
    const identifier =
      active.id || active.username || active.email || "administrator";
    let photo = null;
    try {
      photo = localStorage.getItem("sipfasProfilePhoto_" + identifier);
    } catch (error) {
      console.error("Gagal membaca foto admin:", error);
    }

    document.querySelectorAll(".topbar-user-name").forEach((element) => {
      element.textContent = name;
    });

    document.querySelectorAll(".topbar-user-avatar").forEach((avatar) => {
      let image = avatar.querySelector(".admin-header-photo");
      const icon = avatar.querySelector("svg");

      if (photo) {
        if (!image) {
          image = document.createElement("img");
          image.className = "admin-header-photo";
          image.alt = "Foto profil admin";
          Object.assign(image.style, {
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          });
          avatar.appendChild(image);
        }
        image.src = photo;
        if (icon) icon.style.display = "none";
      } else {
        if (image) image.remove();
        if (icon) icon.style.display = "";
      }
    });
  }

  // Muat saat halaman dibuka dan ketika data diperbarui.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncAdminProfile);
  } else {
    syncAdminProfile();
  }
  window.addEventListener("sipfas:admin-profile-updated", syncAdminProfile);
  window.addEventListener("pageshow", syncAdminProfile);
  window.addEventListener("storage", syncAdminProfile);
})();
