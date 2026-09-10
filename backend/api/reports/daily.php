<?php
// GET /api/reports/daily.php?month=&year=  (0 = all)
require_once __DIR__ . '/../../includes/api_helpers.php';
require_login();
$branch = current_branch();

$selected_month = (int)($_GET['month'] ?? date('m'));
$selected_year = (int)($_GET['year'] ?? date('Y'));

$where = ['branch = ?'];
$params = [$branch];
$types = 's';
if ($selected_year != 0) { $where[] = 'YEAR(created_at) = ?'; $params[] = $selected_year; $types .= 'i'; }
if ($selected_month != 0) { $where[] = 'MONTH(created_at) = ?'; $params[] = $selected_month; $types .= 'i'; }
$where_sql = 'WHERE ' . implode(' AND ', $where);

// Deposits from transfers (sender_name set) are excluded from the "deposit"
// bucket, matching daily.php's per-row logic (only genuine cash deposits count).
$sql = "SELECT DATE(created_at) AS transaction_date,
        SUM(dinein) AS dinein,
        SUM(takeout) AS takeout,
        SUM(CASE WHEN sender_name IS NULL OR sender_name = '' THEN deposit ELSE 0 END) AS deposit,
        SUM(cashout) AS cashout,
        SUM(giftcard) AS giftcard,
        SUM(interest) AS interest,
        SUM(sender_amount) AS sender_amount,
        COUNT(*) AS record_count
    FROM employees $where_sql
    GROUP BY DATE(created_at)
    ORDER BY transaction_date DESC";
$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$days = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

json_success(['days' => $days, 'month' => $selected_month, 'year' => $selected_year]);