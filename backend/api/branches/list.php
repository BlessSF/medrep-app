<?php
// PUBLIC endpoint — deliberately does NOT require_login(), since the person
// needs to pick a branch BEFORE they can log in at all (it's one of the
// login form fields, not a post-login feature).
require_once __DIR__ . '/../../includes/api_helpers.php';

$conn->query("CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");
$conn->query("INSERT IGNORE INTO branches (name) VALUES ('STELLA')");

$result = $conn->query("SELECT name FROM branches ORDER BY name ASC");
$branches = [];
while ($row = $result->fetch_assoc()) {
    $branches[] = $row['name'];
}
json_success(['branches' => $branches]);