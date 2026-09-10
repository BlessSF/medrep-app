<?php

require_once __DIR__ . '/../includes/api_helpers.php';
require_login();
$branch = current_branch();

header_remove('Content-Type');



$company = isset($_GET['company']) ? trim($_GET['company']) : '';
$format  = isset($_GET['format']) ? strtolower(trim($_GET['format'])) : 'csv';


if ($format === 'xlsx') {
    require_once __DIR__ . '/../includes/simple_xlsx_writer.php';

    
    ini_set('display_errors', '1');
    error_reporting(E_ALL);

    if (!class_exists('ZipArchive')) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Excel export unavailable: the PHP 'zip' extension (ZipArchive) is not enabled on this server.\n\n"
           . "How to fix:\n"
           . "- XAMPP (Windows/Mac): open php.ini, uncomment (remove the leading ';' from) the line\n"
           . "  ';extension=zip', save, then fully restart Apache from the XAMPP control panel.\n"
           . "- To find which php.ini is active, create a file with <?php phpinfo(); and look for\n"
           . "  'Loaded Configuration File'.\n"
           . "- On Linux/shared hosting: install/enable php-zip (or php8.x-zip) and restart PHP/Apache.\n"
           . "The single-CSV download (no ?format=xlsx) does not need this extension and will still work.\n";
        exit;
    }

    try {
        $headers = [
            'Name', 'Company', 'Deposit', 'Dine In', 'Takeout', 'Gift Card',
            'Cashout', 'Interest', 'Sender Amount', 'Receiver Amount',
            'Sender Name', 'Receiver Name', 'Payment Method', 'Card',
            'Remarks', 'Cashier', 'Block Status', 'Created At'
        ];

        // Prepared once, re-bound per company below.
        $rowStmt = $conn->prepare(
            "SELECT name, company, deposit, dinein, takeout, giftcard,
                    cashout, interest, sender_amount, receiver_amount,
                    sender_name, receiver_name, payment_method, card,
                    remarks, cashier, block, created_at
             FROM employees
             WHERE company = ? AND branch = ?
             ORDER BY created_at ASC"
        );
        if (!$rowStmt) {
            throw new RuntimeException("Query prepare failed: " . $conn->error);
        }

       
        $companyNames = [];
        if ($company !== '') {
            $companyNames[] = $company;
        } else {
            $listResult = $conn->prepare(
                "SELECT DISTINCT company FROM employees
                 WHERE company IS NOT NULL AND company <> '' AND branch = ?
                 ORDER BY company ASC"
            );
            $listResult->bind_param('s', $branch);
            $listResult->execute();
            $listResult = $listResult->get_result();
            if (!$listResult) {
                throw new RuntimeException("Company list query failed: " . $conn->error);
            }
            while ($r = $listResult->fetch_assoc()) {
                $companyNames[] = $r['company'];
            }

            // Rows with a blank/NULL company still need to end up somewhere.
            $unassignedCheck = $conn->prepare(
                "SELECT COUNT(*) AS n FROM employees WHERE (company IS NULL OR company = '') AND branch = ?"
            );
            $unassignedCheck->bind_param('s', $branch);
            $unassignedCheck->execute();
            $unassignedCheck = $unassignedCheck->get_result();
            $hasUnassigned = $unassignedCheck && (($unassignedCheck->fetch_assoc()['n'] ?? 0) > 0);
        }

        $writer = new SimpleXlsxWriter();

        foreach ($companyNames as $cName) {
            $rowStmt->bind_param('ss', $cName, $branch);
            $rowStmt->execute();
            $res = $rowStmt->get_result();

            $rows = [];
            while ($row = $res->fetch_assoc()) {
                $rows[] = [
                    $row['name'], $row['company'], $row['deposit'], $row['dinein'],
                    $row['takeout'], $row['giftcard'], $row['cashout'], $row['interest'],
                    $row['sender_amount'], $row['receiver_amount'], $row['sender_name'],
                    $row['receiver_name'], $row['payment_method'], $row['card'],
                    $row['remarks'], $row['cashier'], $row['block'], $row['created_at'],
                ];
            }
            $writer->addSheet($cName, $headers, $rows);
        }

        // Bucket for legacy/blank-company rows, only when exporting everything.
        if ($company === '' && !empty($hasUnassigned)) {
            $blankStmt = $conn->prepare(
                "SELECT name, company, deposit, dinein, takeout, giftcard,
                        cashout, interest, sender_amount, receiver_amount,
                        sender_name, receiver_name, payment_method, card,
                        remarks, cashier, block, created_at
                 FROM employees
                 WHERE (company IS NULL OR company = '') AND branch = ?
                 ORDER BY created_at ASC"
            );
            $blankStmt->bind_param('s', $branch);
            $blankStmt->execute();
            $res = $blankStmt->get_result();
            $rows = [];
            while ($row = $res->fetch_assoc()) {
                $rows[] = [
                    $row['name'], $row['company'], $row['deposit'], $row['dinein'],
                    $row['takeout'], $row['giftcard'], $row['cashout'], $row['interest'],
                    $row['sender_amount'], $row['receiver_amount'], $row['sender_name'],
                    $row['receiver_name'], $row['payment_method'], $row['card'],
                    $row['remarks'], $row['cashier'], $row['block'], $row['created_at'],
                ];
            }
            $writer->addSheet('Unassigned', $headers, $rows);
            $blankStmt->close();
        }

        $rowStmt->close();
        $conn->close();

        $filename = ($company !== '')
            ? 'transactions_' . preg_replace('/[^A-Za-z0-9_-]+/', '_', $company) . '_' . date('Y-m-d') . '.xlsx'
            : 'transactions_by_company_' . date('Y-m-d') . '.xlsx';

        $writer->output($filename);
        // output() exits, nothing below runs in this branch.
    } catch (Throwable $e) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Excel export failed: " . $e->getMessage() . "\n";
        exit;
    }
}

