<?php
// POST /api/employees/transaction/update.php  { id, field, value }
require_once __DIR__ . '/../../../includes/api_helpers.php';
$username = require_login();

$allowed_fields = [
    'dinein' => 'd', 'takeout' => 'd', 'deposit' => 'd', 'cashout' => 'd',
    'interest' => 'd', 'giftcard' => 'd', 'sender_amount' => 'd',
    'remarks' => 's', 'card' => 's', 'created_at' => 'date',
];

$data = json_input();
$id = (int)($data['id'] ?? 0);
$field = $data['field'] ?? '';
$value = $data['value'] ?? '';

if ($id <= 0 || !array_key_exists($field, $allowed_fields)) {
    json_error('Invalid field or record id');
}

$type = $allowed_fields[$field];
$display = null;

if ($type === 'd') {
    $clean = str_replace(['₱', ',', ' '], '', $value);
    if ($clean !== '' && !is_numeric($clean)) json_error('Value must be a number');
    $value = $clean === '' ? 0 : round((float)$clean, 2);
    $display = $value > 0 ? '₱' . number_format($value, 2) : '';
} elseif ($type === 'date') {
    $clean_date_str = preg_replace('/[\x{00A0}\s]+/u', ' ', trim($value));
    $parsed = strtotime($clean_date_str);
    if ($parsed === false) json_error('Please enter a valid date (e.g. 20-Aug-2026).');

    $time_stmt = $conn->prepare('SELECT created_at FROM employees WHERE id = ?');
    $time_stmt->bind_param('i', $id);
    $time_stmt->execute();
    $existing = $time_stmt->get_result()->fetch_assoc();
    $time_stmt->close();

    $time_part = '00:00:00';
    if ($existing && !empty($existing['created_at'])) {
        $time_part = date('H:i:s', strtotime($existing['created_at']));
    }
    $value = date('Y-m-d', $parsed) . ' ' . $time_part;
    $display = date('d-M-Y', $parsed);
} else {
    $value = trim($value);
    if (mb_strlen($value) > 255) json_error('Value too long');
    $display = strtoupper($value);
}

$sql = "UPDATE employees SET `$field` = ? WHERE id = ?";
$stmt = $conn->prepare($sql);
if (!$stmt) json_error('Query preparation failed', 500);

if ($type === 'd') { $stmt->bind_param('di', $value, $id); }
else { $stmt->bind_param('si', $value, $id); }

$ok = $stmt->execute();
$stmt->close();

if ($ok) {
    $details = "Updated record #{$id}: {$field} = " . (is_numeric($value) ? number_format((float)$value, 2) : $value);
    log_action($conn, $username, 'Edited Transaction (inline)', $details);
}

json_success(['display' => $display, 'ok' => $ok]);
