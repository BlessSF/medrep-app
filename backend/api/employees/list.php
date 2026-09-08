<?php
// GET /api/employees/list.php?f_company=&f_month=&f_q=&page=&per_page=
require_once __DIR__ . '/../../includes/api_helpers.php';
require_login();

$filter_company = trim($_GET['f_company'] ?? '');
$filter_month = trim($_GET['f_month'] ?? '');
$filter_q = trim($_GET['f_q'] ?? '');

$per_page_options = [25, 50, 100, 500];
$per_page = (int)($_GET['per_page'] ?? 25);
if (!in_array($per_page, $per_page_options, true)) $per_page = 25;
$page = max(1, (int)($_GET['page'] ?? 1));

$where = [];
$params = [];
$types = '';
if ($filter_company !== '') { $where[] = 'company = ?'; $params[] = $filter_company; $types .= 's'; }
if ($filter_month !== '') { $where[] = "DATE_FORMAT(created_at, '%Y-%m') = ?"; $params[] = $filter_month; $types .= 's'; }
if ($filter_q !== '') { $where[] = '(name LIKE ? OR company LIKE ?)'; $like = "%$filter_q%"; $params[] = $like; $params[] = $like; $types .= 'ss'; }
$where_sql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$count_stmt = $conn->prepare("SELECT COUNT(*) AS total FROM employees $where_sql");
if ($types !== '') $count_stmt->bind_param($types, ...$params);
$count_stmt->execute();
$total_rows = (int)($count_stmt->get_result()->fetch_assoc()['total'] ?? 0);
$count_stmt->close();

$total_pages = max(1, (int)ceil($total_rows / $per_page));
if ($page > $total_pages) $page = $total_pages;
$offset = ($page - 1) * $per_page;

$sql = "SELECT id, name, company, deposit, dinein, takeout, cashout, interest, giftcard,
            sender_amount, receiver_amount, sender_name, receiver_name, remarks,
            payment_method, card, block, created_at
        FROM employees $where_sql ORDER BY created_at DESC LIMIT ? OFFSET ?";
$stmt = $conn->prepare($sql);
$list_types = $types . 'ii';
$list_params = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($list_types, ...$list_params);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$months_result = $conn->query("SELECT DISTINCT DATE_FORMAT(created_at, '%Y-%m') AS ym FROM employees WHERE created_at IS NOT NULL ORDER BY ym DESC");
$available_months = $months_result ? array_column($months_result->fetch_all(MYSQLI_ASSOC), 'ym') : [];

json_success([
    'rows' => $rows,
    'total_rows' => $total_rows,
    'total_pages' => $total_pages,
    'page' => $page,
    'per_page' => $per_page,
    'available_months' => $available_months,
]);
