<?php
require_once __DIR__ . '/../../includes/api_helpers.php';
if (isset($_SESSION['username'])) {
    log_action($conn, $_SESSION['username'], 'Logged out', 'Signed out');
}
$_SESSION = [];
session_destroy();
json_success();