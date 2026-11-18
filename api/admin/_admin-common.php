
<?php
// Mengaktifkan strict typing agar PHP menerapkan pemeriksaan tipe data
// sesuai dengan tipe yang telah ditentukan pada deklarasi fungsi.
declare(strict_types=1);

/**
 * SIPFAS - ADMIN API COMMON
 * Helper bersama untuk seluruh endpoint Administrator.
 */

// Memanggil file bootstrap yang berisi konfigurasi utama aplikasi,
// koneksi database, pengaturan session, dan kebutuhan dasar SIPFAS.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// Memanggil file pemeriksaan hak akses untuk memastikan
// setiap permintaan API dijalankan sesuai dengan peran pengguna.
require_once dirname(__DIR__, 2) . '/config/role-check.php';

// Mengatur format respons API agar selalu menggunakan JSON
// dengan karakter UTF-8.
header('Content-Type: application/json; charset=utf-8');

// Mencegah respons API disimpan dalam cache browser
// agar data yang diterima selalu berasal dari server.
header('Cache-Control: no-store, no-cache, must-revalidate');

// Memastikan hanya pengguna dengan peran Administrator
// yang dapat mengakses seluruh endpoint API Administrator.
sipfas_require_role([SIPFAS_ROLE_ADMIN]);

// Fungsi untuk mengirimkan respons JSON kepada pengguna.
// Parameter payload berisi data respons, sedangkan status
// menentukan kode HTTP yang dikirimkan oleh server.
function admin_json(array $payload, int $status = 200): never
{
    // Mengatur kode status HTTP sesuai hasil pemrosesan API.
    http_response_code($status);

    // Mengubah data array menjadi format JSON
    // dengan tetap mempertahankan karakter Unicode dan garis miring.
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    // Menghentikan eksekusi program setelah respons dikirimkan.
    exit;
}

// Fungsi untuk mengirimkan respons ketika proses API berhasil.
// Parameter message berisi pesan informasi,
// data berisi hasil proses, dan status menentukan kode HTTP.
function admin_ok(string $message, $data = null, int $status = 200): never
{
    // Mengirimkan respons JSON dengan status berhasil,
    // pesan keberhasilan, dan data hasil proses.
    admin_json(['success' => true, 'message' => $message, 'data' => $data], $status);
}

// Fungsi untuk mengirimkan respons ketika terjadi kesalahan
// atau permintaan tidak memenuhi ketentuan API.
// Parameter errors dapat digunakan untuk menyertakan detail kesalahan.
function admin_fail(string $message, int $status = 400, $errors = null): never
{
    // Mengirimkan respons JSON dengan status gagal,
    // pesan kesalahan, data kosong, dan informasi kesalahan tambahan.
    admin_json(['success' => false, 'message' => $message, 'data' => null, 'errors' => $errors], $status);
}

// Fungsi untuk mengambil data input yang dikirimkan pengguna.
// Fungsi ini mendukung format JSON maupun form POST.
function admin_input(): array
{
    // Membaca data mentah yang dikirimkan melalui HTTP request body.
    $raw = file_get_contents('php://input');

    // Mengubah data JSON menjadi array PHP.
    $json = json_decode($raw ?: '', true);

    // Jika hasil JSON berbentuk array, data tersebut digunakan.
    // Jika tidak, sistem mengambil data dari variabel $_POST.
    return is_array($json) ? $json : $_POST;
}

// Fungsi untuk memeriksa metode HTTP yang digunakan dalam permintaan API.
// Parameter allowed berisi daftar metode HTTP yang diperbolehkan.
function admin_method(string ...$allowed): string
{
    // Mengambil metode HTTP dari permintaan yang diterima server
    // dan mengubahnya menjadi huruf kapital.
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    // Memeriksa apakah metode HTTP termasuk dalam daftar yang diizinkan.
    // Jika tidak sesuai, sistem mengirimkan respons HTTP 405.
    if (!in_array($method, $allowed, true)) admin_fail('Metode request tidak diizinkan.', 405);

    // Mengembalikan metode HTTP yang telah diperiksa.
    return $method;
}

// Fungsi untuk mengambil ID pengguna yang sedang login.
// Data pengguna diperoleh dari session SIPFAS.
function admin_user_id(): int
{
    // Mengambil informasi pengguna yang tersimpan pada session.
    $user = sipfas_session_user();

    // Mengembalikan ID pengguna dalam bentuk integer.
    // Jika ID tidak tersedia, nilai yang dikembalikan adalah 0.
    return (int)($user['id_pengguna'] ?? 0);
}

