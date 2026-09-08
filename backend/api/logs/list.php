<?php
// GET /api/logs/list.php?month=&year=
require_once __DIR__ . '/../../includes/api_helpers.php';
$admin_username = require_login();
require_role($conn, $admin_username, ['admin']);

$selected_month = (int)($_GET['month'] ?? date('m'));
$selected_year = (int)($_GET['year'] ?? date('Y'));

$stmt = $conn->prepare('SELECT * FROM logs WHERE MONTH(timestamp) = ? AND YEAR(timestamp) = ? ORDER BY timestamp DESC');
$stmt->bind_param('ii', $selected_month, $selected_year);
$stmt->execute();
$logs = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$year_result = $conn->query('SELECT DISTINCT YEAR(timestamp) AS year FROM logs ORDER BY year DESC');
$years = $year_result ? array_column($year_result->fetch_all(MYSQLI_ASSOC), 'year') : [];

json_success(['logs' => $logs, 'years' => $years, 'month' => $selected_month, 'year' => $selected_year]);
