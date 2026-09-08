<?php
// GET /api/reports/monthly.php?search=&company=
require_once __DIR__ . '/../../includes/api_helpers.php';
require_login();

$search_query = trim($_GET['search'] ?? '');
$company_filter = trim($_GET['company'] ?? '');

$sql = "SELECT
    UPPER(e.name) AS name,
    e.company,
    SUM(e.deposit) AS total_deposit,
    SUM(CASE WHEN e.payment_method IN ('na', 'paid') THEN e.dinein + e.takeout + e.giftcard ELSE 0 END) AS total_payable,
    SUM(e.cashout) AS total_cashout,
    SUM(e.giftcard)
        - SUM(CASE WHEN e.payment_method = 'giftcard' THEN e.dinein ELSE 0 END)
        - SUM(CASE WHEN e.payment_method = 'giftcard' THEN e.takeout ELSE 0 END) AS total_giftcard,
    SUM(e.deposit) - (
        SUM(CASE WHEN e.payment_method IN ('na', 'paid') THEN e.dinein + e.takeout + e.giftcard ELSE 0 END)
        + SUM(e.cashout + e.interest) + SUM(e.sender_amount)
    ) AS total_balance,
    MAX(e.created_at) AS latest_transaction
    FROM employees e WHERE 1";

$params = [];
$types = '';
if ($search_query !== '') { $sql .= ' AND e.name LIKE ?'; $params[] = "%$search_query%"; $types .= 's'; }
if ($company_filter !== '') { $sql .= ' AND e.company = ?'; $params[] = $company_filter; $types .= 's'; }
$sql .= ' GROUP BY e.name, e.company ORDER BY latest_transaction DESC';

$stmt = $conn->prepare($sql);
if ($types !== '') $stmt->bind_param($types, ...$params);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$companies = array_column($conn->query('SELECT DISTINCT company FROM employees ORDER BY company')->fetch_all(MYSQLI_ASSOC), 'company');

json_success(['rows' => $rows, 'companies' => $companies]);
