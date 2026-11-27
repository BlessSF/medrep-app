<?php
// GET  /api/vouchers/index.php            -> all vouchers for this branch + counts
// GET  /api/vouchers/index.php?id=7       -> one voucher + its saved rows
// POST /api/vouchers/index.php {action: create|rename|set_beginning|save_item|save_bulk|delete, ...}
// Admin and cashier can read and record rows (save_item, save_bulk). Creating, renaming,
// resizing and deleting vouchers is for admins, plus cashiers of the branches
// listed in CASHIER_VOUCHER_BRANCHES. Scoped to the logged-in branch.
require_once __DIR__ . '/../../includes/api_helpers.php';
$username = require_login();
$branch = current_branch();
$role = require_role($conn, $username, ['admin', 'cashier']);

// Branches whose cashiers may also add, rename, resize and delete vouchers.
// To let every cashier do it, replace this list with the word 'ALL'.
const CASHIER_VOUCHER_BRANCHES = ['DOIS'];
$can_manage = $role === 'admin'
    || ($role === 'cashier' && (CASHIER_VOUCHER_BRANCHES === 'ALL'
        || in_array(strtoupper($branch), array_map('strtoupper', (array)CASHIER_VOUCHER_BRANCHES), true)));

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
const MAX_BULK = 1000;

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
        json_success(['voucher' => ['id' => $vid, 'name' => $v['name'], 'beginning' => (int)$v['beginning']], 'items' => $items, 'can_manage' => $can_manage]);
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
    json_success(['vouchers' => $list, 'can_manage' => $can_manage]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed.', 405);

$data = json_input();
$action = $data['action'] ?? '';
if (!in_array($action, ['save_item', 'save_bulk'], true) && !$can_manage) {
    json_error('Forbidden: you are not allowed to manage vouchers.', 403);
}

// Writes the same values into many series numbers at once. Only the fields that
// were filled in are applied; every other field on each row is left as it is.
if ($action === 'save_bulk') {
    $v = get_voucher($conn, (int)($data['voucher_id'] ?? 0), $branch);
    $vid = (int)$v['id'];
    $max_series = (int)$v['beginning'];

    $list = array_values(array_unique(array_map('intval', (array)($data['series'] ?? []))));
    sort($list);
    if (!$list) json_error('Select at least one series number.');
    if (count($list) > MAX_BULK) json_error('You can update up to ' . MAX_BULK . ' series numbers at a time.');
    if ($list[0] < 1 || $list[count($list) - 1] > $max_series) json_error('Series number is out of range.');

    $input = (array)($data['changes'] ?? []);
    $limits = ['date_given' => 0, 'customer_name' => 255, 'redeemed_by' => 255,
        'payment_mode' => 50, 'remarks' => 50, 'date_availed' => 0, 'note' => 500];
    $changes = [];
    foreach ($limits as $key => $limit) {
        $value = trim((string)($input[$key] ?? ''));
        if ($value === '') continue;
        if ($limit === 0) {
            if (clean_date($value) === null) json_error('Invalid date.');
            $changes[$key] = $value;
        } else {
            $changes[$key] = mb_substr($value, 0, $limit);
        }
    }
    if (!$changes) json_error('Fill in at least one field.');
    $only_empty = !empty($data['only_empty']);

    $labels = ['date_given' => 'date given', 'customer_name' => 'customer', 'redeemed_by' => 'redeemed by',
        'payment_mode' => 'payment', 'remarks' => 'remarks', 'date_availed' => 'date availed', 'note' => 'note'];
    $pad = max(3, strlen((string)$max_series));
    $replaced = []; // rows where existing data was overwritten, for the audit log
    $changed = [];

    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare('SELECT series_no, date_given, customer_name, redeemed_by, payment_mode, remarks, date_availed, note
                                FROM voucher_items WHERE voucher_id = ? AND series_no BETWEEN ? AND ? FOR UPDATE');
        $first = $list[0];
        $last = $list[count($list) - 1];
        $stmt->bind_param('iii', $vid, $first, $last);
        $stmt->execute();
        $existing = [];
        $res = $stmt->get_result();
        while ($r = $res->fetch_assoc()) $existing[(int)$r['series_no']] = $r;
        $stmt->close();

        $upsert = $conn->prepare('INSERT INTO voucher_items
            (voucher_id, series_no, date_given, customer_name, redeemed_by, payment_mode, remarks, date_availed, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE date_given = VALUES(date_given), customer_name = VALUES(customer_name),
              redeemed_by = VALUES(redeemed_by), payment_mode = VALUES(payment_mode), remarks = VALUES(remarks),
              date_availed = VALUES(date_availed), note = VALUES(note)');

        foreach ($list as $series) {
            $old = $existing[$series] ?? [];
            $row = [];
            foreach ($labels as $key => $label) $row[$key] = (string)($old[$key] ?? '');
            $dirty = false;
            $overwritten = [];
            foreach ($changes as $key => $value) {
                if ($row[$key] === $value || ($only_empty && $row[$key] !== '')) continue;
                if ($row[$key] !== '') $overwritten[] = $labels[$key] . ': ' . $row[$key] . ' -> ' . $value;
                $row[$key] = $value;
                $dirty = true;
            }
            if (!$dirty) continue;

            $date_given = $row['date_given'] === '' ? null : $row['date_given'];
            $date_availed = $row['date_availed'] === '' ? null : $row['date_availed'];
            $upsert->bind_param('iisssssss', $vid, $series, $date_given, $row['customer_name'], $row['redeemed_by'],
                $row['payment_mode'], $row['remarks'], $date_availed, $row['note']);
            if (!$upsert->execute()) throw new RuntimeException('Could not save row ' . $series);

            $changed[] = $series;
            if ($overwritten) $replaced[$series] = implode('; ', $overwritten);
        }
        $upsert->close();
        if (!$conn->commit()) throw new RuntimeException('Commit failed');
    } catch (Throwable $e) {
        $conn->rollback();
        json_error('Could not save. No rows were changed.', 500);
    }

    if ($changed) {
        $summary = [];
        foreach ($changes as $key => $value) $summary[] = $labels[$key] . ': ' . $value;
        $first_ref = str_pad((string)$changed[0], $pad, '0', STR_PAD_LEFT);
        $last_ref = str_pad((string)$changed[count($changed) - 1], $pad, '0', STR_PAD_LEFT);
        log_action($conn, $username, 'Voucher bulk update',
            $v['name'] . ' — ' . count($changed) . " rows between #$first_ref and #$last_ref — " . implode('; ', $summary), $branch);
        // Keep the old values of anything that was overwritten, one entry per row.
        foreach ($replaced as $series => $detail) {
            log_action($conn, $username, 'Voucher entry updated',
                $v['name'] . ' #' . str_pad((string)$series, $pad, '0', STR_PAD_LEFT) . ' — ' . $detail, $branch);
        }
    }
    json_success(['updated' => count($changed)]);
}

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
    log_action($conn, $username, 'Voucher renamed', $v['name'] . ' -> ' . $name, $branch);
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

    // Remember what the row looked like so the audit log can say what changed.
    $prev_stmt = $conn->prepare('SELECT date_given, customer_name, redeemed_by, payment_mode, remarks, date_availed, note FROM voucher_items WHERE voucher_id = ? AND series_no = ?');
    $prev_stmt->bind_param('ii', $vid, $series);
    $prev_stmt->execute();
    $prev = $prev_stmt->get_result()->fetch_assoc();
    $prev_stmt->close();

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

    $now = ['date_given' => (string)$date_given, 'customer_name' => $customer, 'redeemed_by' => $redeemed,
        'payment_mode' => $payment, 'remarks' => $remarks, 'date_availed' => (string)$date_availed, 'note' => $note];
    $before = $prev ?: array_fill_keys(array_keys($now), '');
    $labels = ['date_given' => 'date given', 'customer_name' => 'customer', 'redeemed_by' => 'redeemed by',
        'payment_mode' => 'payment', 'remarks' => 'remarks', 'date_availed' => 'date availed', 'note' => 'note'];
    $changes = [];
    foreach ($labels as $key => $label) {
        $old = (string)($before[$key] ?? '');
        if ($old !== $now[$key]) {
            $changes[] = "$label: " . ($old === '' ? '(blank)' : $old) . ' -> ' . ($now[$key] === '' ? '(blank)' : $now[$key]);
        }
    }
    if ($changes) {
        $pad = max(3, strlen((string)$v['beginning']));
        $ref = $v['name'] . ' #' . str_pad((string)$series, $pad, '0', STR_PAD_LEFT);
        if ($empty) {
            $act = 'Voucher entry cleared';
        } elseif (!$prev) {
            $act = 'Voucher entry added';
        } elseif (($before['date_availed'] ?? '') === '' && $now['date_availed'] !== '') {
            $act = 'Voucher availed';
        } else {
            $act = 'Voucher entry updated';
        }
        log_action($conn, $username, $act, $ref . ' — ' . implode('; ', $changes), $branch);
    }
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