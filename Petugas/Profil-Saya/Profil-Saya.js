
(function () {
    "use strict";

    const CONFIG = {
        apiUrl: "../../api/petugas/profil.php",
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

    document.addEventListener("DOMContentLoaded", initializeProfile);

    function initializeProfile() {
        const form = document.getElementById("profileForm");

        if (!form || form.dataset.profileInitialized === "true") {
            return;
        }

        const fields = {
            name: document.getElementById("fullName"),
            username: document.getElementById("username"),
            email: document.getElementById("email"),
            role: document.getElementById("role"),
            currentPassword: document.getElementById("currentPassword"),
            newPassword: document.getElementById("newPassword"),
            confirmPassword: document.getElementById("confirmPassword")
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
            console.error("[SIPFAS] Elemen profil tidak lengkap.");
            return;
        }

        form.dataset.profileInitialized = "true";

        // Menyiapkan notifikasi.
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

            if (type === "success") {
                notificationTimer = setTimeout(() => {
                    feedback.textContent = "";
                    feedback.className = "form-feedback";
                }, 5000);
            }
        }

        // Menormalkan teks.
        function normalize(value) {
            return String(value ?? "").trim().toLowerCase();
        }

        // Membuat inisial nama.
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

        // Mengambil data profil dari formulir.
        function getProfileData() {
            return {
                name: fields.name.value.trim(),
                username: fields.username.value.trim(),
                email: fields.email.value.trim().toLowerCase()
            };
        }

        // Mengubah label peran.
        function formatRole(role) {
            const value = normalize(role);

            if (value === "administrator" || value === "admin") {
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

        // Mengubah alamat foto database menjadi URL browser.
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

        // Menyiapkan input unggah foto.
        let photoInput = document.getElementById("profilePhotoInput");

        if (!photoInput) {
            photoInput = document.createElement("input");
            photoInput.type = "file";
            photoInput.id = "profilePhotoInput";
            photoInput.accept = "image/jpeg,image/png,image/webp";
            photoInput.hidden = true;
            document.body.appendChild(photoInput);
        }

        // Membuat tombol unggah tepat pada posisi awal di avatar.
        let photoButton = document.getElementById("chooseProfilePhoto");

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
        photoButton.setAttribute("aria-label", "Ubah foto profil");

        // Mengganti tombol hijau dengan tombol unggah foto.
        const oldGreenButton = avatar.querySelector(".verified-mark");

        if (oldGreenButton) {
            oldGreenButton.remove();
        }

        // Mengatur tampilan tombol unggah foto pada posisi awal.
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

        // Membuka pemilih foto.
        photoButton.addEventListener("click", function () {
            if (!isSaving) {
                photoInput.click();
            }
        });

        // Menampilkan foto pada avatar utama.
        function updateAvatar(name, photo = null) {
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
                if (image) image.remove();
                initials.hidden = false;
            }

            // Memastikan tombol unggah tetap di atas foto.
            if (photoButton.parentElement !== avatar) {
                avatar.appendChild(photoButton);
            }

            photoButton.style.zIndex = "5";
        }

        // Menampilkan foto pada avatar header.
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

                    if (initials) initials.remove();

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
                    if (image) image.remove();

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

        // Menyamakan identitas profil.
        function updateProfileDisplay(user) {
            const name = String(
                user.nama_lengkap || user.nama_pengguna || ""
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

        // Mengambil data dari PHP.
        async function requestApi(method, payload = null) {
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

            const response = await fetch(CONFIG.apiUrl, options);

            const raw = await response.text();

            let result;

            try {
                result = JSON.parse(raw);
            } catch {
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

        // Memuat profil dari database.
        async function loadProfile() {
            const result = await requestApi("GET");

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

        // Memeriksa file foto.
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
                    showNotification("Foto gagal dibaca.", "error");
                    return;
                }

                selectedPhoto = reader.result;

                updateAvatar(fields.name.value, selectedPhoto);

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

        // Memvalidasi data profil.
        function validateProfile() {
            const data = getProfileData();

            if (data.name.length < 3 || data.name.length > 100) {
                fields.name.focus();

                showNotification(
                    "Nama lengkap harus terdiri dari 3 sampai 100 karakter.",
                    "error"
                );

                return false;
            }

            if (!/^[A-Za-z0-9._-]{3,30}$/.test(data.username)) {
                fields.username.focus();

                showNotification(
                    "Username harus terdiri dari 3 sampai 30 karakter.",
                    "error"
                );

                return false;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                fields.email.focus();

                showNotification(
                    "Format email tidak valid.",
                    "error"
                );

                return false;
            }

            return true;
        }

        // Memvalidasi perubahan kata sandi secara opsional.
        function validatePassword() {
            const current = fields.currentPassword?.value || "";
            const next = fields.newPassword?.value || "";
            const confirmation = fields.confirmPassword?.value || "";

            const requested = Boolean(current || next || confirmation);

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

        // Mengosongkan kolom kata sandi.
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

        // Mengatur fitur tampilkan kata sandi.
        document.querySelectorAll(".toggle-password").forEach(button => {
            if (button.dataset.initialized === "true") return;

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

        // Menampilkan perubahan inisial saat nama diedit.
        fields.name.addEventListener("input", function () {
            if (!selectedPhoto) {
                updateAvatar(fields.name.value, originalPhoto);
            }
        });

        // Menyimpan profil, foto, dan kata sandi.
        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (isSaving) return;

            if (!validateProfile()) return;

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

            const payload = {
                nama_lengkap: data.name,
                nama_pengguna: data.username,
                email: data.email,
                current_password: passwordChanged
                    ? fields.currentPassword.value
                    : "",
                new_password: passwordChanged
                    ? fields.newPassword.value
                    : "",
                foto_data_url: selectedPhoto || null
            };

            const originalButtonHTML = saveButton.innerHTML;

            try {
                isSaving = true;

                saveButton.disabled = true;
                saveButton.textContent = "Menyimpan...";

                photoButton.disabled = true;

                if (cancelButton) {
                    cancelButton.disabled = true;
                }

                const result = await requestApi("POST", payload);

                const user = result.user || result.data;

                if (!user || !user.id_pengguna) {
                    throw new Error(
                        "Server tidak mengembalikan profil terbaru."
                    );
                }

                // Menggunakan data terbaru dari database.
                updateProfileDisplay(user);

                originalProfile = getProfileData();

                selectedPhoto = null;
                photoInput.value = "";

                clearPasswordFields();

                // Menyinkronkan profil ke halaman lain.
                window.dispatchEvent(
                    new CustomEvent("sipfas:profile-updated", {
                        detail: {
                            user: user,
                            photo: user.foto_profil || ""
                        }
                    })
                );

                let message;

                if (passwordChanged && photoChanged && profileChanged) {
                    message = "Profil, foto, dan kata sandi berhasil diperbarui.";
                } else if (passwordChanged) {
                    message = "Profil dan kata sandi berhasil diperbarui.";
                } else if (photoChanged && profileChanged) {
                    message = "Profil dan foto berhasil diperbarui.";
                } else if (photoChanged) {
                    message = "Foto profil berhasil diperbarui.";
                } else {
                    message = "Profil berhasil diperbarui.";
                }

                showNotification(
                    result.message || message,
                    "success"
                );

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

        // Mengembalikan formulir ke data terakhir dari database.
        cancelButton?.addEventListener("click", function (event) {
            event.preventDefault();

            if (isSaving) return;

            if (!window.confirm(
                "Batalkan seluruh perubahan profil?"
            )) {
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

            updateAvatar(fields.name.value, originalPhoto);

            updateHeaderAvatar(
                fields.name.value,
                originalPhoto
            );

            showNotification(
                "Perubahan berhasil dibatalkan.",
                "info"
            );
        });

        // Mengatur sidebar.
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

        document.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener("click", function () {
                setSidebar(false);
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                setSidebar(false);
            }
        });

        // Mengakhiri sesi pengguna.
        logoutLink?.addEventListener("click", async function (event) {
            event.preventDefault();

            if (!window.confirm(
                "Apakah Anda yakin ingin keluar dari SIPFAS?"
            )) {
                return;
            }

            try {
                const response = await fetch(CONFIG.logoutUrl, {
                    method: "POST",
                    credentials: "same-origin",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json"
                    }
                });

                const result = await response.json();

                if (!response.ok || result.success !== true) {
                    throw new Error(
                        result.message || "Logout gagal."
                    );
                }

                window.location.replace(CONFIG.loginUrl);

            } catch (error) {
                console.error("[SIPFAS LOGOUT ERROR]", error);

                showNotification(
                    error.message || "Gagal keluar dari sistem.",
                    "error"
                );
            }
        });

        // Memuat profil saat halaman dibuka.
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