// ------------------------------------------------------------
// CSV mode (default) — unchanged from before.
// ------------------------------------------------------------
$sql = "SELECT name, company, deposit, dinein, takeout, giftcard,
               cashout, interest, sender_amount, receiver_amount,
               sender_name, receiver_name, payment_method, card,
               remarks, cashier, block, created_at
        FROM employees WHERE branch = ?";
$params = [$branch];
$types = "s";

if ($company !== '') {
    $sql .= " AND company = ?";
    $params[] = $company;
    $types .= "s";
}

$sql .= " ORDER BY created_at ASC";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    die("Query prepare failed: " . $conn->error);
}
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

// Build a safe filename: all-companies, or the sanitized company name.
$slug = $company !== ''
    ? preg_replace('/[^A-Za-z0-9_-]+/', '_', $company)
    : 'all_companies';
$filename = 'transactions_' . $slug . '_' . date('Y-m-d') . '.csv';

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

$out = fopen('php://output', 'w');

// Header row
fputcsv($out, [
    'Name', 'Company', 'Deposit', 'Dine In', 'Takeout', 'Gift Card',
    'Cashout', 'Interest', 'Sender Amount', 'Receiver Amount',
    'Sender Name', 'Receiver Name', 'Payment Method', 'Card',
    'Remarks', 'Cashier', 'Block Status', 'Created At'
]);

while ($row = $result->fetch_assoc()) {
    fputcsv($out, [
        $row['name'],
        $row['company'],
        $row['deposit'],
        $row['dinein'],
        $row['takeout'],
        $row['giftcard'],
        $row['cashout'],
        $row['interest'],
        $row['sender_amount'],
        $row['receiver_amount'],
        $row['sender_name'],
        $row['receiver_name'],
        $row['payment_method'],
        $row['card'],
        $row['remarks'],
        $row['cashier'],
        $row['block'],
        $row['created_at'],
    ]);
}

fclose($out);
$stmt->close();
$conn->close();
exit;