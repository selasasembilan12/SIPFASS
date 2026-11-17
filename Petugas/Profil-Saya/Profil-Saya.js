"use strict";
/*
 * SIPFAS - PROFIL PETUGAS
 * Sinkronisasi nama, foto profil, dan data akun.
 * Password bersifat opsional.
 */
(function () {
    const CONFIG = {
        apiUrl: "../../api/petugas/PROFIL.PHP",
        maxPhotoSize: 1.5 * 1024 * 1024,
        allowedTypes: ["image/jpeg", "image/png", "image/webp"]
    };

    let isSaving = false;
    let selectedPhoto = null;
    let originalPhoto = null;
    let originalProfile = null;
    let currentUser = null;

    function initializeProfile() {
        const form = document.getElementById("profileForm");
        if (!form || form.dataset.profileInitialized === "true") return;

        const fields = {
            name: document.getElementById("fullName"),
            username: document.getElementById("username"),
            email: document.getElementById("email"),
            currentPassword: document.getElementById("currentPassword"),
            newPassword: document.getElementById("newPassword"),
            confirmPassword: document.getElementById("confirmPassword")
        };

        const avatar = document.querySelector(".large-avatar");
        const identityName = document.querySelector(".profile-identity h2");

        // Menghilangkan garis hijau tanpa mengubah tombol pensil atau foto.
        if (!document.getElementById("sipfas-remove-avatar-green-decoration")) {
            const avatarDecorationStyle = document.createElement("style");
            avatarDecorationStyle.id = "sipfas-remove-avatar-green-decoration";
            avatarDecorationStyle.textContent = `
                .large-avatar::after,
                #chooseProfilePhoto::after {
                    content: none !important;
                    display: none !important;
                    border: 0 !important;
                    box-shadow: none !important;
                }
            `;
            document.head.appendChild(avatarDecorationStyle);
        }

        const saveButton =
            document.getElementById("saveButton") ||
            form.querySelector(".save-button") ||
            form.querySelector('button[type="submit"]');

        const cancelButton =
            document.getElementById("cancelChanges") ||
            form.querySelector(".cancel-button");

        if (!fields.name || !fields.username || !fields.email || !saveButton) {
            console.error("[SIPFAS] Elemen profil tidak lengkap.");
            return;
        }

        form.dataset.profileInitialized = "true";

        // 01. NOTIFIKASI
        let feedback = document.getElementById("formFeedback");

        if (!feedback) {
            feedback = document.createElement("p");
            feedback.id = "formFeedback";
            feedback.className = "form-feedback";
            feedback.setAttribute("role", "status");
            form.appendChild(feedback);
        }

        function notify(message, type = "info") {
            feedback.textContent = message;
            feedback.className = "form-feedback " + type;
        }

        // 02. HELPER
        function normalize(value) {
            return String(value || "").trim().toLowerCase();
        }

        function initials(name) {
            return String(name || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part[0])
                .join("")
                .toUpperCase() || "PT";
        }

        function formatRole(role) {
            const value = normalize(role);

            if (value === "administrator" || value === "admin") {
                return "Administrator";
            }

            if (value === "petugas sarpras" || value === "petugas") {
                return "Petugas Sarpras";
            }

            return role || "Petugas Sarpras";
        }

        function getProfileData() {
            return {
                name: fields.name.value.trim(),
                username: fields.username.value.trim(),
                email: fields.email.value.trim().toLowerCase()
            };
        }

        function photoUrl(path) {
            if (!path) return "";

            const value = String(path).trim();

            if (/^(https?:|data:|blob:)/i.test(value)) {
                return value;
            }

            const root = new URL("../../", window.location.href);

            return new URL(
                value.replace(/^\/+/, ""),
                root
            ).href;
        }

        // 03. ELEMEN FOTO PROFIL
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
            avatar.style.position = "relative";

            photoButton.type = "button";
            photoButton.title = "Ubah foto profil";
            photoButton.setAttribute("aria-label", "Ubah foto profil");

            photoButton.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m14 5 5 5"/>
                    <path d="M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20z"/>
                </svg>
            `;

            Object.assign(photoButton.style, {
                position: "absolute",
                right: "-2px",
                bottom: "3px",
                width: "34px",
                height: "34px",
                padding: "7px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #ffffff",
                borderRadius: "50%",
                background: "#2864f0",
                color: "#ffffff",
                cursor: "pointer",
                zIndex: "5",
                boxShadow: "none",
                outline: "none"
            });

            const icon = photoButton.querySelector("svg");

            Object.assign(icon.style, {
                width: "18px",
                height: "18px",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round"
            });

            photoButton.addEventListener("click", () => {
                if (!isSaving) photoInput.click();
            });
        }

        // 04. RENDER FOTO PROFIL
        function updateAvatar(name, path) {
            if (!avatar) return;

            let image = avatar.querySelector(".profile-photo");
            let text = avatar.querySelector(".avatar-initials");

            if (!text) {
                text = document.createElement("span");
                text.className = "avatar-initials";
                avatar.prepend(text);
            }

            text.textContent = initials(name);

            if (path) {
                if (!image) {
                    image = document.createElement("img");
                    image.className = "profile-photo";
                    image.alt = "Foto profil petugas";
                    avatar.prepend(image);
                }

                image.onerror = function () {
                    image.remove();
                    text.hidden = false;
                };

                image.src = photoUrl(path);

                Object.assign(image.style, {
                    position: "absolute",
                    inset: "0",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "50%",
                    zIndex: "1"
                });

                text.hidden = true;
            } else {
                if (image) image.remove();
                text.hidden = false;
            }

            if (photoButton) {
                avatar.appendChild(photoButton);
            }
        }

        // 05. SINKRONISASI HEADER DAN IDENTITAS PROFIL
        function updateHeaderAvatar(name, path) {
            const headerAvatars = document.querySelectorAll(
                ".profile-area .profile-avatar, " +
                ".header-profile .profile-avatar, " +
                ".user-profile .profile-avatar, " +
                ".profile-avatar, " +
                "#profileAvatar, #userAvatar, #officerAvatar"
            );

            headerAvatars.forEach(header => {
                if (header === avatar) return;

                let image = header.querySelector(".profile-header-photo");
                let text = header.querySelector(".profile-header-initials");
                const icon = header.querySelector("svg");

                if (path) {
                    if (icon) icon.style.display = "none";
                    if (text) text.remove();

                    if (!image) {
                        image = document.createElement("img");
                        image.className = "profile-header-photo";
                        image.alt = "Foto profil";
                        header.appendChild(image);
                    }

                    image.onerror = function () {
                        image.remove();
                        if (icon) icon.style.display = "";
                    };

                    image.src = photoUrl(path);

                    Object.assign(image.style, {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                        display: "block"
                    });

                    header.style.overflow = "hidden";
                } else {
                    if (image) image.remove();

                    if (!text) {
                        text = document.createElement("span");
                        text.className = "profile-header-initials";
                        header.appendChild(text);
                    }

                    if (icon) icon.style.display = "none";

                    text.textContent = initials(name);

                    Object.assign(text.style, {
                        display: "flex",
                        width: "100%",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontWeight: "700"
                    });
                }
            });
        }

        // Satu sumber data untuk semua nama pada halaman.
        function synchronizeUser(user) {
            if (!user) return;

            currentUser = user;

            const name = String(user.nama_lengkap || "").trim();
            const role = formatRole(user.nama_peran);
            const photo = user.foto_profil || null;

            if (name) {
                fields.name.value = name;

                if (identityName) {
                    identityName.textContent = name;
                }

                // Nama pada bagian kanan header.
                const headerNames = document.querySelectorAll(
                    ".profile-area .profile-name, " +
                    ".profile-area .officer-name, " +
                    ".profile-name, " +
                    ".officer-name, " +
                    ".petugas-name, " +
                    "#officerName, " +
                    "#petugasName, " +
                    "#profileName, " +
                    "#userName, " +
                    "#headerUserName, " +
                    "[data-profile-name]"
                );

                headerNames.forEach(element => {
                    if (element !== identityName) {
                        element.textContent = name;
                    }
                });
            }

            // Perbarui peran tanpa mengubah elemen lainnya.
            document.querySelectorAll(
                ".profile-area .profile-role, " +
                ".profile-role, " +
                ".officer-role, " +
                "#officerRole, " +
                "#petugasRole, " +
                "#profileRole"
            ).forEach(element => {
                element.textContent = role;
            });

            // Perbarui foto profil.
            originalPhoto = photo;

            updateAvatar(name || fields.name.value, photo);
            updateHeaderAvatar(name || fields.name.value, photo);
        }

        // 06. KOMUNIKASI API
        async function requestApi(method, payload = null) {
            const options = {
                method,
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json"
                }
            };

            if (payload) {
                options.headers["Content-Type"] = "application/json";
                options.body = JSON.stringify(payload);
            }

            const response = await fetch(CONFIG.apiUrl, options);
            const raw = await response.text();

            let result;

            try {
                result = JSON.parse(raw);
            } catch {
                console.error("[SIPFAS] Respons PHP:", raw);

                throw new Error(
                    "Respons server bukan JSON. Periksa error log PHP."
                );
            }

            if (!response.ok || result.success !== true) {
                throw new Error(
                    result.message || "Permintaan gagal."
                );
            }

            return result;
        }

        // 07. MEMUAT DATA PROFIL
        async function loadProfile() {
            const result = await requestApi("GET");
            const user = result.user || result.data;

            if (!user) {
                throw new Error("Data profil tidak ditemukan.");
            }

            fields.username.value = user.nama_pengguna || "";
            fields.email.value = user.email || "";

            selectedPhoto = null;

            // Nama header dan identitas diperbarui bersamaan.
            synchronizeUser(user);

            originalProfile = getProfileData();

            if (identityName) {
                identityName.textContent = user.nama_lengkap || "";
            }

            console.log(
                "[SIPFAS] Profil berhasil dimuat:",
                user.nama_lengkap
            );
        }

        // 08. UNGGAH DAN PRATINJAU FOTO
        photoInput.addEventListener("change", function () {
            const file = this.files?.[0];

            if (!file) return;

            if (!CONFIG.allowedTypes.includes(file.type)) {
                notify(
                    "Format foto harus JPG, PNG, atau WEBP.",
                    "error"
                );

                this.value = "";
                return;
            }

            if (file.size > CONFIG.maxPhotoSize) {
                notify(
                    "Ukuran foto maksimal 1,5 MB.",
                    "error"
                );

                this.value = "";
                return;
            }

            const reader = new FileReader();

            reader.onload = function () {
                if (typeof reader.result !== "string") {
                    notify("Foto gagal dibaca.", "error");
                    return;
                }

                selectedPhoto = reader.result;

                updateAvatar(fields.name.value, selectedPhoto);
                updateHeaderAvatar(fields.name.value, selectedPhoto);

                notify(
                    "Foto berhasil dipilih. Klik Simpan Perubahan untuk menyimpan.",
                    "info"
                );
            };

            reader.onerror = function () {
                notify("Gagal membaca foto.", "error");
            };

            reader.readAsDataURL(file);
        });

        // 09. VALIDASI IDENTITAS
        function validateProfile() {
            const data = getProfileData();

            if (data.name.length < 3 || data.name.length > 100) {
                fields.name.focus();

                notify(
                    "Nama lengkap harus terdiri dari 3 sampai 100 karakter.",
                    "error"
                );

                return false;
            }

            if (!/^[A-Za-z0-9._-]{3,30}$/.test(data.username)) {
                fields.username.focus();

                notify(
                    "Username harus terdiri dari 3 sampai 30 karakter.",
                    "error"
                );

                return false;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                fields.email.focus();

                notify("Format email tidak valid.", "error");

                return false;
            }

            return true;
        }

        // 10. VALIDASI PASSWORD OPSIONAL
        function validatePassword() {
            const current = fields.currentPassword?.value || "";
            const next = fields.newPassword?.value || "";
            const confirm = fields.confirmPassword?.value || "";

            const requested = Boolean(current || next || confirm);

            if (!requested) {
                return {
                    valid: true,
                    requested: false
                };
            }

            if (!current || !next || !confirm) {
                notify(
                    "Lengkapi ketiga kolom kata sandi atau kosongkan semuanya.",
                    "error"
                );

                return {
                    valid: false,
                    requested: true
                };
            }

            if (
                next.length < 8 ||
                !/[A-Za-z]/.test(next) ||
                !/[0-9]/.test(next)
            ) {
                fields.newPassword.focus();

                notify(
                    "Kata sandi baru minimal 8 karakter dan mengandung huruf serta angka.",
                    "error"
                );

                return {
                    valid: false,
                    requested: true
                };
            }

            if (next === current) {
                fields.newPassword.focus();

                notify(
                    "Kata sandi baru harus berbeda dari kata sandi saat ini.",
                    "error"
                );

                return {
                    valid: false,
                    requested: true
                };
            }

            if (next !== confirm) {
                fields.confirmPassword.focus();

                notify(
                    "Konfirmasi kata sandi tidak cocok.",
                    "error"
                );

                return {
                    valid: false,
                    requested: true
                };
            }

            return {
                valid: true,
                requested: true
            };
        }

        function clearPasswordFields() {
            if (fields.currentPassword) {
                fields.currentPassword.value = "";
            }

            if (fields.newPassword) {
                fields.newPassword.value = "";
            }

            if (fields.confirmPassword) {
                fields.confirmPassword.value = "";
            }
        }

        // 11. BATALKAN PERUBAHAN
        if (cancelButton) {
            cancelButton.addEventListener("click", function () {
                if (isSaving || !originalProfile) return;

                fields.name.value = originalProfile.name;
                fields.username.value = originalProfile.username;
                fields.email.value = originalProfile.email;

                selectedPhoto = null;
                photoInput.value = "";

                clearPasswordFields();

                if (currentUser) {
                    synchronizeUser(currentUser);
                }

                notify(
                    "Perubahan yang belum disimpan dibatalkan.",
                    "info"
                );
            });
        }

        // 12. SIMPAN PERUBAHAN
        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (isSaving) return;
            if (!validateProfile()) return;

            const password = validatePassword();

            if (!password.valid) return;

            const data = getProfileData();

            const profileChanged =
                !originalProfile ||
                data.name !== originalProfile.name ||
                data.username !== originalProfile.username ||
                data.email !== originalProfile.email;

            const photoChanged = Boolean(selectedPhoto);

            if (
                !profileChanged &&
                !photoChanged &&
                !password.requested
            ) {
                notify(
                    "Tidak ada perubahan yang perlu disimpan.",
                    "info"
                );

                return;
            }

            const payload = {
                nama_lengkap: data.name,
                nama_pengguna: data.username,
                email: data.email,

                current_password: password.requested
                    ? fields.currentPassword.value
                    : "",

                new_password: password.requested
                    ? fields.newPassword.value
                    : "",

                foto_data_url: selectedPhoto
            };

            const originalButtonHTML = saveButton.innerHTML;

            try {
                isSaving = true;

                saveButton.disabled = true;
                saveButton.textContent = "Menyimpan...";

                if (cancelButton) {
                    cancelButton.disabled = true;
                }

                if (photoButton) {
                    photoButton.disabled = true;
                }

                const result = await requestApi("POST", payload);
                const user = result.user || result.data;

                if (!user) {
                    throw new Error(
                        "Server tidak mengembalikan profil terbaru."
                    );
                }

                // Sinkronisasi seluruh tampilan dari respons database.
                fields.username.value = user.nama_pengguna || "";
                fields.email.value = user.email || "";

                selectedPhoto = null;
                photoInput.value = "";

                synchronizeUser(user);

                originalProfile = getProfileData();

                clearPasswordFields();

                // Beritahu dashboard jika masih aktif.
                window.dispatchEvent(
                    new CustomEvent("sipfas:profile-updated", {
                        detail: { user }
                    })
                );

                notify(
                    result.message ||
                    (
                        password.requested
                            ? "Profil dan kata sandi berhasil diperbarui."
                            : "Profil berhasil diperbarui."
                    ),
                    "success"
                );

                console.log(
                    "[SIPFAS] Profil berhasil diperbarui:",
                    user.nama_lengkap
                );

            } catch (error) {
                console.error(
                    "[SIPFAS PROFILE ERROR]",
                    error
                );

                notify(
                    error.message || "Gagal menyimpan profil.",
                    "error"
                );

            } finally {
                isSaving = false;

                saveButton.disabled = false;
                saveButton.innerHTML = originalButtonHTML;

                if (cancelButton) {
                    cancelButton.disabled = false;
                }

                if (photoButton) {
                    photoButton.disabled = false;
                }
            }
        });

        // 13. TAMPILKAN / SEMBUNYIKAN PASSWORD
        document.querySelectorAll(".toggle-password").forEach(button => {
            if (
                button.dataset.profilePasswordInitialized === "true"
            ) {
                return;
            }

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

                button.setAttribute(
                    "aria-pressed",
                    String(visible)
                );

                button.setAttribute(
                    "aria-label",
                    visible
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                );
            });
        });

        // 14. PERUBAHAN NAMA SECARA LANGSUNG
        fields.name.addEventListener("input", function () {
            updateAvatar(
                fields.name.value,
                selectedPhoto || originalPhoto
            );
        });

        // 15. INISIALISASI
        loadProfile().catch(error => {
            console.error(
                "[SIPFAS LOAD PROFILE]",
                error
            );

            notify(
                error.message || "Gagal memuat profil.",
                "error"
            );
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeProfile,
            { once: true }
        );
    } else {
        initializeProfile();
    }
})();