<?php
// GET /api/employees/profile.php?name=&month=&year=
require_once __DIR__ . '/../../includes/api_helpers.php';
require_login();

$name = trim($_GET['name'] ?? '');
if ($name === '') json_error('name is required.');

$stmt = $conn->prepare("SELECT name, company FROM employees WHERE UPPER(name) = UPPER(?) LIMIT 1");
$stmt->bind_param('s', $name);
$stmt->execute();
$employee = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$employee) json_error('Medrep not found.', 404);

$month = trim($_GET['month'] ?? '');
$year = trim($_GET['year'] ?? '') !== '' ? $_GET['year'] : date('Y');

$where = ['UPPER(name) = ?'];
$params = [strtoupper($name)];
$types = 's';
$date_column = 'created_at';
if ($month !== '') {
    $where[] = 'MONTH(created_at) = ? AND YEAR(created_at) = ?';
    $params[] = (int)$month; $params[] = (int)$year;
    $types .= 'ii';
} else {
    $where[] = 'YEAR(created_at) = ?';
    $params[] = (int)$year;
    $types .= 'i';
}
$where_sql = 'WHERE ' . implode(' AND ', $where);

$stmt = $conn->prepare("SELECT * FROM employees $where_sql ORDER BY $date_column DESC");
$stmt->bind_param($types, ...$params);
$stmt->execute();
$records = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$balance = compute_balance($conn, $name); // always all-time, matches original
$blocked = is_blocked($conn, $name);

json_success([
    'employee' => $employee,
    'records' => $records,
    'totals' => $balance,
    'blocked' => $blocked,
]);
