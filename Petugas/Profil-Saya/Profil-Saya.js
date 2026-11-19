(function () {
    "use strict";

    // ======================================================
    // 01. KONFIGURASI SIPFAS
    // ======================================================

    const CONFIG = {
        profileUrl: "../../api/petugas/profil.php",
        updateUrl: "../../api/petugas/update-profil.php",
        logoutUrl: "../../api/auth/logout.php",
        loginUrl: "../../auth/Login.html",
        maxPhotoSize: 1.5 * 1024 * 1024,
        allowedTypes: [
            "image/jpeg",
            "image/png",
            "image/webp"
        ]
    };

    let isSaving = false;
    let selectedPhoto = null;
    let originalPhoto = null;
    let originalProfile = null;
    let notificationTimer = null;

    document.addEventListener(
        "DOMContentLoaded",
        initializeProfile
    );

    // ======================================================
    // 02. INISIALISASI PROFIL
    // ======================================================

    function initializeProfile() {
        const form = document.getElementById("profileForm");

        if (
            !form ||
            form.dataset.profileInitialized === "true"
        ) {
            return;
        }

        const fields = {
            name: document.getElementById("fullName"),
            username: document.getElementById("username"),
            email: document.getElementById("email"),
            role: document.getElementById("role"),
            currentPassword:
                document.getElementById("currentPassword"),
            newPassword:
                document.getElementById("newPassword"),
            confirmPassword:
                document.getElementById("confirmPassword")
        };

        const avatar = document.querySelector(".large-avatar");

        const identityName = document.querySelector(
            ".profile-identity h2"
        );

        const saveButton =
            document.getElementById("saveButton") ||
            form.querySelector(".save-button") ||
            form.querySelector('button[type="submit"]');

        const cancelButton =
            document.getElementById("cancelChanges") ||
            form.querySelector(".cancel-button");

        const sidebar = document.getElementById("sidebar");
        const menuToggle = document.getElementById("menuToggle");
        const pageOverlay = document.getElementById("pageOverlay");
        const logoutLink = document.getElementById("logoutLink");

        if (
            !fields.name ||
            !fields.username ||
            !fields.email ||
            !saveButton ||
            !avatar
        ) {
            console.error(
                "[SIPFAS] Elemen profil tidak lengkap."
            );
            return;
        }

        form.dataset.profileInitialized = "true";

        // ==================================================
        // 03. NOTIFIKASI TOAST
        // ==================================================

        let feedback = document.getElementById("sipfasToast");

        if (!feedback) {
            feedback = document.createElement("div");
            feedback.id = "sipfasToast";
            feedback.setAttribute("role", "status");
            feedback.setAttribute("aria-live", "polite");
            document.body.appendChild(feedback);
        }

        Object.assign(feedback.style, {
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: "999999",
            display: "none",
            alignItems: "center",
            gap: "12px",
            minWidth: "280px",
            maxWidth: "min(420px, calc(100vw - 48px))",
            padding: "15px 18px",
            borderRadius: "12px",
            background: "#ffffff",
            color: "#1f2937",
            fontSize: "14px",
            fontWeight: "600",
            lineHeight: "1.5",
            fontFamily: "Arial, sans-serif",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            borderLeft: "5px solid #2563eb",
            opacity: "0",
            transform: "translateY(-10px)",
            transition: "opacity 0.25s ease, transform 0.25s ease"
        });

        function showNotification(message, type = "info") {
            clearTimeout(notificationTimer);

            const appearance = {
                success: { icon: "✓", color: "#15803d" },
                error: { icon: "✕", color: "#dc2626" },
                warning: { icon: "!", color: "#d97706" },
                info: { icon: "ℹ", color: "#2563eb" }
            };

            const selected = appearance[type] || appearance.info;

            feedback.replaceChildren();

            const icon = document.createElement("span");
            icon.textContent = selected.icon;

            Object.assign(icon.style, {
                color: selected.color,
                fontSize: "20px",
                fontWeight: "700",
                flexShrink: "0"
            });

            const text = document.createElement("span");
            text.textContent = String(message || "");

            Object.assign(text.style, {
                flex: "1",
                overflowWrap: "anywhere"
            });

            feedback.append(icon, text);
            feedback.style.borderLeftColor = selected.color;
            feedback.style.display = "flex";

            requestAnimationFrame(function () {
                feedback.style.opacity = "1";
                feedback.style.transform = "translateY(0)";
            });

            notificationTimer = setTimeout(function () {
                feedback.style.opacity = "0";
                feedback.style.transform = "translateY(-10px)";

                setTimeout(function () {
                    if (feedback.style.opacity === "0") {
                        feedback.style.display = "none";
                    }
                }, 300);
            }, type === "success" ? 5000 : 4500);
        }

        // ==================================================
        // 04. FUNGSI BANTU
        // ==================================================

        function normalize(value) {
            return String(value ?? "")
                .trim()
                .toLowerCase();
        }

        function getInitials(name) {
            return String(name || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part.charAt(0))
                .join("")
                .toUpperCase() || "PT";
        }

        function getProfileData() {
            return {
                name: fields.name.value.trim(),
                username: fields.username.value.trim(),
                email: fields.email.value.trim().toLowerCase()
            };
        }

        function formatRole(role) {
            const value = normalize(role);

            if (
                value === "administrator" ||
                value === "admin"
            ) {
                return "Administrator";
            }

            if (
                value === "petugas sarpras" ||
                value === "petugas sarana prasarana" ||
                value === "petugas"
            ) {
                return "Petugas Sarana Prasarana";
            }

            return role || "Petugas";
        }

        // ==================================================
        // 05. URL FOTO PROFIL
        // ==================================================

        function photoUrl(path) {
            if (!path) return "";

            const value = String(path).trim();

            if (/^(https?:\/\/|data:|blob:)/i.test(value)) {
                return value;
            }

            return new URL(
                "../../" + value.replace(/^\/+/, ""),
                window.location.href
            ).href;
        }

        // ==================================================
        // 06. INPUT FOTO PROFIL
        // ==================================================

        let photoInput = document.getElementById(
            "profilePhotoInput"
        );

        if (!photoInput) {
            photoInput = document.createElement("input");
            photoInput.type = "file";
            photoInput.id = "profilePhotoInput";
            photoInput.accept = "image/jpeg,image/png,image/webp";
            photoInput.hidden = true;
            document.body.appendChild(photoInput);
        }

        // ==================================================
        // 07. TOMBOL EDIT FOTO
        // ==================================================

        let photoButton = document.getElementById(
            "chooseProfilePhoto"
        );

        if (!photoButton) {
            photoButton = document.createElement("button");
            photoButton.id = "chooseProfilePhoto";
            avatar.appendChild(photoButton);
        }

        if (photoButton.parentElement !== avatar) {
            avatar.appendChild(photoButton);
        }

        photoButton.type = "button";
        photoButton.title = "Ubah foto profil";

        photoButton.setAttribute(
            "aria-label",
            "Ubah foto profil"
        );

        const oldGreenButton = avatar.querySelector(
            ".verified-mark"
        );

        if (oldGreenButton) {
            oldGreenButton.remove();
        }

        photoButton.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 5.5l4 4"></path>
                <path d="M4 20l1-4 10.5-10.5a2.12 2.12 0 0 1 3 3L8 19z"></path>
                <path d="M4.8 19.2h2.4"></path>
            </svg>
        `;

        Object.assign(photoButton.style, {
            position: "absolute",
            right: "-2px",
            bottom: "3px",
            width: "28px",
            height: "28px",
            padding: "5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #ffffff",
            borderRadius: "50%",
            background: "#2864f0",
            color: "#ffffff",
            cursor: "pointer",
            zIndex: "5"
        });

        avatar.style.position = "relative";

        const uploadIcon = photoButton.querySelector("svg");

        if (uploadIcon) {
            Object.assign(uploadIcon.style, {
                width: "15px",
                height: "15px",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round"
            });
        }

        photoButton.addEventListener("click", function () {
            if (!isSaving) {
                photoInput.click();
            }
        });

        // ==================================================
        // 08. MENAMPILKAN AVATAR UTAMA
        // ==================================================

        function updateAvatar(name, photo = null) {
            let initials = avatar.querySelector(
                ".avatar-initials"
            );

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

                image.onerror = function () {
                    image.remove();
                    initials.hidden = false;
                };

                image.onload = function () {
                    initials.hidden = true;
                };

                image.src = photoUrl(photo);

                Object.assign(image.style, {
                    position: "absolute",
                    inset: "0",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "50%",
                    zIndex: "1"
                });

                initials.hidden = true;
            } else {
                if (image) {
                    image.remove();
                }

                initials.hidden = false;
            }

            if (photoButton.parentElement !== avatar) {
                avatar.appendChild(photoButton);
            }

            photoButton.style.zIndex = "5";
        }

        // ==================================================
        // 09. MENAMPILKAN AVATAR HEADER
        // ==================================================

        function updateHeaderAvatar(name, photo = null) {
            const headerAvatars = document.querySelectorAll(
                ".profile-area .profile-avatar, " +
                ".header-profile .profile-avatar, " +
                ".user-profile .profile-avatar, " +
                ".profile-avatar, " +
                "#profileAvatar, " +
                "#userAvatar, " +
                "#officerAvatar"
            );

            headerAvatars.forEach(headerAvatar => {
                if (headerAvatar === avatar) return;

                let image = headerAvatar.querySelector(
                    ".profile-header-photo"
                );

                let initials = headerAvatar.querySelector(
                    ".profile-header-initials"
                );

                const defaultIcon = headerAvatar.querySelector("svg");

                if (photo) {
                    if (defaultIcon) {
                        defaultIcon.style.display = "none";
                    }

                    if (initials) {
                        initials.remove();
                    }

                    if (!image) {
                        image = document.createElement("img");
                        image.className = "profile-header-photo";
                        image.alt = "Foto profil petugas";
                        headerAvatar.appendChild(image);
                    }

                    image.onerror = function () {
                        image.remove();

                        if (defaultIcon) {
                            defaultIcon.style.display = "";
                        }
                    };

                    image.src = photoUrl(photo);

                    Object.assign(image.style, {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                        display: "block"
                    });

                    headerAvatar.style.overflow = "hidden";
                } else {
                    if (image) {
                        image.remove();
                    }

                    if (defaultIcon) {
                        defaultIcon.style.display = "none";
                    }

                    if (!initials) {
                        initials = document.createElement("span");
                        initials.className = "profile-header-initials";
                        headerAvatar.appendChild(initials);
                    }

                    initials.textContent = getInitials(name);

                    Object.assign(initials.style, {
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

        // ==================================================
        // 10. MENYINKRONKAN TAMPILAN PROFIL
        // ==================================================

        function updateProfileDisplay(user) {
            const name = String(
                user.nama_lengkap ||
                user.nama_pengguna ||
                ""
            ).trim();

            const username = user.nama_pengguna || "";
            const email = user.email || "";
            const role = formatRole(user.nama_peran);
            const photo = user.foto_profil || "";

            fields.name.value = name;
            fields.username.value = username;
            fields.email.value = email;

            if (fields.role) {
                fields.role.value = role;
            }

            if (identityName) {
                identityName.textContent = name;
            }

            const roleChip = document.querySelector(".role-chip");

            if (roleChip) {
                roleChip.textContent = role;
            }

            document.querySelectorAll(
                ".profile-area .profile-name, " +
                ".profile-area .officer-name, " +
                ".profile-name, " +
                ".officer-name, " +
                ".petugas-name, " +
                "#officerName, " +
                "#petugasName, " +
                "#profileName, " +
                "#userName, " +
                "[data-profile-name]"
            ).forEach(element => {
                if (element !== identityName) {
                    element.textContent = name;
                }
            });

            document.querySelectorAll(
                ".profile-role, " +
                ".officer-role, " +
                "#officerRole, " +
                "#petugasRole, " +
                "#profileRole, " +
                "[data-profile-role]"
            ).forEach(element => {
                element.textContent = role;
            });

            originalPhoto = photo;

            updateAvatar(name, photo);
            updateHeaderAvatar(name, photo);
        }

        // ==================================================
        // 11. REQUEST API
        // ==================================================

        async function requestApi(url, method, payload = null) {
            const options = {
                method,
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json"
                }
            };

            if (payload !== null) {
                options.headers["Content-Type"] = "application/json";
                options.body = JSON.stringify(payload);
            }

            const response = await fetch(url, options);
            const raw = await response.text();

            let result;

            try {
                result = JSON.parse(raw);
            } catch (error) {
                console.error("[SIPFAS] Respons PHP:", raw);
                throw new Error(
                    "Respons server bukan JSON. Periksa endpoint PHP."
                );
            }

            if (response.status === 401) {
                window.location.replace(CONFIG.loginUrl);
                throw new Error("Sesi login telah berakhir.");
            }

            if (!response.ok || result.success !== true) {
                throw new Error(
                    result.message || "Permintaan gagal."
                );
            }

            return result;
        }

        // ==================================================
        // 12. MEMUAT PROFIL DARI DATABASE
        // ==================================================

        async function loadProfile() {
            const result = await requestApi(
                CONFIG.profileUrl,
                "GET"
            );

            const user = result.user || result.data;

            if (!user || !user.id_pengguna) {
                throw new Error("Data pengguna tidak ditemukan.");
            }

            selectedPhoto = null;
            photoInput.value = "";

            updateProfileDisplay(user);
            originalProfile = getProfileData();

            console.log(
                "[SIPFAS] Profil berhasil dimuat:",
                user.nama_lengkap
            );
        }

        // ==================================================
        // 13. MEMILIH DAN MEMVALIDASI FOTO
        // ==================================================

        photoInput.addEventListener("change", function (event) {
            const file = event.target.files?.[0];

            if (!file) return;

            if (!CONFIG.allowedTypes.includes(file.type)) {
                showNotification(
                    "Format foto harus JPG, PNG, atau WEBP.",
                    "error"
                );

                photoInput.value = "";
                return;
            }

            if (file.size > CONFIG.maxPhotoSize) {
                showNotification(
                    "Ukuran foto maksimal 1,5 MB.",
                    "error"
                );

                photoInput.value = "";
                return;
            }

            const reader = new FileReader();

            reader.onload = function () {
                if (typeof reader.result !== "string") {
                    showNotification(
                        "Foto gagal dibaca.",
                        "error"
                    );
                    return;
                }

                selectedPhoto = reader.result;

                updateAvatar(
                    fields.name.value,
                    selectedPhoto
                );

                updateHeaderAvatar(
                    fields.name.value,
                    selectedPhoto
                );

                showNotification(
                    "Foto berhasil dipilih. Klik Simpan Perubahan untuk menyimpan.",
                    "info"
                );
            };

            reader.onerror = function () {
                showNotification(
                    "Terjadi kesalahan saat membaca foto.",
                    "error"
                );
            };

            reader.readAsDataURL(file);
        });

        // ==================================================
        // 14. VALIDASI PROFIL BERDASARKAN PERUBAHAN
        // ==================================================

        function validateProfile(data, original) {
            if (data.name !== original.name) {
                if (
                    data.name.length < 3 ||
                    data.name.length > 150
                ) {
                    fields.name.focus();

                    showNotification(
                        "Nama lengkap harus terdiri dari 3 sampai 150 karakter.",
                        "error"
                    );

                    return false;
                }
            }

            if (data.username !== original.username) {
                if (
                    !/^[A-Za-z0-9._-]{3,50}$/.test(data.username)
                ) {
                    fields.username.focus();

                    showNotification(
                        "Username harus terdiri dari 3 sampai 50 karakter.",
                        "error"
                    );

                    return false;
                }
            }

            if (data.email !== original.email) {
                if (
                    data.email.length > 150 ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
                ) {
                    fields.email.focus();

                    showNotification(
                        "Format email tidak valid.",
                        "error"
                    );

                    return false;
                }
            }

            return true;
        }

        // ==================================================
        // 15. VALIDASI PASSWORD OPSIONAL
        // ==================================================

        function validatePassword() {
            const current =
                fields.currentPassword?.value || "";

            const next =
                fields.newPassword?.value || "";

            const confirmation =
                fields.confirmPassword?.value || "";

            const requested = Boolean(
                current || next || confirmation
            );

            if (!requested) {
                return {
                    valid: true,
                    requested: false
                };
            }

            if (!current || !next || !confirmation) {
                showNotification(
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
                next.length > 72 ||
                !/[A-Za-z]/.test(next) ||
                !/[0-9]/.test(next)
            ) {
                fields.newPassword.focus();

                showNotification(
                    "Kata sandi baru minimal 8 karakter dan harus mengandung huruf serta angka.",
                    "error"
                );

                return {
                    valid: false,
                    requested: true
                };
            }

            if (next === current) {
                fields.newPassword.focus();

                showNotification(
                    "Kata sandi baru harus berbeda dari kata sandi saat ini.",
                    "error"
                );

                return {
                    valid: false,
                    requested: true
                };
            }

            if (next !== confirmation) {
                fields.confirmPassword.focus();

                showNotification(
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

        // ==================================================
        // 16. MENGOSONGKAN INPUT PASSWORD
        // ==================================================

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

        // ==================================================
        // 17. TOMBOL TAMPILKAN PASSWORD
        // ==================================================

        document.querySelectorAll(
            ".toggle-password"
        ).forEach(button => {
            if (button.dataset.initialized === "true") {
                return;
            }

            button.dataset.initialized = "true";
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
                    "aria-label",
                    visible
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                );
            });
        });

        // ==================================================
        // 18. UPDATE INISIAL SAAT NAMA DIUBAH
        // ==================================================

        fields.name.addEventListener("input", function () {
            if (!selectedPhoto) {
                updateAvatar(
                    fields.name.value,
                    originalPhoto
                );
            }
        });

        // ==================================================
        // 19. MENYIMPAN PERUBAHAN PROFIL
        // ==================================================

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (isSaving) return;

            if (!originalProfile) {
                showNotification(
                    "Data profil belum selesai dimuat.",
                    "error"
                );
                return;
            }

            const data = getProfileData();

            // Menganggap kolom kosong sebagai tidak ada perubahan.
            const effectiveData = {
                name: data.name || originalProfile.name,
                username: data.username || originalProfile.username,
                email: data.email || originalProfile.email
            };

            if (
                !validateProfile(
                    effectiveData,
                    originalProfile
                )
            ) {
                return;
            }

            const passwordValidation = validatePassword();

            if (!passwordValidation.valid) {
                return;
            }

            const profileChanged =
                effectiveData.name !== originalProfile.name ||
                effectiveData.username !== originalProfile.username ||
                effectiveData.email !== originalProfile.email;

            const photoChanged = Boolean(selectedPhoto);

            const passwordChanged =
                passwordValidation.requested;

            if (
                !profileChanged &&
                !photoChanged &&
                !passwordChanged
            ) {
                showNotification(
                    "Tidak ada perubahan yang perlu disimpan.",
                    "info"
                );
                return;
            }

            // Payload hanya memuat perubahan yang diminta.
            const payload = {};

            if (
                effectiveData.name !== originalProfile.name
            ) {
                payload.nama_lengkap = effectiveData.name;
            }

            if (
                effectiveData.username !== originalProfile.username
            ) {
                payload.nama_pengguna = effectiveData.username;
            }

            if (
                effectiveData.email !== originalProfile.email
            ) {
                payload.email = effectiveData.email;
            }

            if (photoChanged) {
                payload.foto_data_url = selectedPhoto;
            }

            if (passwordChanged) {
                payload.current_password =
                    fields.currentPassword.value;

                payload.new_password =
                    fields.newPassword.value;
            }

            const originalButtonHTML = saveButton.innerHTML;

            try {
                isSaving = true;

                saveButton.disabled = true;
                saveButton.textContent = "Menyimpan...";

                photoButton.disabled = true;

                if (cancelButton) {
                    cancelButton.disabled = true;
                }

                // POST diarahkan ke update-profil.php.
                const result = await requestApi(
                    CONFIG.updateUrl,
                    "POST",
                    payload
                );

                const user = result.user || result.data;

                if (!user || !user.id_pengguna) {
                    throw new Error(
                        "Server tidak mengembalikan profil terbaru."
                    );
                }

                // Simpan nilai profil lama sebelum memperbarui tampilan.
                const previousProfile = { ...originalProfile };

                // Memperbarui tampilan dari hasil database.
                updateProfileDisplay(user);

                originalProfile = getProfileData();

                selectedPhoto = null;
                photoInput.value = "";

                clearPasswordFields();

                // Memberitahukan halaman yang mendengarkan event.
                window.dispatchEvent(
                    new CustomEvent("sipfas:profile-updated", {
                        detail: {
                            user: user,
                            photo: user.foto_profil || ""
                        }
                    })
                );

                // Susun notifikasi berdasarkan perubahan yang berhasil disimpan.
                const changedItems = [];

                if (effectiveData.name !== previousProfile.name) {
                    changedItems.push("Nama lengkap");
                }

                if (effectiveData.username !== previousProfile.username) {
                    changedItems.push("Username");
                }

                if (effectiveData.email !== previousProfile.email) {
                    changedItems.push("Email");
                }

                if (photoChanged) {
                    changedItems.push("Foto profil");
                }

                if (passwordChanged) {
                    changedItems.push("Kata sandi");
                }

                const successMessage = changedItems.length === 1
                    ? changedItems[0] + " berhasil diperbarui."
                    : changedItems.join(", ") + " berhasil diperbarui.";

                showNotification(successMessage, "success");

                console.log(
                    "[SIPFAS] Profil berhasil diperbarui:",
                    user.nama_lengkap
                );

            } catch (error) {
                console.error(
                    "[SIPFAS] Gagal menyimpan profil:",
                    error
                );

                showNotification(
                    error.message || "Gagal menyimpan perubahan.",
                    "error"
                );

            } finally {
                isSaving = false;

                saveButton.disabled = false;
                saveButton.innerHTML = originalButtonHTML;

                photoButton.disabled = false;

                if (cancelButton) {
                    cancelButton.disabled = false;
                }
            }
        });

        // ==================================================
        // 20. MEMBATALKAN PERUBAHAN
        // ==================================================

        cancelButton?.addEventListener(
            "click",
            function (event) {
                event.preventDefault();

                if (isSaving) return;

                if (
                    !window.confirm(
                        "Batalkan seluruh perubahan profil?"
                    )
                ) {
                    return;
                }

                if (originalProfile) {
                    fields.name.value = originalProfile.name;
                    fields.username.value = originalProfile.username;
                    fields.email.value = originalProfile.email;
                }

                selectedPhoto = null;
                photoInput.value = "";

                clearPasswordFields();

                updateAvatar(
                    fields.name.value,
                    originalPhoto
                );

                updateHeaderAvatar(
                    fields.name.value,
                    originalPhoto
                );

                showNotification(
                    "Perubahan berhasil dibatalkan.",
                    "info"
                );
            }
        );

        // ==================================================
        // 21. PENGATURAN SIDEBAR
        // ==================================================

        function setSidebar(open) {
            sidebar?.classList.toggle("open", open);

            pageOverlay?.classList.toggle("show", open);
            pageOverlay?.classList.toggle("active", open);

            menuToggle?.setAttribute(
                "aria-expanded",
                String(open)
            );
        }

        menuToggle?.addEventListener("click", function () {
            setSidebar(
                !sidebar?.classList.contains("open")
            );
        });

        pageOverlay?.addEventListener("click", function () {
            setSidebar(false);
        });

        document.querySelectorAll(
            ".nav-link"
        ).forEach(link => {
            link.addEventListener("click", function () {
                setSidebar(false);
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                setSidebar(false);
            }
        });

        // ==================================================
        // 22. LOGOUT
        // ==================================================

        logoutLink?.addEventListener(
            "click",
            async function (event) {
                event.preventDefault();

                if (
                    !window.confirm(
                        "Apakah Anda yakin ingin keluar dari SIPFAS?"
                    )
                ) {
                    return;
                }

                try {
                    const response = await fetch(
                        CONFIG.logoutUrl,
                        {
                            method: "POST",
                            credentials: "same-origin",
                            cache: "no-store",
                            headers: {
                                Accept: "application/json"
                            }
                        }
                    );

                    const result = await response.json();

                    if (
                        !response.ok ||
                        result.success !== true
                    ) {
                        throw new Error(
                            result.message || "Logout gagal."
                        );
                    }

                    window.location.replace(
                        CONFIG.loginUrl
                    );

                } catch (error) {
                    console.error(
                        "[SIPFAS LOGOUT ERROR]",
                        error
                    );

                    showNotification(
                        error.message || "Gagal keluar dari sistem.",
                        "error"
                    );
                }
            }
        );

        // ==================================================
        // 23. MEMUAT PROFIL SAAT HALAMAN DIBUKA
        // ==================================================

        loadProfile().catch(error => {
            console.error(
                "[SIPFAS] Gagal memuat profil:",
                error
            );

            showNotification(
                error.message || "Gagal memuat profil pengguna.",
                "error"
            );
        });
    }
})();