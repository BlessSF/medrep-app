<?php
// GET /api/reports/daily.php?month=&year=  (0 = all)
require_once __DIR__ . '/../../includes/api_helpers.php';
require_login();

$selected_month = (int)($_GET['month'] ?? date('m'));
$selected_year = (int)($_GET['year'] ?? date('Y'));

$where = [];
if ($selected_year != 0) $where[] = "YEAR(created_at) = $selected_year";
if ($selected_month != 0) $where[] = "MONTH(created_at) = $selected_month";
$where_sql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

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
$result = $conn->query($sql);
$days = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];

json_success(['days' => $days, 'month' => $selected_month, 'year' => $selected_year]);