// Fungsi untuk mengambil dan memvalidasi ID data.
// Parameter input berisi data permintaan,
// sedangkan key menentukan nama parameter ID yang dicari.
function admin_id(array $input, string $key = 'id'): int
{
    // Mengambil ID dari input atau parameter URL,
    // kemudian memvalidasi apakah nilainya merupakan bilangan integer.
    $id = filter_var($input[$key] ?? $_GET[$key] ?? null, FILTER_VALIDATE_INT);

    // Memastikan ID tersedia dan memiliki nilai lebih dari 0.
    // Jika tidak valid, sistem mengirimkan respons HTTP 422.
    if (!$id || $id < 1) admin_fail('ID data tidak valid.', 422);

    // Mengembalikan ID yang telah divalidasi dalam bentuk integer.
    return (int)$id;
}

// Fungsi untuk mengambil dan memvalidasi input teks.
// Parameter key menentukan nama input,
// max menentukan batas maksimal karakter,
// dan required menentukan apakah input wajib diisi.
function admin_text(array $input, string $key, int $max, bool $required = true): ?string
{
    // Mengambil nilai input berdasarkan nama kolom,
    // mengubahnya menjadi string, dan menghapus spasi di awal serta akhir.
    $value = trim((string)($input[$key] ?? ''));

    // Memeriksa apakah kolom wajib diisi tetapi nilainya kosong.
    // Jika kosong, sistem mengirimkan respons kesalahan HTTP 422.
    if ($required && $value === '') admin_fail("Kolom {$key} wajib diisi.", 422);

    // Jika nilai kosong dan kolom tidak wajib diisi,
    // fungsi mengembalikan nilai NULL.
    if ($value === '') return null;

    // Memeriksa panjang teks agar tidak melebihi batas maksimal karakter.
    // Jika melebihi batas, sistem mengirimkan pesan kesalahan HTTP 422.
    if (mb_strlen($value) > $max) admin_fail("Kolom {$key} maksimal {$max} karakter.", 422);

    // Mengembalikan nilai teks yang telah melalui proses validasi.
    return $value;
}

// Fungsi untuk mengatur pagination atau pembagian data ke beberapa halaman.
// Fungsi mengambil nomor halaman dan jumlah data yang diminta pengguna.
function admin_page(): array
{
    // Mengambil nomor halaman dari parameter URL.
    // Nilai minimal halaman adalah 1.
    $page = max(1, (int)($_GET['page'] ?? 1));

    // Mengambil jumlah data yang ingin ditampilkan per halaman.
    // Minimal 1 data dan maksimal 100 data.
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));

    // Mengembalikan nomor halaman, batas jumlah data,
    // dan posisi awal pengambilan data berdasarkan halaman aktif.
    return [$page, $limit, ($page - 1) * $limit];
}

// Fungsi untuk menjalankan beberapa operasi database
// dalam satu transaksi agar perubahan data dapat dikelola secara konsisten.
// Parameter callback berisi proses database yang akan dijalankan.
function admin_transaction(callable $callback)
{
    // Mengakses koneksi database PDO yang tersedia secara global.
    global $pdo;

    try {
        // Memulai transaksi database sebelum menjalankan proses.
        $pdo->beginTransaction();

        // Menjalankan fungsi callback dengan koneksi database PDO
        // dan menyimpan hasil proses ke dalam variabel result.
        $result = $callback($pdo);

        // Menyimpan seluruh perubahan jika proses transaksi berhasil.
        $pdo->commit();

        // Mengembalikan hasil dari proses transaksi.
        return $result;
    } catch (Throwable $e) {

        // Memeriksa apakah transaksi database masih berlangsung.
        // Jika masih aktif, seluruh perubahan dibatalkan menggunakan rollback.
        if ($pdo->inTransaction()) $pdo->rollBack();

        // Meneruskan kembali kesalahan agar dapat ditangani
        // oleh blok penanganan exception pada pemanggil fungsi.
        throw $e;
    }
}

// Fungsi untuk menangani kesalahan umum yang terjadi pada API Administrator.
// Fungsi ini digunakan agar detail kesalahan internal tidak ditampilkan
// secara langsung kepada pengguna.
function admin_exception(Throwable $e): never
{
    // Menyimpan detail kesalahan ke dalam log server
    // untuk membantu proses pemeriksaan dan perbaikan masalah.
    error_log('[SIPFAS ADMIN API] ' . $e->getMessage());

    // Mengirimkan respons kesalahan umum kepada pengguna
    // dengan status HTTP 500 tanpa menampilkan detail internal server.
    admin_fail('Terjadi kesalahan pada server. Periksa log PHP untuk detail.', 500);
}
