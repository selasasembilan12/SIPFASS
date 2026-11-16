//PROFIL.JS

(function () {
  "use strict";

  // 01. KONFIGURASI & STATE
  const CONFIG = {
    usersKey: "sipfasUsers",
    activeUserKey: "sipfasActiveUser",
    pendingUserKey: "sipfasPendingLogin",
    photoPrefix: "sipfas_profile_photo_",
    maxPhotoSize: 1.5 * 1024 * 1024,
  };

  let isSaving = false;
  let selectedPhoto = null;
  let originalPhoto = null;
  let originalProfile = null;
  let notificationTimer = null;

  function initializeProfile() {
    const form = document.getElementById("profileForm");
    if (!form) {
      console.error("[SIPFAS] Form profil tidak ditemukan.");
      return;
    }
    if (form.dataset.profileInitialized === "true") return;
    form.dataset.profileInitialized = "true";

    const fields = {
      name: document.getElementById("fullName"),
      username: document.getElementById("username"),
      email: document.getElementById("email"),
      currentPassword: document.getElementById("currentPassword"),
      newPassword: document.getElementById("newPassword"),
      confirmPassword: document.getElementById("confirmPassword"),
    };

    const avatar = document.querySelector(".large-avatar");
    const identityName = document.querySelector(".profile-identity h2");
    const saveButton =
      document.getElementById("saveButton") ||
      form.querySelector(".save-button") ||
      form.querySelector('button[type="submit"]');
    const cancelButton =
      document.getElementById("cancelChanges") ||
      form.querySelector(".cancel-button");

    if (!fields.name || !fields.username || !fields.email || !saveButton) {
      console.error("[SIPFAS] Elemen formulir profil tidak lengkap.");
      return;
    }

    // 02. NOTIFIKASI FORMULIR
    let feedback = document.getElementById("formFeedback");
    if (!feedback) {
      feedback = document.createElement("p");
      feedback.id = "formFeedback";
      feedback.className = "form-feedback";
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      form.appendChild(feedback);
    }

    function showNotification(message, type = "info") {
      clearTimeout(notificationTimer);
      feedback.textContent = message;
      feedback.className = "form-feedback " + type;
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");

      if (type === "success") {
        notificationTimer = setTimeout(function () {
          feedback.textContent = "";
          feedback.className = "form-feedback";
        }, 5000);
      }
    }

    // 03. MANAJEMEN DATA AKUN & SESI
    function normalize(value) {
      return String(value || "").trim().toLowerCase();
    }

    function readUsers() {
      try {
        const saved = localStorage.getItem(CONFIG.usersKey);
        if (!saved) return [];
        const users = JSON.parse(saved);
        if (!Array.isArray(users)) throw new Error("Format akun tidak valid.");
        return users;
      } catch (error) {
        console.error("[SIPFAS] Gagal membaca akun:", error);
        throw new Error("Data akun tidak dapat dibaca.");
      }
    }

    function readActiveUser() {
      const candidates = [
        localStorage.getItem(CONFIG.activeUserKey),
        sessionStorage.getItem(CONFIG.activeUserKey),
        sessionStorage.getItem(CONFIG.pendingUserKey),
        localStorage.getItem(CONFIG.pendingUserKey),
      ];

      for (const raw of candidates) {
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") return parsed;
        } catch (error) {
          // Lanjut ke kandidat berikutnya
        }
      }
      return null;
    }

    function syncActiveSessionStorage(updatedActiveUser) {
      const serialized = JSON.stringify(updatedActiveUser);
      try {
        sessionStorage.setItem(CONFIG.activeUserKey, serialized);
      } catch (error) {
        console.warn("[SIPFAS] Gagal menulis sessionStorage:", error);
      }
      try {
        localStorage.setItem(CONFIG.activeUserKey, serialized);
      } catch (error) {
        console.warn("[SIPFAS] Gagal menulis localStorage:", error);
      }
    }

    function getCurrentAccount() {
      const users = readUsers();
      const activeUser = readActiveUser();
      if (!activeUser) {
        throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
      }

      const index = users.findIndex(function (user) {
        if (activeUser.id && user.id && String(activeUser.id) === String(user.id)) {
          return true;
        }
        return (
          (normalize(activeUser.username) &&
            normalize(activeUser.username) === normalize(user.username)) ||
          (normalize(activeUser.email) &&
            normalize(activeUser.email) === normalize(user.email))
        );
      });

      if (index === -1) throw new Error("Akun pengguna tidak ditemukan.");
      return { users, activeUser, index, user: users[index] };
    }

    // 04. IDENTITAS PROFIL & UTILITAS
    function getProfileData() {
      return {
        name: fields.name.value.trim(),
        username: fields.username.value.trim(),
        email: fields.email.value.trim().toLowerCase(),
      };
    }

    function formatRoleLabel(role) {
      const value = normalize(role);
      if (value === "administrator" || value === "admin") return "Administrator";
      if (value === "petugas") return "Petugas";
      if (value === "pelapor" || value === "user") return "Pelapor";
      return "Petugas";
    }

    function getInitials(name) {
      const words = String(name || "").trim().split(/\s+/).filter(Boolean);
      return (
        words
          .slice(0, 2)
          .map((word) => word.charAt(0))
          .join("")
          .toUpperCase() || "PT"
      );
    }

    function getPhotoKey(username) {
      return CONFIG.photoPrefix + encodeURIComponent(normalize(username));
    }

    function resolveStoredPhoto(user) {
      if (!user) return null;
      const byUsername = user.username ? localStorage.getItem(getPhotoKey(user.username)) : null;
      return byUsername || user.avatar || user.photo || user.foto || null;
    }

    // 05. FITUR & TAMPILAN AVATAR PROFIL
    let photoInput = document.getElementById("profilePhotoInput");
    if (!photoInput) {
      photoInput = document.createElement("input");
      photoInput.type = "file";
      photoInput.id = "profilePhotoInput";
      photoInput.accept = "image/jpeg,image/png,image/webp";
      photoInput.hidden = true;
      document.body.appendChild(photoInput);
    }

    let photoButton = document.getElementById("chooseProfilePhoto");
    if (!photoButton && avatar) {
      photoButton = document.createElement("button");
      photoButton.id = "chooseProfilePhoto";
      avatar.appendChild(photoButton);
    }

    if (avatar && photoButton) {
      if (photoButton.parentElement !== avatar) avatar.appendChild(photoButton);

      photoButton.type = "button";
      photoButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14 5 5 5"/>
          <path d="M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20z"/>
        </svg>
      `;
      photoButton.title = "Ubah foto profil";
      photoButton.setAttribute("aria-label", "Ubah foto profil");

      Object.assign(photoButton.style, {
        position: "absolute",
        right: "-2px",
        bottom: "3px",
        width: "25px",
        height: "25px",
        padding: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid #ffffff",
        borderRadius: "50%",
        background: "#2864f0",
        color: "#ffffff",
        cursor: "pointer",
        zIndex: "5",
      });

      avatar.style.position = "relative";

      const pencilIcon = photoButton.querySelector("svg");
      if (pencilIcon) {
        Object.assign(pencilIcon.style, {
          width: "14px",
          height: "14px",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        });
      }

      const verifiedMark = avatar.querySelector(".verified-mark");
      if (verifiedMark) verifiedMark.style.display = "none";

      photoButton.addEventListener("click", function () {
        if (isSaving) return;
        photoInput.click();
      });
    }

    function updateAvatar(name, photo = null) {
      if (!avatar) return;

      let initials = avatar.querySelector(".avatar-initials");
      if (!initials) {
        initials = document.createElement("span");
        initials.className = "avatar-initials";
        avatar.prepend(initials);
      }
      initials.textContent = getInitials(name);

      let image = avatar.querySelector(".profile-photo");
      if (photo) {
        if (!image) {
          image = document.createElement("img");
          image.className = "profile-photo";
          image.alt = "Foto profil petugas";
          avatar.prepend(image);
        }
        image.src = photo;
        Object.assign(image.style, {
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "50%",
          zIndex: "1",
        });
        initials.hidden = true;
      } else {
        if (image) image.remove();
        initials.hidden = false;
      }

      if (photoButton) avatar.appendChild(photoButton);
    }

    function loadPhoto(user) {
      const photo = resolveStoredPhoto(user);
      originalPhoto = photo;
      updateAvatar(fields.name.value, photo);
    }

    photoInput.addEventListener("change", function (event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        showNotification("Format foto harus JPG, PNG, atau WEBP.", "error");
        photoInput.value = "";
        return;
      }

      if (file.size > CONFIG.maxPhotoSize) {
        showNotification("Ukuran foto maksimal 1,5 MB.", "error");
        photoInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        if (typeof reader.result !== "string") {
          showNotification("Foto gagal dibaca.", "error");
          return;
        }
        selectedPhoto = reader.result;
        updateAvatar(fields.name.value, selectedPhoto);
        updateHeaderAvatar(fields.name.value, selectedPhoto);
        showNotification("Foto berhasil dipilih. Klik Simpan Perubahan untuk menyimpan.", "info");
      };
      reader.onerror = function () {
        showNotification("Terjadi kesalahan saat membaca foto.", "error");
      };
      reader.readAsDataURL(file);
    });

    // 06. VALIDASI PROFIL & KATA SANDI
    function validateProfile() {
      const data = getProfileData();
      if (data.name.length < 3) {
        fields.name.focus();
        showNotification("Nama lengkap minimal 3 karakter.", "error");
        return false;
      }
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(data.username)) {
        fields.username.focus();
        showNotification("Username harus terdiri dari 3-30 karakter.", "error");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        fields.email.focus();
        showNotification("Format email tidak valid.", "error");
        return false;
      }
      return true;
    }

    function validatePassword() {
      const current = fields.currentPassword?.value || "";
      const newPassword = fields.newPassword?.value || "";
      const confirmation = fields.confirmPassword?.value || "";
      const requested = Boolean(current || newPassword || confirmation);

      if (!requested) return { valid: true, requested: false };

      if (!current || !newPassword || !confirmation) {
        showNotification("Lengkapi seluruh kolom perubahan kata sandi.", "error");
        return { valid: false, requested: true };
      }
      if (newPassword.length < 8) {
        fields.newPassword.focus();
        showNotification("Kata sandi baru minimal 8 karakter.", "error");
        return { valid: false, requested: true };
      }
      if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        fields.newPassword.focus();
        showNotification("Kata sandi harus mengandung huruf dan angka.", "error");
        return { valid: false, requested: true };
      }
      if (current === newPassword) {
        fields.newPassword.focus();
        showNotification("Kata sandi baru harus berbeda dari kata sandi lama.", "error");
        return { valid: false, requested: true };
      }
      if (newPassword !== confirmation) {
        fields.confirmPassword.focus();
        showNotification("Konfirmasi kata sandi tidak cocok.", "error");
        return { valid: false, requested: true };
      }
      return { valid: true, requested: true };
    }

    function clearPasswordFields() {
      if (fields.currentPassword) fields.currentPassword.value = "";
      if (fields.newPassword) fields.newPassword.value = "";
      if (fields.confirmPassword) fields.confirmPassword.value = "";
    }

    // 07. PENYIMPANAN PROFIL, FOTO & KATA SANDI
    function saveProfileAndPhoto(data, newPhotoDataUrl) {
      const account = getCurrentAccount();

      const duplicate = account.users.some(function (user, index) {
        if (index === account.index) return false;
        return (
          normalize(user.username) === normalize(data.username) ||
          normalize(user.email) === normalize(data.email)
        );
      });

      if (duplicate) {
        throw new Error("Username atau email sudah digunakan akun lain.");
      }

      const oldUsername = account.user.username || "";
      const effectivePhoto = newPhotoDataUrl || resolveStoredPhoto(account.user) || "";

      if (effectivePhoto) {
        const newPhotoKey = getPhotoKey(data.username);
        try {
          localStorage.setItem(newPhotoKey, effectivePhoto);
        } catch (storageError) {
          throw new Error("Penyimpanan browser penuh. Gunakan foto dengan ukuran lebih kecil.");
        }

        if (oldUsername && normalize(oldUsername) !== normalize(data.username)) {
          localStorage.removeItem(getPhotoKey(oldUsername));
        }
      }

      const updatedUser = {
        ...account.user,
        name: data.name,
        fullName: data.name,
        username: data.username,
        email: data.email,
        avatar: effectivePhoto || account.user.avatar || "",
        photo: effectivePhoto || account.user.photo || "",
        updatedAt: new Date().toISOString(),
      };

      account.users[account.index] = updatedUser;
      localStorage.setItem(CONFIG.usersKey, JSON.stringify(account.users));

      const updatedActiveUser = {
        ...account.activeUser,
        id: updatedUser.id,
        name: updatedUser.name,
        fullName: updatedUser.fullName,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: effectivePhoto || "",
        photo: effectivePhoto || "",
      };

      syncActiveSessionStorage(updatedActiveUser);

      const verification = readUsers()[account.index];
      if (
        verification.name !== data.name ||
        verification.username !== data.username ||
        verification.email !== data.email
      ) {
        throw new Error("Pembaruan profil gagal diverifikasi.");
      }

      return updatedActiveUser;
    }

    function updatePassword() {
      const account = getCurrentAccount();
      const current = fields.currentPassword.value;
      const newPassword = fields.newPassword.value;

      if (String(account.user.password || "") !== current) {
        throw new Error("Kata sandi saat ini tidak sesuai.");
      }

      account.users[account.index] = {
        ...account.user,
        password: newPassword,
        passwordUpdatedAt: new Date().toISOString(),
      };

      localStorage.setItem(CONFIG.usersKey, JSON.stringify(account.users));

      const verification = readUsers()[account.index];
      if (verification.password !== newPassword) {
        throw new Error("Pembaruan kata sandi gagal diverifikasi.");
      }
      return true;
    }

    // 08. PEMBARUAN TAMPILAN HEADER & FORM
    function updateHeaderAvatar(name, photo = null, roleLabel = "") {
      const headerAvatar = document.querySelector(
        ".profile-area .profile-avatar, .header-profile .profile-avatar, .user-profile .profile-avatar, .profile-avatar",
      );
      if (!headerAvatar) return;

      let headerImage = headerAvatar.querySelector(".profile-header-photo");
      let headerInitials = headerAvatar.querySelector(".profile-header-initials");
      const defaultIcon = headerAvatar.querySelector("svg");

      if (photo) {
        if (defaultIcon) defaultIcon.style.display = "none";
        if (headerInitials) headerInitials.remove();

        if (!headerImage) {
          headerImage = document.createElement("img");
          headerImage.className = "profile-header-photo";
          headerImage.alt = "Foto profil akun aktif";
          headerAvatar.appendChild(headerImage);
        }

        headerImage.src = photo;
        Object.assign(headerImage.style, {
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          borderRadius: "50%",
        });
      } else {
        if (headerImage) headerImage.remove();
        if (defaultIcon) defaultIcon.style.display = "none";

        if (!headerInitials) {
          headerInitials = document.createElement("span");
          headerInitials.className = "profile-header-initials";
          headerAvatar.appendChild(headerInitials);
        }

        headerInitials.textContent = getInitials(name);
        Object.assign(headerInitials.style, {
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontWeight: "700",
          fontSize: "14px",
        });
      }

      headerAvatar.style.overflow = "hidden";
      headerAvatar.setAttribute(
        "aria-label",
        photo ? "Foto profil " + (name || "akun aktif") : "Profil " + (name || "akun aktif"),
      );

      if (roleLabel) {
        const roleEl = document.querySelector(
          ".profile-area .profile-role, .profile-role, .officer-role",
        );
        if (roleEl) roleEl.textContent = roleLabel;
      }
    }

    function updateProfileDisplay(data, role = "") {
      if (identityName) identityName.textContent = data.name;

      const identityRole = document.querySelector(".profile-identity p, .profile-identity span");
      if (identityRole && role) identityRole.textContent = formatRoleLabel(role);

      const headerName = document.querySelector(
        ".profile-area .profile-name, .profile-name, .officer-name",
      );
      if (headerName) headerName.textContent = data.name;

      const activePhoto = selectedPhoto || originalPhoto;
      updateAvatar(data.name, activePhoto);
      updateHeaderAvatar(data.name, activePhoto, role ? formatRoleLabel(role) : "");
    }

    function loadProfile() {
      const account = getCurrentAccount();
      const user = account.user;

      const data = {
        name: user.name || user.fullName || user.nama || "",
        username: user.username || "",
        email: user.email || "",
      };

      fields.name.value = data.name;
      fields.username.value = data.username;
      fields.email.value = data.email;

      originalProfile = { ...data };
      selectedPhoto = null;

      loadPhoto(user);
      updateProfileDisplay(data, user.role);
    }

    // 09. EVENT SUBMIT, BATAL, PASSWORD & SINKRONISASI
    const originalSaveHTML = saveButton.innerHTML;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (isSaving || !validateProfile()) return;

      const passwordValidation = validatePassword();
      if (!passwordValidation.valid) return;

      const data = getProfileData();
      const profileChanged =
        !originalProfile ||
        data.name !== originalProfile.name ||
        data.username !== originalProfile.username ||
        data.email !== originalProfile.email;
      const photoChanged = Boolean(selectedPhoto);
      const passwordChanged = passwordValidation.requested;

      if (!profileChanged && !photoChanged && !passwordChanged) {
        showNotification("Tidak ada perubahan yang perlu disimpan.", "info");
        return;
      }

      try {
        isSaving = true;
        saveButton.disabled = true;
        saveButton.textContent = "Menyimpan...";
        if (cancelButton) cancelButton.disabled = true;
        if (photoButton) photoButton.disabled = true;

        if (passwordChanged) updatePassword();

        let savedActiveUser = null;
        if (profileChanged || photoChanged) {
          savedActiveUser = saveProfileAndPhoto(data, selectedPhoto);
        }
        if (photoChanged) originalPhoto = selectedPhoto;

        selectedPhoto = null;
        photoInput.value = "";
        updateProfileDisplay(data, savedActiveUser?.role || "");
        originalProfile = { ...data };
        clearPasswordFields();

        let message;
        if (passwordChanged && photoChanged && profileChanged) {
          message = "Profil, foto, dan kata sandi berhasil diperbarui.";
        } else if (passwordChanged && (photoChanged || profileChanged)) {
          message = "Profil dan kata sandi berhasil diperbarui.";
        } else if (passwordChanged) {
          message = "Kata sandi berhasil diperbarui.";
        } else if (photoChanged && profileChanged) {
          message = "Profil dan foto berhasil diperbarui.";
        } else if (photoChanged) {
          message = "Foto profil berhasil diperbarui.";
        } else {
          message = "Profil berhasil diperbarui.";
        }

        showNotification(message, "success");

        window.dispatchEvent(
          new CustomEvent("sipfas:profile-updated", {
            detail: { profile: data, photo: originalPhoto },
          }),
        );
        console.log("[SIPFAS] Perubahan profil & foto tersinkronisasi ke seluruh halaman.");
      } catch (error) {
        console.error("[SIPFAS] Gagal menyimpan perubahan:", error);
        showNotification(error.message || "Terjadi kesalahan saat menyimpan perubahan.", "error");
      } finally {
        isSaving = false;
        saveButton.disabled = false;
        saveButton.innerHTML = originalSaveHTML;
        if (cancelButton) cancelButton.disabled = false;
        if (photoButton) photoButton.disabled = false;
      }
    });

    if (cancelButton) {
      cancelButton.addEventListener("click", function () {
        if (isSaving) return;
        if (!confirm("Batalkan seluruh perubahan yang belum disimpan?")) return;

        fields.name.value = originalProfile?.name || "";
        fields.username.value = originalProfile?.username || "";
        fields.email.value = originalProfile?.email || "";
        clearPasswordFields();

        selectedPhoto = null;
        photoInput.value = "";
        updateAvatar(originalProfile?.name || "", originalPhoto);
        updateHeaderAvatar(originalProfile?.name || "", originalPhoto);
        showNotification("Perubahan yang belum disimpan telah dibatalkan.", "info");
      });
    }

    document.querySelectorAll(".toggle-password").forEach(function (button) {
      if (button.dataset.profilePasswordInitialized === "true") return;
      button.dataset.profilePasswordInitialized = "true";
      button.type = "button";

      const targetId = button.dataset.target;
      const input = targetId
        ? document.getElementById(targetId)
        : button.parentElement?.querySelector("input");
      if (!input) return;

      button.addEventListener("click", function () {
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        button.setAttribute("aria-pressed", String(visible));
        button.setAttribute(
          "aria-label",
          visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
        );
      });
    });

    [fields.name, fields.username, fields.email].forEach(function (input) {
      input.addEventListener("input", function () {
        feedback.textContent = "";
        feedback.className = "form-feedback";
        if (input === fields.name) {
          updateAvatar(input.value, selectedPhoto || originalPhoto);
        }
      });
    });

    window.addEventListener("storage", function (event) {
      if (
        event.key === CONFIG.usersKey ||
        event.key === CONFIG.activeUserKey ||
        (event.key && event.key.startsWith(CONFIG.photoPrefix))
      ) {
        try {
          loadProfile();
        } catch (error) {
          console.error("[SIPFAS] Gagal menyinkronkan profil:", error);
        }
      }
    });

    // 10. INISIALISASI AKHIR
    try {
      loadProfile();
      console.log("[SIPFAS] Profil Petugas berhasil diinisialisasi.");
    } catch (error) {
      console.error("[SIPFAS] Gagal memuat profil:", error);
      showNotification(error.message, "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProfile, { once: true });
  } else {
    initializeProfile();
  }
})();