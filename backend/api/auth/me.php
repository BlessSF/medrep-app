<?php
require_once __DIR__ . '/../../includes/api_helpers.php';
if (!isset($_SESSION['username'])) {
    json_error('Not logged in', 401);
}
json_success([
    'username' => $_SESSION['username'],
    'role' => $_SESSION['role'] ?? '',
    'branch' => $_SESSION['branch'] ?? '',
    // The database clock: the one that stamps every log and transaction.
    // The app compares it with the real time to work out the server's offset.
    'server_now' => db_now($conn),
]);