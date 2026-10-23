<?php
// GET  /api/vouchers/index.php            -> all vouchers for this branch + counts
// GET  /api/vouchers/index.php?id=7       -> one voucher + its saved rows
// POST /api/vouchers/index.php {action: create|rename|set_beginning|save_item|delete, ...}
// Admin only. Everything is scoped to the logged-in branch.
require_once __DIR__ . '/../../includes/api_helpers.php';
$username = require_login();
$branch = current_branch();
require_role($conn, $username, ['admin']);

$conn->query("CREATE TABLE IF NOT EXISTS vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch VARCHAR(100) NOT NULL DEFAULT 'STELLA',
    name VARCHAR(255) NOT NULL,
    beginning INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY branch_name (branch, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$conn->query("CREATE TABLE IF NOT EXISTS voucher_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_id INT NOT NULL,
    series_no INT NOT NULL,
    date_given DATE NULL,
    customer_name VARCHAR(255) NOT NULL DEFAULT '',
    redeemed_by VARCHAR(255) NOT NULL DEFAULT '',
    payment_mode VARCHAR(50) NOT NULL DEFAULT '',
    remarks VARCHAR(50) NOT NULL DEFAULT '',
    date_availed DATE NULL,
    note VARCHAR(500) NOT NULL DEFAULT '',
    UNIQUE KEY voucher_series (voucher_id, series_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

const MAX_BEGINNING = 100000;

function clean_date($v): ?string {
    $v = trim((string)$v);
    if ($v === '') return null;
    $d = DateTime::createFromFormat('Y-m-d', $v);
    return ($d && $d->format('Y-m-d') === $v) ? $v : null;
}

function get_voucher(mysqli $conn, int $id, string $branch): array {
    $stmt = $conn->prepare('SELECT id, name, beginning FROM vouchers WHERE id = ? AND branch = ?');
    $stmt->bind_param('is', $id, $branch);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) json_error('Voucher not found.', 404);
    return $row;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['id'])) {
        $v = get_voucher($conn, (int)$_GET['id'], $branch);
        $vid = (int)$v['id'];
        $stmt = $conn->prepare('SELECT series_no, date_given, customer_name, redeemed_by, payment_mode, remarks, date_availed, note
                                FROM voucher_items WHERE voucher_id = ? ORDER BY series_no');
        $stmt->bind_param('i', $vid);
        $stmt->execute();
        $items = [];
        $res = $stmt->get_result();
        while ($r = $res->fetch_assoc()) {
            $r['series_no'] = (int)$r['series_no'];
            $items[] = $r;
        }
        $stmt->close();
        json_success(['voucher' => ['id' => $vid, 'name' => $v['name'], 'beginning' => (int)$v['beginning']], 'items' => $items]);
    }

    $stmt = $conn->prepare("SELECT v.id, v.name, v.beginning,
            COALESCE(SUM(i.date_given IS NOT NULL OR i.customer_name <> ''), 0) AS given_out,
            COALESCE(SUM(i.date_availed IS NOT NULL), 0) AS availed
        FROM vouchers v LEFT JOIN voucher_items i ON i.voucher_id = v.id
        WHERE v.branch = ? GROUP BY v.id, v.name, v.beginning ORDER BY v.id");
    $stmt->bind_param('s', $branch);
    $stmt->execute();
    $res = $stmt->get_result();
    $list = [];
    while ($r = $res->fetch_assoc()) {
        $list[] = [
            'id' => (int)$r['id'], 'name' => $r['name'], 'beginning' => (int)$r['beginning'],
            'given_out' => (int)$r['given_out'], 'availed' => (int)$r['availed'],
        ];
    }
    $stmt->close();
    json_success(['vouchers' => $list]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed.', 405);

$data = json_input();
$action = $data['action'] ?? '';

if ($action === 'create') {
    $name = trim($data['name'] ?? '');
    $beginning = (int)($data['beginning'] ?? 0);
    if ($name === '') json_error("Voucher name can't be empty.");
    if ($beginning < 1 || $beginning > MAX_BEGINNING) json_error('Quantity must be between 1 and ' . MAX_BEGINNING . '.');
    $stmt = $conn->prepare('INSERT INTO vouchers (name, beginning, branch) VALUES (?, ?, ?)');
    $stmt->bind_param('sis', $name, $beginning, $branch);
    if (!$stmt->execute()) {
        $dup = ($conn->errno === 1062);
        $stmt->close();
        json_error($dup ? "\"$name\" already exists." : 'Could not save voucher.', $dup ? 400 : 500);
    }
    $id = $conn->insert_id;
    $stmt->close();
    log_action($conn, $username, 'Voucher created', "$name ($beginning pcs)", $branch);
    json_success(['id' => $id, 'message' => "Voucher \"$name\" created."]);
}

if ($action === 'rename') {
    $v = get_voucher($conn, (int)($data['id'] ?? 0), $branch);
    $name = trim($data['name'] ?? '');
    if ($name === '') json_error("Voucher name can't be empty.");
    $stmt = $conn->prepare('UPDATE vouchers SET name = ? WHERE id = ? AND branch = ?');
    $vid = (int)$v['id'];
    $stmt->bind_param('sis', $name, $vid, $branch);
    if (!$stmt->execute()) {
        $dup = ($conn->errno === 1062);
        $stmt->close();
        json_error($dup ? "\"$name\" already exists." : 'Could not rename.', $dup ? 400 : 500);
    }
    $stmt->close();
    json_success(['message' => 'Renamed.']);
}

if ($action === 'set_beginning') {
    $v = get_voucher($conn, (int)($data['id'] ?? 0), $branch);
    $vid = (int)$v['id'];
    $beginning = (int)($data['beginning'] ?? 0);
    if ($beginning < 1 || $beginning > MAX_BEGINNING) json_error('Quantity must be between 1 and ' . MAX_BEGINNING . '.');
    $stmt = $conn->prepare('SELECT COALESCE(MAX(series_no), 0) AS m FROM voucher_items WHERE voucher_id = ?');
    $stmt->bind_param('i', $vid);
    $stmt->execute();
    $max = (int)$stmt->get_result()->fetch_assoc()['m'];
    $stmt->close();
    if ($beginning < $max) json_error("Series #$max already has data, so the quantity can't go below $max.");
    $stmt = $conn->prepare('UPDATE vouchers SET beginning = ? WHERE id = ? AND branch = ?');
    $stmt->bind_param('iis', $beginning, $vid, $branch);
    $stmt->execute();
    $stmt->close();
    log_action($conn, $username, 'Voucher beginning changed', $v['name'] . ': ' . $v['beginning'] . ' -> ' . $beginning, $branch);
    json_success(['message' => 'Beginning quantity updated.']);
}

if ($action === 'save_item') {
    $v = get_voucher($conn, (int)($data['voucher_id'] ?? 0), $branch);
    $vid = (int)$v['id'];
    $series = (int)($data['series_no'] ?? 0);
    if ($series < 1 || $series > (int)$v['beginning']) json_error('Series number is out of range.');

    $date_given   = clean_date($data['date_given'] ?? '');
    $date_availed = clean_date($data['date_availed'] ?? '');
    $customer = mb_substr(trim($data['customer_name'] ?? ''), 0, 255);
    $redeemed = mb_substr(trim($data['redeemed_by'] ?? ''), 0, 255);
    $payment  = mb_substr(trim($data['payment_mode'] ?? ''), 0, 50);
    $remarks  = mb_substr(trim($data['remarks'] ?? ''), 0, 50);
    $note     = mb_substr(trim($data['note'] ?? ''), 0, 500);

    $empty = $date_given === null && $date_availed === null
        && $customer === '' && $redeemed === '' && $payment === '' && $remarks === '' && $note === '';

    if ($empty) {
        $stmt = $conn->prepare('DELETE FROM voucher_items WHERE voucher_id = ? AND series_no = ?');
        $stmt->bind_param('ii', $vid, $series);
    } else {
        $stmt = $conn->prepare('INSERT INTO voucher_items
            (voucher_id, series_no, date_given, customer_name, redeemed_by, payment_mode, remarks, date_availed, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE date_given = VALUES(date_given), customer_name = VALUES(customer_name),
              redeemed_by = VALUES(redeemed_by), payment_mode = VALUES(payment_mode), remarks = VALUES(remarks),
              date_availed = VALUES(date_availed), note = VALUES(note)');
        $stmt->bind_param('iisssssss', $vid, $series, $date_given, $customer, $redeemed, $payment, $remarks, $date_availed, $note);
    }
    if (!$stmt->execute()) { $stmt->close(); json_error('Could not save.', 500); }
    $stmt->close();
    json_success(['saved' => true]);
}

if ($action === 'delete') {
    $v = get_voucher($conn, (int)($data['id'] ?? 0), $branch);
    $vid = (int)$v['id'];
    $stmt = $conn->prepare('DELETE FROM voucher_items WHERE voucher_id = ?');
    $stmt->bind_param('i', $vid);
    $stmt->execute();
    $stmt->close();
    $stmt = $conn->prepare('DELETE FROM vouchers WHERE id = ? AND branch = ?');
    $stmt->bind_param('is', $vid, $branch);
    $stmt->execute();
    $stmt->close();
    log_action($conn, $username, 'Voucher deleted', $v['name'], $branch);
    json_success(['message' => 'Voucher removed.']);
}

json_error('Unknown action.');