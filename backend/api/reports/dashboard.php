<?php
require_once __DIR__ . '/../../includes/api_helpers.php';
require_login();

$row = $conn->query("SELECT SUM(giftcard) AS v FROM employees")->fetch_assoc();
$total_giftcard_balance = (float)($row['v'] ?? 0);

$row = $conn->query("SELECT SUM(dinein + takeout) AS v FROM employees WHERE payment_method = 'giftcard'")->fetch_assoc();
$total_used_giftcard = (float)($row['v'] ?? 0);
$giftcard_balance = $total_giftcard_balance - $total_used_giftcard;

$row = $conn->query("SELECT SUM(deposit + receiver_amount) AS v FROM employees")->fetch_assoc();
$total_deposit = (float)($row['v'] ?? 0);

$row = $conn->query("SELECT SUM(dinein) dinein, SUM(takeout) takeout, SUM(giftcard) giftcard FROM employees")->fetch_assoc();
$total_dinein = (float)($row['dinein'] ?? 0);
$total_takeout = (float)($row['takeout'] ?? 0);
$total_giftcard = (float)($row['giftcard'] ?? 0);
$total_payable = $total_dinein + $total_takeout + $total_giftcard;

$row = $conn->query("SELECT SUM(cashout + interest) AS v FROM employees")->fetch_assoc();
$total_cashout = (float)($row['v'] ?? 0);

$total_balance = $total_deposit - ($total_payable + $total_cashout);

$latest = $conn->query("SELECT id, name, company, deposit, dinein, takeout, cashout, interest, giftcard,
        sender_amount, receiver_amount, sender_name, receiver_name, remarks, payment_method, created_at
    FROM employees ORDER BY created_at DESC LIMIT 20")->fetch_all(MYSQLI_ASSOC);

$medrep_count = (int)($conn->query("SELECT COUNT(DISTINCT name) AS c FROM employees")->fetch_assoc()['c'] ?? 0);
$company_count = (int)($conn->query("SELECT COUNT(DISTINCT company) AS c FROM employees WHERE company IS NOT NULL AND company <> ''")->fetch_assoc()['c'] ?? 0);

json_success([
    'total_giftcard_balance' => $giftcard_balance,
    'total_deposit' => $total_deposit,
    'total_payable' => $total_payable,
    'total_cashout' => $total_cashout,
    'total_balance' => $total_balance,
    'medrep_count' => $medrep_count,
    'company_count' => $company_count,
    'latest_transactions' => $latest,
]);
