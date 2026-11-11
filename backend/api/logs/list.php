<?php
// GET /api/logs/list.php?month=&year=
require_once __DIR__ . '/../../includes/api_helpers.php';
$admin_username = require_login();
require_role($conn, $admin_username, ['admin']);
$branch = current_branch();

$selected_month = (int)($_GET['month'] ?? date('m'));
$selected_year = (int)($_GET['year'] ?? date('Y'));

$filter_user = trim($_GET['user'] ?? '');
$filter_q = trim($_GET['q'] ?? '');

$sql = 'SELECT * FROM logs WHERE MONTH(timestamp) = ? AND YEAR(timestamp) = ? AND branch = ?';
$types = 'iis';
$params = [$selected_month, $selected_year, $branch];
if ($filter_user !== '') { $sql .= ' AND username = ?'; $types .= 's'; $params[] = $filter_user; }
if ($filter_q !== '') {
    $sql .= ' AND (action LIKE ? OR details LIKE ?)';
    $types .= 'ss';
    $like = '%' . $filter_q . '%';
    $params[] = $like; $params[] = $like;
}
$sql .= ' ORDER BY timestamp DESC LIMIT 5000';
$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$logs = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$year_stmt = $conn->prepare('SELECT DISTINCT YEAR(timestamp) AS year FROM logs WHERE branch = ? ORDER BY year DESC');
$year_stmt->bind_param('s', $branch);
$year_stmt->execute();
$years = array_column($year_stmt->get_result()->fetch_all(MYSQLI_ASSOC), 'year');
$year_stmt->close();

$user_stmt = $conn->prepare('SELECT DISTINCT username FROM logs WHERE branch = ? AND username <> \'\' ORDER BY username');
$user_stmt->bind_param('s', $branch);
$user_stmt->execute();
$users = array_column($user_stmt->get_result()->fetch_all(MYSQLI_ASSOC), 'username');
$user_stmt->close();

json_success(['logs' => $logs, 'users' => $users, 'years' => $years, 'month' => $selected_month, 'year' => $selected_year]);