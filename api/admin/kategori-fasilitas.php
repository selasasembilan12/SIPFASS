
<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, autentikasi, dan fungsi API.
require_once __DIR__ . '/_admin-common.php';

try {
    // Menentukan metode HTTP yang diperbolehkan pada API,
    // yaitu GET untuk mengambil data, POST untuk menambahkan data,
    // PUT untuk memperbarui data, dan DELETE untuk menghapus data.
    $method = admin_method('GET','POST','PUT','DELETE');

    // Memeriksa apakah permintaan menggunakan metode GET
    // untuk mengambil dan menampilkan data kategori fasilitas.
    if ($method === 'GET') {

        // Mengambil informasi halaman, batas jumlah data,
        // dan posisi awal data untuk kebutuhan pagination.
        [$page,$limit,$offset] = admin_page();

        // Menyiapkan array untuk menampung kondisi pencarian
        // dan parameter yang akan digunakan dalam query SQL.
        $where = []; $params = [];

        // Memeriksa apakah pengguna memasukkan kata kunci pencarian.
        // Pencarian dilakukan berdasarkan kode kategori atau nama kategori.
        if (!empty($_GET['search'])) {

            // Menambahkan kondisi pencarian menggunakan LIKE
            // agar data dapat ditemukan berdasarkan sebagian kata kunci.
            $where[] = '(kode_kategori LIKE :q OR nama_kategori LIKE :q)';

            // Menyimpan kata kunci pencarian sebagai parameter query.
            $params[':q'] = '%' . trim($_GET['search']) . '%';
        }

        // Memeriksa apakah pengguna memilih filter status kategori.
        // Jika status bukan 'semua', data akan difilter sesuai status yang dipilih.
        if (!empty($_GET['status']) && $_GET['status'] !== 'semua') {

            // Menambahkan kondisi filter berdasarkan status kategori.
            $where[] = 'status_kategori = :status'; $params[':status'] = $_GET['status'];
        }

        // Menggabungkan seluruh kondisi pencarian dan filter
        // menjadi klausa WHERE untuk query database.
        // Jika tidak terdapat kondisi pencarian atau filter,
        // klausa WHERE akan dikosongkan.
        $clause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        // Menyiapkan query untuk menghitung jumlah seluruh kategori
        // berdasarkan kondisi pencarian dan filter yang telah ditentukan.
        $count = $pdo->prepare("SELECT COUNT(*) FROM kategori_fasilitas $clause");

        // Menjalankan query penghitungan jumlah kategori
        // menggunakan parameter pencarian dan filter.
        $count->execute($params); $total = (int)$count->fetchColumn();

        // Menyiapkan query untuk mengambil data kategori fasilitas
        // sekaligus menghitung jumlah fasilitas yang menggunakan setiap kategori.
        // Subquery COUNT digunakan untuk menghitung fasilitas berdasarkan ID kategori.
        // Data diurutkan berdasarkan ID kategori terbaru dan menggunakan pagination.
        $stmt = $pdo->prepare("SELECT k.*,
            (SELECT COUNT(*) FROM fasilitas f WHERE f.id_kategori=k.id_kategori) AS jumlah_fasilitas
            FROM kategori_fasilitas k $clause ORDER BY k.id_kategori DESC LIMIT :lim OFFSET :off");

        // Mengikat seluruh parameter pencarian dan filter
        // ke dalam query yang telah disiapkan.
        foreach ($params as $k=>$v) $stmt->bindValue($k,$v);

        // Mengikat parameter limit dan offset menggunakan tipe integer.
        // Limit menentukan jumlah data yang ditampilkan,
        // sedangkan offset menentukan posisi awal pengambilan data.
        $stmt->bindValue(':lim',$limit,PDO::PARAM_INT); $stmt->bindValue(':off',$offset,PDO::PARAM_INT);

        // Menjalankan query untuk mengambil data kategori fasilitas.
        $stmt->execute();

        // Mengirimkan respons berhasil yang berisi daftar kategori fasilitas
        // beserta jumlah fasilitas dan informasi pagination.
        admin_ok('Data kategori berhasil dimuat.', ['items'=>$stmt->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
    }

    // Mengambil data input yang dikirimkan dari halaman pengelolaan kategori.
    $in = admin_input();

    // Memeriksa apakah metode yang digunakan adalah POST
    // untuk menambahkan kategori fasilitas baru ke database.
    if ($method === 'POST') {

        // Mengambil kode kategori dengan batas maksimal 20 karakter
        // dan nama kategori dengan batas maksimal 100 karakter.
        $kode=admin_text($in,'kode_kategori',20); $nama=admin_text($in,'nama_kategori',100);

        // Mengambil deskripsi kategori dengan batas maksimal 10.000 karakter.
        // Parameter false menunjukkan bahwa input tidak diwajibkan.
        $desc=admin_text($in,'deskripsi',10000,false);

        // Mengambil status kategori dari input.
        // Jika tidak tersedia, status secara default diatur menjadi Aktif.
        $status=$in['status_kategori'] ?? 'Aktif';

        // Memastikan status kategori hanya menggunakan nilai Aktif atau Nonaktif.
        // Jika nilai tidak sesuai, sistem mengirimkan kesalahan HTTP 422.
        if (!in_array($status,['Aktif','Nonaktif'],true)) admin_fail('Status kategori tidak valid.',422);

        // Menyiapkan query INSERT untuk menyimpan kode kategori,
        // nama kategori, deskripsi, dan status kategori ke database.
        $st=$pdo->prepare("INSERT INTO kategori_fasilitas (kode_kategori,nama_kategori,deskripsi,status_kategori) VALUES (:kode,:nama,:deskripsi,:status)");

        // Menjalankan query INSERT menggunakan data kategori yang telah diambil.
        $st->execute([':kode'=>$kode,':nama'=>$nama,':deskripsi'=>$desc,':status'=>$status]);

        // Mengirimkan respons berhasil setelah kategori ditambahkan.
        // ID kategori yang baru dibuat turut dikirimkan dalam respons.
        // Status HTTP 201 menunjukkan bahwa data berhasil dibuat.
        admin_ok('Kategori berhasil ditambahkan.',['id_kategori'=>(int)$pdo->lastInsertId()],201);
    }

    // Mengambil ID kategori dari data input
    // sebagai identitas kategori yang akan diperbarui atau dihapus.
    $id=admin_id($in,'id_kategori');

    // Memeriksa apakah metode yang digunakan adalah PUT
    // untuk memperbarui data kategori fasilitas yang sudah tersimpan.
    if ($method === 'PUT') {

        // Menyiapkan query UPDATE untuk memperbarui kode kategori,
        // nama kategori, deskripsi, dan status berdasarkan ID kategori.
        $st=$pdo->prepare("UPDATE kategori_fasilitas SET kode_kategori=:kode,nama_kategori=:nama,deskripsi=:deskripsi,status_kategori=:status WHERE id_kategori=:id");

        // Menjalankan query UPDATE menggunakan data kategori terbaru
        // yang dikirimkan dari halaman pengelolaan kategori.
        $st->execute([':kode'=>admin_text($in,'kode_kategori',20),':nama'=>admin_text($in,'nama_kategori',100),':deskripsi'=>admin_text($in,'deskripsi',10000,false),':status'=>$in['status_kategori'] ?? 'Aktif',':id'=>$id]);

        // Mengirimkan respons bahwa data kategori berhasil diperbarui.
        admin_ok('Kategori berhasil diperbarui.');
    }

    // Menyiapkan query untuk menghitung jumlah fasilitas
    // yang masih menggunakan kategori berdasarkan ID kategori.
    $check=$pdo->prepare("SELECT COUNT(*) FROM fasilitas WHERE id_kategori=:id");

    // Menjalankan query pemeriksaan penggunaan kategori.
    $check->execute([':id'=>$id]);

    // Memeriksa apakah kategori masih digunakan oleh fasilitas.
    // Jika masih digunakan, penghapusan ditolak dengan status HTTP 409
    // agar hubungan data fasilitas dengan kategori tetap terjaga.
    if ((int)$check->fetchColumn()>0) admin_fail('Kategori tidak dapat dihapus karena masih digunakan fasilitas.',409);

    // Menyiapkan query DELETE untuk menghapus kategori fasilitas
    // berdasarkan ID kategori yang diterima.
    $st=$pdo->prepare("DELETE FROM kategori_fasilitas WHERE id_kategori=:id");

    // Menjalankan query DELETE menggunakan parameter ID kategori.
    $st->execute([':id'=>$id]);

    // Memeriksa apakah terdapat data kategori yang berhasil dihapus.
    // Jika tidak ada baris yang terhapus, sistem mengirimkan respons 404.
    if (!$st->rowCount()) admin_fail('Kategori tidak ditemukan.',404);

    // Mengirimkan respons bahwa kategori fasilitas berhasil dihapus.
    admin_ok('Kategori berhasil dihapus.');

} catch (PDOException $e) {

    // Menangani kesalahan yang berasal dari database.
    // Kode error 23000 menunjukkan pelanggaran constraint database,
    // misalnya kode atau nama kategori sudah digunakan.
    if ((string)$e->getCode()==='23000') admin_fail('Kode atau nama kategori sudah digunakan.',409);

    // Meneruskan kesalahan database ke fungsi penanganan exception.
    admin_exception($e);

} catch (Throwable $e) {

    // Menangani kesalahan umum yang terjadi selama proses API berlangsung.
    admin_exception($e);
}
